const UploadedRow = require('../models/UploadedRow');
const Truck = require('../models/Truck');
const ExcelJS = require('exceljs');
const path = require('path');

class PaymentService {
  // ─────────────────────────────────────────────────────────────
  // Shared grouping logic
  //   Returns an array of truck-groups, each annotated with
  //   ownerChangeAfter = true when the NEXT group belongs to a
  //   different owner. This drives blank-row insertion in both
  //   the preview and the Excel generator.
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

    // Group by Truck — preserve order from sorted array
    const groups = [];
    const seen = new Map(); // truckNumber → group index

    rows.forEach(row => {
      const tNum = row.truckNumber.toUpperCase().trim();
      if (!seen.has(tNum)) {
        seen.set(tNum, groups.length);
        groups.push({
          truckNumber: tNum,
          // Internal owner id — never exposed to the UI/Excel printout
          _ownerId: row.matchedOwner ? String(row.matchedOwner._id) : '__unknown__',
          rows: [],
          totalQty: 0,
          totalAmount: 0,
          ownerChangeAfter: false  // filled in below
        });
      }
      const grp = groups[seen.get(tNum)];
      grp.rows.push(row);
      grp.totalQty += row.qty || 0;
      grp.totalAmount += row.amount || 0;
    });

    // Mark each group whose owner differs from the next group
    for (let i = 0; i < groups.length - 1; i++) {
      if (groups[i]._ownerId !== groups[i + 1]._ownerId) {
        groups[i].ownerChangeAfter = true;
      }
    }

    return groups;
  }

  // ─────────────────────────────────────────────────────────────
  // Preview endpoint — strips internal _ownerId before sending
  // ─────────────────────────────────────────────────────────────
  async getPreview({ fromDate, toDate }) {
    const groups = await this.buildGroups(fromDate, toDate);
    // Return ownerChangeAfter to the frontend; strip raw _ownerId
    return groups.map(g => ({
      truckNumber: g.truckNumber,
      rows: g.rows,
      totalQty: g.totalQty,
      totalAmount: g.totalAmount,
      ownerChangeAfter: g.ownerChangeAfter
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // Update edited rows (unchanged)
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
  // Helpers for Excel generation
  // ─────────────────────────────────────────────────────────────
  copyCellStyles(srcCell, destCell) {
    if (srcCell.font)      destCell.font      = JSON.parse(JSON.stringify(srcCell.font));
    if (srcCell.fill)      destCell.fill      = JSON.parse(JSON.stringify(srcCell.fill));
    if (srcCell.border)    destCell.border    = JSON.parse(JSON.stringify(srcCell.border));
    if (srcCell.alignment) destCell.alignment = JSON.parse(JSON.stringify(srcCell.alignment));
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
  // Excel generation — owner-aware blank rows
  // ─────────────────────────────────────────────────────────────
  async generateExcel({ fromDate, toDate }) {
    const templatePath = path.join(__dirname, '..', 'template', 'Payment_Template.xlsx');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const srcSheet = workbook.worksheets[0];

    // ── Capture template rows before splicing ──────────────────
    // Header row = Row 3 in template
    const headerRowTemp = srcSheet.getRow(3);
    const headerHeight  = headerRowTemp.height;
    const headerStyles  = [];
    const headerValues  = [];
    for (let c = 1; c <= 7; c++) {
      headerStyles.push(headerRowTemp.getCell(c));
      headerValues.push(headerRowTemp.getCell(c).value);
    }

    // Data row = Row 4
    const dataRowTemp = srcSheet.getRow(4);
    const dataHeight  = dataRowTemp.height;
    const dataStyles  = [];
    for (let c = 1; c <= 7; c++) dataStyles.push(dataRowTemp.getCell(c));

    // Total row = Row 5
    const totalRowTemp = srcSheet.getRow(5);
    const totalHeight  = totalRowTemp.height;
    const totalStyles  = [];
    for (let c = 1; c <= 7; c++) totalStyles.push(totalRowTemp.getCell(c));

    // Blank separator row = Row 6 (if present) — use for owner-change gaps
    // We just write empty rows with the same height as data rows.
    const blankHeight = dataHeight || 18;

    // ── Update title ───────────────────────────────────────────
    const fromDateStr = this.formatDate(new Date(fromDate));
    const toDateStr   = this.formatDate(new Date(toDate));
    srcSheet.getCell('A1').value =
      `PAYMENT SHEET FOR THE PERIOD FROM ${fromDateStr} TO ${toDateStr}`;

    // ── Fetch grouped data ─────────────────────────────────────
    const groups = await this.buildGroups(fromDate, toDate);

    // Remove the 3 template placeholder rows (rows 3–5)
    srcSheet.spliceRows(3, 3);

    let currentExcelRow = 3;

    const writeRow = (height, cells) => {
      const exRow = srcSheet.getRow(currentExcelRow);
      exRow.height = height;
      cells.forEach(({ col, value, style, numFormat }) => {
        const cell = exRow.getCell(col);
        if (value !== undefined) cell.value = value;
        if (style)     this.copyCellStyles(style, cell);
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
      // 1. Header row
      writeRow(headerHeight, Array.from({ length: 7 }, (_, i) => ({
        col: i + 1,
        value: headerValues[i],
        style: headerStyles[i]
      })));

      // 2. Data rows
      group.rows.forEach(item => {
        writeRow(dataHeight, [
          { col: 1, value: this.formatDate(item.date),  style: dataStyles[0] },
          { col: 2, value: item.challanNo,              style: dataStyles[1] },
          { col: 3, value: item.partyName,              style: dataStyles[2] },
          { col: 4, value: item.destination,            style: dataStyles[3] },
          { col: 5, value: item.truckNumber,            style: dataStyles[4] },
          { col: 6, value: item.qty,    style: dataStyles[5], numFormat: '#,##0.00' },
          { col: 7, value: item.amount, style: dataStyles[6], numFormat: '#,##0.00' }
        ]);
      });

      // 3. Total row
      writeRow(totalHeight, [
        { col: 1, value: null,             style: totalStyles[0] },
        { col: 2, value: null,             style: totalStyles[1] },
        { col: 3, value: null,             style: totalStyles[2] },
        { col: 4, value: null,             style: totalStyles[3] },
        { col: 5, value: 'Total:',         style: totalStyles[4] },
        { col: 6, value: group.totalQty,   style: totalStyles[5], numFormat: '#,##0.00' },
        { col: 7, value: group.totalAmount, style: totalStyles[6], numFormat: '#,##0.00' }
      ]);

      // 4. Spacing: 2 blank rows after owner change, 0 between same-owner trucks
      //    (Last group never needs trailing blanks)
      if (group.ownerChangeAfter) {
        writeBlankRow();
        writeBlankRow();
      }
    });

    return workbook.xlsx.writeBuffer();
  }
}

module.exports = new PaymentService();
