const ExcelJS = require('exceljs');
const Truck = require('../models/Truck');
const UploadRun = require('../models/UploadRun');
const UploadedRow = require('../models/UploadedRow');

class UploadService {
  // Helper to parse date
  parseExcelDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'number') {
      // Excel serial date format
      return new Date((val - 25569) * 86400 * 1000);
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;

    // Custom DD.MM.YYYY or DD/MM/YYYY parsing
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
  // Helper to extract plain value from an ExcelJS cell.
  // Formula cells: { formula: '=E3*F3', result: 30514 } → 30514
  // Rich text cells: { richText: [{text: 'Gross'}] }   → 'Gross'
  // Plain values returned as-is.
  getCellValue(cell) {
    const v = cell.value;
    if (v === null || v === undefined) return null;
    // Formula cell — ExcelJS stores cached result in v.result
    if (typeof v === 'object' && v !== null && 'result' in v) return v.result;
    // Rich text cell
    if (typeof v === 'object' && v !== null && Array.isArray(v.richText)) {
      return v.richText.map(rt => rt.text || '').join('').trim();
    }
    // Shared string or plain text object with .text
    if (typeof v === 'object' && v !== null && typeof v.text === 'string') return v.text;
    return v;
  }

  async validateExcel(fileBuffer, fileName) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    const worksheet = workbook.worksheets[0];

    // Find header row (scan first 5 rows)
    let headerRowIndex = 1;
    const expectedHeaders = ['date', "challan no.", "party's name", 'destination', 'vehicle no.', 'qty', 'rate', 'gross', 'comm', 'amount'];

    for (let r = 1; r <= 5; r++) {
      const row = worksheet.getRow(r);
      let matches = 0;
      row.eachCell({ includeEmpty: true }, (cell) => {
        const rawVal = this.getCellValue(cell);
        if (rawVal && typeof rawVal === 'string') {
          const val = rawVal.toLowerCase().trim();
          if (expectedHeaders.includes(val) || val.includes('challan') || val.includes('party') || val.includes('vehicle')) {
            matches++;
          }
        }
      });
      if (matches >= 5) {
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
        if (val.includes('date')) headersMap['date'] = colNumber;
        else if (val.includes('challan')) headersMap['challanNo'] = colNumber;
        else if (val.includes('party')) headersMap['partyName'] = colNumber;
        else if (val.includes('destination')) headersMap['destination'] = colNumber;
        else if (val.includes('vehicle')) headersMap['vehicleNo'] = colNumber;
        else if (val === 'qty') headersMap['qty'] = colNumber;
        else if (val === 'rate') headersMap['rate'] = colNumber;
        else if (val === 'gross') headersMap['gross'] = colNumber;
        else if (val.includes('comm')) headersMap['comm'] = colNumber;
        else if (val === 'amount') headersMap['amount'] = colNumber;
      }
    });


    const missingHeaders = [];
    ['date', 'challanNo', 'partyName', 'destination', 'vehicleNo', 'qty', 'rate', 'gross', 'comm', 'amount'].forEach(key => {
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

    // Load active trucks for lookup
    const allTrucks = await Truck.find({ status: 'Active' }).populate('owner');
    const truckMap = new Map();
    allTrucks.forEach(t => {
      const cleaned = t.truckNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
      truckMap.set(cleaned, t);
    });

    const parsedData = [];
    const errors = []; // critical – block save (unknown truck, invalid date, invalid numbers, formula mismatch)
    const warnings = []; // non-blocking – missing optional fields
    const missingDataList = [];
    const unknownTrucksSet = new Set();

    const startRow = headerRowIndex + 1;
    const endRow = worksheet.rowCount;

    for (let r = startRow; r <= endRow; r++) {
      const row = worksheet.getRow(r);
      let hasData = false;
      row.eachCell({ includeEmpty: false }, () => { hasData = true; });
      if (!hasData) continue;

      const dateRaw    = this.getCellValue(row.getCell(headersMap['date']));
      const challanRaw = this.getCellValue(row.getCell(headersMap['challanNo']));
      const partyRaw   = this.getCellValue(row.getCell(headersMap['partyName']));
      const destRaw    = this.getCellValue(row.getCell(headersMap['destination']));
      const vehicleRaw = this.getCellValue(row.getCell(headersMap['vehicleNo']));
      const qtyRaw     = this.getCellValue(row.getCell(headersMap['qty']));
      const rateRaw    = this.getCellValue(row.getCell(headersMap['rate']));
      const grossRaw   = this.getCellValue(row.getCell(headersMap['gross']));
      const commRaw    = this.getCellValue(row.getCell(headersMap['comm']));
      const amountRaw  = this.getCellValue(row.getCell(headersMap['amount']));


      const rowNum = r;
      const rowErrors = [];   // critical per-row errors
      const rowWarnings = []; // non-blocking per-row warnings

      // 1. Date – critical
      const dateVal = this.parseExcelDate(dateRaw);
      if (!dateRaw || !dateVal) {
        rowErrors.push(`Row ${rowNum}: Invalid or missing Date.`);
      }

      // 2. Challan No – warning (non-blocking)
      const challanNo = challanRaw ? challanRaw.toString().trim() : '';
      if (!challanNo) {
        rowWarnings.push(`Row ${rowNum}: Missing Challan Number.`);
      }

      // 3. Party Name & Destination – warnings (non-blocking)
      const partyName = partyRaw ? partyRaw.toString().trim() : '';
      const destination = destRaw ? destRaw.toString().trim() : '';
      if (!partyName) rowWarnings.push(`Row ${rowNum}: Missing Party's Name.`);
      if (!destination) rowWarnings.push(`Row ${rowNum}: Missing Destination.`);

      // 4. Truck/Vehicle – critical
      const truckNumber = vehicleRaw ? vehicleRaw.toString().toUpperCase().trim() : '';
      let matchedOwnerId = null;
      if (!truckNumber) {
        rowErrors.push(`Row ${rowNum}: Missing Vehicle Number (Truck Number).`);
      } else {
        const cleanedNo = truckNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
        const matchedTruck = truckMap.get(cleanedNo);
        if (!matchedTruck) {
          unknownTrucksSet.add(truckNumber);
          rowErrors.push(`Row ${rowNum}: Unknown Truck (${truckNumber}) not found in master data.`);
        } else {
          matchedOwnerId = matchedTruck.owner._id;
        }
      }

      // 5. Numeric parsing – critical
      const qty    = parseFloat(qtyRaw);
      const rate   = parseFloat(rateRaw);
      const gross  = parseFloat(grossRaw);
      const comm   = parseFloat(commRaw);
      const amount = parseFloat(amountRaw);

      if (isNaN(qty))   rowErrors.push(`Row ${rowNum}: Invalid Qty value.`);
      if (isNaN(rate))  rowErrors.push(`Row ${rowNum}: Invalid Rate value.`);
      if (isNaN(gross)) rowErrors.push(`Row ${rowNum}: Invalid Gross value.`);
      if (isNaN(amount)) rowErrors.push(`Row ${rowNum}: Invalid or empty Amount.`);
      if (isNaN(comm))  rowWarnings.push(`Row ${rowNum}: Missing or invalid Commission.`);

      // 6. Business formula validation – critical (only when numbers are valid)
      if (!isNaN(qty) && !isNaN(rate) && !isNaN(gross)) {
        const calculatedGross = qty * rate;
        if (Math.abs(gross - calculatedGross) > 0.01) {
          rowErrors.push(`Row ${rowNum}: Gross mismatch — expected ${calculatedGross.toFixed(2)}, got ${gross.toFixed(2)}.`);
        }
      }
      if (!isNaN(gross) && !isNaN(comm) && !isNaN(amount)) {
        const calculatedAmount = gross - comm;
        if (Math.abs(amount - calculatedAmount) > 0.01) {
          rowErrors.push(`Row ${rowNum}: Amount mismatch — expected ${calculatedAmount.toFixed(2)}, got ${amount.toFixed(2)}.`);
        }
      }

      // Collect global issues
      if (rowErrors.length > 0) errors.push(...rowErrors);
      if (rowWarnings.length > 0) warnings.push(...rowWarnings);

      const allIssues = [...rowErrors, ...rowWarnings];
      if (allIssues.length > 0) {
        missingDataList.push({
          row: rowNum,
          challanNo: challanNo || 'N/A',
          truckNumber: truckNumber || 'N/A',
          errors: rowErrors,
          warnings: rowWarnings,
          issues: allIssues
        });
      }

      parsedData.push({
        rowNum,
        date: dateVal,
        challanNo,
        partyName,
        destination,
        truckNumber,
        qty: isNaN(qty) ? null : qty,
        rate: isNaN(rate) ? null : rate,
        gross: isNaN(gross) ? null : gross,
        comm: isNaN(comm) ? null : comm,
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
    const isValid = errors.length === 0; // no critical errors

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

  async saveUploadRun(fileName, rows) {
    // Load trucks for owner matching
    const allTrucks = await Truck.find({ status: 'Active' }).populate('owner');
    const truckMap = new Map();
    allTrucks.forEach(t => {
      const cleaned = t.truckNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
      truckMap.set(cleaned, t);
    });

    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    // Save Run Summary first
    const uploadRun = new UploadRun({
      fileName,
      totalRows: rows.length,
      status: 'Completed'
    });

    const rowDocuments = rows.map(r => {
      const cleanedNo = (r.truckNumber || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
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
        date: r.date ? new Date(r.date) : new Date(),
        challanNo: r.challanNo || '',
        partyName: r.partyName || '',
        destination: r.destination || '',
        truckNumber: r.truckNumber || '',
        qty: parseFloat(r.qty) || 0,
        rate: parseFloat(r.rate) || 0,
        gross: parseFloat(r.gross) || 0,
        comm: parseFloat(r.comm) || 0,
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
    await UploadedRow.insertMany(rowDocuments);

    return uploadRun;
  }

  async getHistory() {
    return await UploadRun.find().sort({ uploadedAt: -1 });
  }

  async getRunRows(runId) {
    return await UploadedRow.find({ uploadRun: runId }).sort({ date: 1 });
  }

  async deleteRun(runId) {
    await UploadedRow.deleteMany({ uploadRun: runId });
    await UploadRun.findByIdAndDelete(runId);
  }

  async getAllRows(filters = {}) {
    const query = {};
    if (filters.uploadRun) query.uploadRun = filters.uploadRun;
    if (filters.truckNumber) query.truckNumber = new RegExp(filters.truckNumber, 'i');
    if (filters.partyName) query.partyName = new RegExp(filters.partyName, 'i');
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
      UploadedRow.find(query).populate('matchedOwner', 'name').skip(skip).limit(limit).sort({ date: 1 }),
      UploadedRow.countDocuments(query)
    ]);

    return { rows, total, page, limit };
  }

  async updateRow(rowId, updates) {
    // Re-validate truck if changed
    if (updates.truckNumber) {
      const allTrucks = await Truck.find({ status: 'Active' }).populate('owner');
      const truckMap = new Map();
      allTrucks.forEach(t => {
        const cleaned = t.truckNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
        truckMap.set(cleaned, t);
      });
      const cleanedNo = updates.truckNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
      const matchedTruck = truckMap.get(cleanedNo);
      updates.matchedOwner = matchedTruck ? matchedTruck.owner._id : null;
    }

    // Re-validate formulas if numeric fields changed
    const rowErrors = [];
    const rowWarnings = [];
    const qty = parseFloat(updates.qty);
    const rate = parseFloat(updates.rate);
    const gross = parseFloat(updates.gross);
    const comm = parseFloat(updates.comm);
    const amount = parseFloat(updates.amount);

    if (!isNaN(qty) && !isNaN(rate) && !isNaN(gross)) {
      const calculatedGross = qty * rate;
      if (Math.abs(gross - calculatedGross) > 0.01) {
        rowErrors.push(`Gross mismatch — expected ${calculatedGross.toFixed(2)}, got ${gross.toFixed(2)}.`);
      }
    }
    if (!isNaN(gross) && !isNaN(comm) && !isNaN(amount)) {
      const calculatedAmount = gross - comm;
      if (Math.abs(amount - calculatedAmount) > 0.01) {
        rowErrors.push(`Amount mismatch — expected ${calculatedAmount.toFixed(2)}, got ${amount.toFixed(2)}.`);
      }
    }
    if (!updates.partyName) rowWarnings.push('Missing Party Name.');
    if (!updates.destination) rowWarnings.push('Missing Destination.');
    if (!updates.matchedOwner) rowErrors.push('Truck not found in master data.');

    let validationStatus = 'valid';
    if (rowErrors.length > 0) validationStatus = 'error';
    else if (rowWarnings.length > 0) validationStatus = 'warning';

    updates.rowErrors = rowErrors;
    updates.rowWarnings = rowWarnings;
    updates.validationStatus = validationStatus;

    return await UploadedRow.findByIdAndUpdate(rowId, updates, { new: true });
  }

  async deleteRow(rowId) {
    return await UploadedRow.findByIdAndDelete(rowId);
  }
}

module.exports = new UploadService();
