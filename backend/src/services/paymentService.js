const UploadedRow = require('../models/UploadedRow');
const Truck = require('../models/Truck');
const ExcelJS = require('exceljs');
const path = require('path');

class PaymentService {
  // ─────────────────────────────────────────────────────────────
  // Shared grouping logic
  // ─────────────────────────────────────────────────────────────
  async buildGroups(fromDate, toDate) {
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const rows = await UploadedRow.find({
      date: { $gte: start, $lte: end }
    }).populate('matchedOwner');

    // Sort: Owner → Truck → Date → Challan
    rows.sort((a, b) => {
      const ownerA = a.matchedOwner ? a.matchedOwner.name.toLowerCase() : 'zzz';
      const ownerB = b.matchedOwner ? b.matchedOwner.name.toLowerCase() : 'zzz';
      if (ownerA !== ownerB) return ownerA.localeCompare(ownerB);

      const truckA = a.truckNumber.toLowerCase();
      const truckB = b.truckNumber.toLowerCase();
      if (truckA !== truckB) return truckA.localeCompare(truckB);

      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;

      return (a.challanNo || '').toLowerCase().localeCompare((b.challanNo || '').toLowerCase());
    });

    const groups = [];
    const seen = new Map();

    rows.forEach(row => {
      const tNum = row.truckNumber.toUpperCase().trim();
      if (!seen.has(tNum)) {
        seen.set(tNum, groups.length);
        groups.push({
          truckNumber: tNum,
          _ownerId: row.matchedOwner ? String(row.matchedOwner._id) : '__unknown__',
          ownerName: row.matchedOwner ? row.matchedOwner.name : 'Unknown Owner',
          rows: [],
          totalQty: 0,
          totalAmount: 0,
          ownerChangeAfter: false
        });
      }
      const grp = groups[seen.get(tNum)];
      grp.rows.push(row);
      grp.totalQty += row.qty || 0;
      grp.totalAmount += Math.round(row.amount || 0);
    });

    for (let i = 0; i < groups.length - 1; i++) {
      if (groups[i]._ownerId !== groups[i + 1]._ownerId) {
        groups[i].ownerChangeAfter = true;
      }
    }

    return groups;
  }

  // ─────────────────────────────────────────────────────────────
  // Preview endpoint
  // ─────────────────────────────────────────────────────────────
  async getPreview({ fromDate, toDate }) {
    const groups = await this.buildGroups(fromDate, toDate);
    return groups.map(g => ({
      truckNumber: g.truckNumber,
      ownerName: g.ownerName,
      rows: g.rows.map(r => ({
        ...r.toObject ? r.toObject() : r,
        amount: Math.round(r.amount || 0)
      })),
      totalQty: g.totalQty,
      totalAmount: Math.round(g.totalAmount),
      ownerChangeAfter: g.ownerChangeAfter
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Update edited rows
  // ─────────────────────────────────────────────────────────────
  async updateRows(rows) {
    const updatedRows = [];
    for (const row of rows) {
      const updateData = {
        date: new Date(row.date),
        challanNo: row.challanNo,
        partyName: row.partyName,
        destination: row.destination,
        qty: parseFloat(row.qty) || 0,
        amount: parseFloat(row.amount) || 0
      };
      const updated = await UploadedRow.findByIdAndUpdate(row._id, updateData, { new: true });
      if (updated) updatedRows.push(updated);
    }
    return updatedRows;
  }

  // ─────────────────────────────────────────────────────────────
  // Complete style cloning
  // ─────────────────────────────────────────────────────────────
  copyCellStyles(srcCell, destCell) {
    // Clone styles completely
    if (srcCell.font) destCell.font = JSON.parse(JSON.stringify(srcCell.font));
    if (srcCell.fill) destCell.fill = JSON.parse(JSON.stringify(srcCell.fill));
    if (srcCell.border) destCell.border = JSON.parse(JSON.stringify(srcCell.border));
    if (srcCell.alignment) destCell.alignment = JSON.parse(JSON.stringify(srcCell.alignment));
    if (srcCell.protection) destCell.protection = JSON.parse(JSON.stringify(srcCell.protection));
    if (srcCell.numFormat) destCell.numFormat = srcCell.numFormat;
  }

  formatDate(d) {
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return '';
    const day   = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year  = dateObj.getFullYear();
    return `${day}.${month}.${year}`;
  }

  // ─────────────────────────────────────────────────────────────
  // Excel generation
  // ─────────────────────────────────────────────────────────────
  async generateExcel({ fromDate, toDate }) {
    const templatePath = path.join(__dirname, '..', 'template', 'Payment_Template.xlsx');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const srcSheet = workbook.worksheets[0];

    // Read templates elements from rows 3, 4, 5
    const headerRowTemp = srcSheet.getRow(3);
    const headerHeight  = headerRowTemp.height;
    const headerStyles  = [];
    const headerValues  = [];
    for (let c = 1; c <= 7; c++) {
      headerStyles.push(headerRowTemp.getCell(c));
      headerValues.push(headerRowTemp.getCell(c).value);
    }

    const dataRowTemp = srcSheet.getRow(4);
    const dataHeight  = dataRowTemp.height;
    const dataStyles  = [];
    for (let c = 1; c <= 7; c++) dataStyles.push(dataRowTemp.getCell(c));

    const totalRowTemp = srcSheet.getRow(5);
    const totalHeight  = totalRowTemp.height;
    const totalStyles  = [];
    for (let c = 1; c <= 7; c++) totalStyles.push(totalRowTemp.getCell(c));

    const blankHeight = dataHeight || 18;

    const fromDateStr = this.formatDate(new Date(fromDate));
    const toDateStr   = this.formatDate(new Date(toDate));
    srcSheet.getCell('A1').value =
      `PAYMENT SHEET FOR THE PERIOD FROM ${fromDateStr} TO ${toDateStr}`;

    const groups = await this.buildGroups(fromDate, toDate);

    // Remove template rows 3 to 5
    srcSheet.spliceRows(3, 3);

    let currentExcelRow = 3;
    let pageStartRow = 3; 
    const rowsPerPage = 58; // Max printable rows per A4 Portrait page

    const writeRow = (height, cells, tempRow) => {
      const exRow = srcSheet.getRow(currentExcelRow);
      exRow.height = height;
      
      // Clone row metadata from template if provided
      if (tempRow) {
        exRow.hidden = tempRow.hidden;
        exRow.outlineLevel = tempRow.outlineLevel;
      }

      cells.forEach(({ col, value, style, numFormat }) => {
        const cell = exRow.getCell(col);
        if (value !== undefined) cell.value = value;
        if (style) this.copyCellStyles(style, cell);
        if (numFormat) cell.numFmt = numFormat;
      });
      exRow.commit();
      currentExcelRow++;
    };

    const writeBlankRow = () => {
      const exRow = srcSheet.getRow(currentExcelRow);
      exRow.height = blankHeight;
      exRow.commit();
      currentExcelRow++;
    };

    groups.forEach((group, idx) => {
      // Required rows for this truck block: 
      // 1 (header) + N (data rows) + 1 (total)
      const blockRowsCount = group.rows.length + 2;

      // Spacing rows count after this block
      let extraSpacingCount = 0;
      if (group.ownerChangeAfter) {
        extraSpacingCount = 2; // ownership separator
      }

      const totalRequiredRows = blockRowsCount + extraSpacingCount;
      const currentUsedRows = currentExcelRow - pageStartRow;

      // If it doesn't fit on the current page, insert a page break BEFORE writing header.
      if (currentUsedRows > 0 && (currentUsedRows + totalRequiredRows > rowsPerPage)) {
        const prevRow = srcSheet.getRow(currentExcelRow - 1);
        prevRow.addPageBreak(); // Insert page break at the last written row
        pageStartRow = currentExcelRow;
      }

      // Write Header
      writeRow(headerHeight, Array.from({ length: 7 }, (_, i) => ({
        col: i + 1,
        value: headerValues[i],
        style: headerStyles[i]
      })), headerRowTemp);

      // Write Data Rows
      group.rows.forEach(item => {
        writeRow(dataHeight, [
          { col: 1, value: this.formatDate(item.date),   style: dataStyles[0] },
          { col: 2, value: item.challanNo,               style: dataStyles[1] },
          { col: 3, value: item.partyName,               style: dataStyles[2] },
          { col: 4, value: item.destination,             style: dataStyles[3] },
          { col: 5, value: item.truckNumber,             style: dataStyles[4] },
          { col: 6, value: item.qty,    style: dataStyles[5], numFormat: '#,##0.00' },
          { col: 7, value: Math.round(item.amount || 0), style: dataStyles[6], numFormat: '#,##0' }
        ], dataRowTemp);
      });

      // Write Total Row
      writeRow(totalHeight, [
        { col: 1, value: null,             style: totalStyles[0] },
        { col: 2, value: null,             style: totalStyles[1] },
        { col: 3, value: null,             style: totalStyles[2] },
        { col: 4, value: null,             style: totalStyles[3] },
        { col: 5, value: 'Total:',         style: totalStyles[4] },
        { col: 6, value: group.totalQty,   style: totalStyles[5], numFormat: '#,##0.00' },
        { col: 7, value: Math.round(group.totalAmount), style: totalStyles[6], numFormat: '#,##0' }
      ], totalRowTemp);

      // Apply spacing
      if (group.ownerChangeAfter) {
        writeBlankRow();
        writeBlankRow();
      }
    });

    return workbook.xlsx.writeBuffer();
  }
}

module.exports = new PaymentService();
