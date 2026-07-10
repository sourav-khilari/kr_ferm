const ExcelJS = require('exceljs');
const Truck = require('../models/Truck');
const UploadRun = require('../models/UploadRun');
const DieselRow = require('../models/DieselRow');

class DieselService {
  parseExcelDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'number') {
      return new Date((val - 25569) * 86400 * 1000);
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;

    if (typeof val === 'string') {
      const parts = val.split(/[./-]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const customDate = new Date(year, month, day);
        if (!isNaN(customDate.getTime())) return customDate;
      }
    }
    return null;
  }

  getCellValue(cell) {
    const v = cell.value;
    if (v === null || v === undefined) return null;
    if (typeof v === 'object' && v !== null && 'result' in v) return v.result;
    if (typeof v === 'object' && v !== null && Array.isArray(v.richText)) {
      return v.richText.map(rt => rt.text || '').join('').trim();
    }
    if (typeof v === 'object' && v !== null && typeof v.text === 'string') return v.text;
    return v;
  }

  async validateExcel(fileBuffer, fileName) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    const worksheet = workbook.worksheets[0];

    let headerRowIndex = 1;
    const expectedHeaders = ['sl no', 'date', 'vehicle no', 'product', 'qty', 'rate', 'amount'];

    for (let r = 1; r <= 5; r++) {
      const row = worksheet.getRow(r);
      let matches = 0;
      row.eachCell({ includeEmpty: true }, (cell) => {
        const rawVal = this.getCellValue(cell);
        if (rawVal && typeof rawVal === 'string') {
          const val = rawVal.toLowerCase().trim();
          if (expectedHeaders.includes(val) || val.includes('sl') || val.includes('vehicle') || val.includes('product')) {
            matches++;
          }
        }
      });
      if (matches >= 4) {
        headerRowIndex = r;
        break;
      }
    }

    const headersMap = {};
    const headerRow = worksheet.getRow(headerRowIndex);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const rawVal = this.getCellValue(cell);
      if (rawVal !== null && rawVal !== undefined) {
        const val = String(rawVal).toLowerCase().trim();
        if (val.includes('sl') || val.includes('serial')) headersMap['slNo'] = colNumber;
        else if (val.includes('date')) headersMap['date'] = colNumber;
        else if (val.includes('vehicle') || val.includes('truck')) headersMap['vehicleNo'] = colNumber;
        else if (val.includes('product') || val.includes('item')) headersMap['product'] = colNumber;
        else if (val === 'qty' || val === 'quantity') headersMap['qty'] = colNumber;
        else if (val === 'rate') headersMap['rate'] = colNumber;
        else if (val === 'amount') headersMap['amount'] = colNumber;
      }
    });

    const missingHeaders = [];
    ['date', 'vehicleNo', 'qty', 'rate', 'amount'].forEach(key => {
      if (!headersMap[key]) missingHeaders.push(key);
    });

    if (missingHeaders.length > 0) {
      return {
        isValid: false,
        totalRows: 0,
        validRows: 0,
        warningRows: 0,
        errors: [`Missing required columns in Excel sheet: ${missingHeaders.join(', ')}`],
        unknownTrucks: [],
        missingData: [],
        parsedData: []
      };
    }

    const allTrucks = await Truck.find({ status: 'Active' }).populate('owner');
    const truckMap = new Map();
    allTrucks.forEach(t => {
      const cleaned = t.truckNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
      truckMap.set(cleaned, t);
    });

    const parsedData = [];
    const errors = []; 
    const warnings = []; 
    const missingDataList = [];
    const unknownTrucksSet = new Set();

    const startRow = headerRowIndex + 1;
    const endRow = worksheet.rowCount;

    for (let r = startRow; r <= endRow; r++) {
      const row = worksheet.getRow(r);
      let hasData = false;
      row.eachCell({ includeEmpty: false }, () => { hasData = true; });
      if (!hasData) continue;

      const slNoRaw     = this.getCellValue(row.getCell(headersMap['slNo'] || 0));
      const dateRaw     = this.getCellValue(row.getCell(headersMap['date']));
      const vehicleRaw  = this.getCellValue(row.getCell(headersMap['vehicleNo']));
      const productRaw  = this.getCellValue(row.getCell(headersMap['product'] || 0));
      const qtyRaw      = this.getCellValue(row.getCell(headersMap['qty']));
      const rateRaw     = this.getCellValue(row.getCell(headersMap['rate']));
      const amountRaw   = this.getCellValue(row.getCell(headersMap['amount']));

      const rowNum = r;
      const rowErrors = [];   
      const rowWarnings = []; 

      // 1. Date
      const dateVal = this.parseExcelDate(dateRaw);
      if (!dateRaw || !dateVal) {
        rowErrors.push(`Row ${rowNum}: Invalid or missing Date.`);
      }

      // 2. Sl No, Product (Optional)
      const slNo = slNoRaw ? slNoRaw.toString().trim() : '';
      const product = productRaw ? productRaw.toString().trim() : '';

      // 3. Vehicle No - Warn if not matched in Truck Master. Do not reject.
      const vehicleNo = vehicleRaw ? vehicleRaw.toString().toUpperCase().trim() : '';
      let matchedOwnerId = null;
      if (!vehicleNo) {
        rowWarnings.push(`Row ${rowNum}: Missing Vehicle Number.`);
      } else {
        const cleanedNo = vehicleNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
        const matchedTruck = truckMap.get(cleanedNo);
        if (!matchedTruck) {
          unknownTrucksSet.add(vehicleNo);
          rowWarnings.push(`Row ${rowNum}: Truck (${vehicleNo}) not found in master data.`);
        } else {
          matchedOwnerId = matchedTruck.owner._id;
        }
      }

      // 4. Numeric parsing
      const qty    = parseFloat(qtyRaw);
      const rate   = parseFloat(rateRaw);
      const amount = parseFloat(amountRaw);

      if (isNaN(qty))   rowErrors.push(`Row ${rowNum}: Invalid Qty value.`);
      if (isNaN(rate))  rowErrors.push(`Row ${rowNum}: Invalid Rate value.`);
      if (isNaN(amount)) rowErrors.push(`Row ${rowNum}: Invalid or empty Amount.`);

      // Formula validation: Qty * Rate = Amount
      if (!isNaN(qty) && !isNaN(rate) && !isNaN(amount)) {
        const calculatedAmount = qty * rate;
        if (Math.abs(amount - calculatedAmount) > 0.05) {
          rowErrors.push(`Row ${rowNum}: Amount mismatch — expected ${calculatedAmount.toFixed(2)}, got ${amount.toFixed(2)}.`);
        }
      }

      if (rowErrors.length > 0) errors.push(...rowErrors);
      if (rowWarnings.length > 0) warnings.push(...rowWarnings);

      const allIssues = [...rowErrors, ...rowWarnings];
      if (allIssues.length > 0) {
        missingDataList.push({
          row: rowNum,
          slNo,
          vehicleNo: vehicleNo || 'N/A',
          errors: rowErrors,
          warnings: rowWarnings,
          issues: allIssues
        });
      }

      parsedData.push({
        rowNum,
        slNo,
        date: dateVal,
        vehicleNo,
        product,
        qty: isNaN(qty) ? null : qty,
        rate: isNaN(rate) ? null : rate,
        amount: isNaN(amount) ? null : amount,
        matchedOwner: matchedOwnerId,
        rowErrors,
        rowWarnings,
        hasError: rowErrors.length > 0,
        hasWarning: rowWarnings.length > 0
      });
    }

    const totalRows = parsedData.length;
    const errorRows = parsedData.filter(r => r.hasError).length;
    const warningRows = parsedData.filter(r => r.hasWarning && !r.hasError).length;
    const validRows = totalRows - errorRows - warningRows;
    const isValid = errors.length === 0;

    return {
      isValid,
      totalRows,
      validRows,
      warningRows,
      errorRows,
      errors,
      warnings,
      unknownTrucks: Array.from(unknownTrucksSet),
      missingData: missingDataList,
      parsedData
    };
  }

  async saveUploadRun(fileName, pumpId, rows) {
    const allTrucks = await Truck.find({ status: 'Active' }).populate('owner');
    const truckMap = new Map();
    allTrucks.forEach(t => {
      const cleaned = t.truckNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
      truckMap.set(cleaned, t);
    });

    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    const uploadRun = new UploadRun({
      fileName,
      totalRows: rows.length,
      status: 'Completed'
    });

    const rowDocuments = rows.map(r => {
      const cleanedNo = (r.vehicleNo || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
      const matchedTruck = truckMap.get(cleanedNo);
      const ownerId = matchedTruck ? matchedTruck.owner._id : null;

      const rowErrors = r.rowErrors || [];
      const rowWarnings = r.rowWarnings || [];

      let validationStatus = 'valid';
      if (rowErrors.length > 0) {
        validationStatus = 'error';
        errorCount++;
      } else if (rowWarnings.length > 0) {
        validationStatus = 'warning';
        warningCount++;
      } else {
        validCount++;
      }

      return {
        pump: pumpId,
        date: r.date ? new Date(r.date) : new Date(),
        slNo: r.slNo || '',
        vehicleNo: r.vehicleNo || '',
        product: r.product || '',
        qty: parseFloat(r.qty) || 0,
        rate: parseFloat(r.rate) || 0,
        amount: parseFloat(r.amount) || 0,
        matchedOwner: ownerId,
        uploadRun: uploadRun._id,
        validationStatus,
        rowErrors,
        rowWarnings
      };
    });

    uploadRun.validRows = validCount;
    uploadRun.warningRows = warningCount + errorCount;

    await uploadRun.save();
    await DieselRow.insertMany(rowDocuments);

    return uploadRun;
  }

  async getHistory() {
    return await UploadRun.find({
      _id: { $in: await DieselRow.distinct('uploadRun') }
    }).sort({ uploadedAt: -1 });
  }

  async getRunRows(runId) {
    return await DieselRow.find({ uploadRun: runId }).populate('pump').sort({ date: 1 });
  }

  async deleteRun(runId) {
    await DieselRow.deleteMany({ uploadRun: runId });
    await UploadRun.findByIdAndDelete(runId);
  }

  async getAllRows(filters = {}) {
    const query = {};
    if (filters.uploadRun) query.uploadRun = filters.uploadRun;
    if (filters.pump) query.pump = filters.pump;
    if (filters.vehicleNo) query.vehicleNo = new RegExp(filters.vehicleNo, 'i');
    if (filters.validationStatus) query.validationStatus = filters.validationStatus;
    if (filters.dateFrom || filters.dateTo) {
      query.date = {};
      if (filters.dateFrom) query.date.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.date.$lte = new Date(filters.dateTo);
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      DieselRow.find(query).populate('matchedOwner', 'name').populate('pump', 'name').skip(skip).limit(limit).sort({ date: 1 }),
      DieselRow.countDocuments(query)
    ]);

    return { rows, total, page, limit };
  }

  async updateRow(rowId, updates) {
    if (updates.vehicleNo) {
      const allTrucks = await Truck.find({ status: 'Active' }).populate('owner');
      const truckMap = new Map();
      allTrucks.forEach(t => {
        const cleaned = t.truckNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
        truckMap.set(cleaned, t);
      });
      const cleanedNo = updates.vehicleNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
      const matchedTruck = truckMap.get(cleanedNo);
      updates.matchedOwner = matchedTruck ? matchedTruck.owner._id : null;
    }

    const rowErrors = [];
    const rowWarnings = [];
    const qty = parseFloat(updates.qty);
    const rate = parseFloat(updates.rate);
    const amount = parseFloat(updates.amount);

    if (isNaN(qty)) rowErrors.push('Invalid Qty value.');
    if (isNaN(rate)) rowErrors.push('Invalid Rate value.');
    if (isNaN(amount)) rowErrors.push('Invalid or empty Amount.');

    if (!isNaN(qty) && !isNaN(rate) && !isNaN(amount)) {
      const calculatedAmount = qty * rate;
      if (Math.abs(amount - calculatedAmount) > 0.05) {
        rowErrors.push(`Amount mismatch — expected ${calculatedAmount.toFixed(2)}, got ${amount.toFixed(2)}.`);
      }
    }

    if (!updates.matchedOwner) rowWarnings.push('Truck not found in master data.');

    let validationStatus = 'valid';
    if (rowErrors.length > 0) validationStatus = 'error';
    else if (rowWarnings.length > 0) validationStatus = 'warning';

    updates.rowErrors = rowErrors;
    updates.rowWarnings = rowWarnings;
    updates.validationStatus = validationStatus;

    return await DieselRow.findByIdAndUpdate(rowId, updates, { new: true });
  }

  async deleteRow(rowId) {
    return await DieselRow.findByIdAndDelete(rowId);
  }
}

module.exports = new DieselService();
