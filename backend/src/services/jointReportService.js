const ExcelJS = require('exceljs');
const path = require('path');
const ownerSummaryService = require('./ownerSummaryService');

class JointReportService {
  /**
   * Deep-copy all visual styles from srcCell to destCell.
   */
  copyCellStyles(srcCell, destCell) {
    if (srcCell.font)       destCell.font       = JSON.parse(JSON.stringify(srcCell.font));
    if (srcCell.fill)       destCell.fill       = JSON.parse(JSON.stringify(srcCell.fill));
    if (srcCell.border)     destCell.border     = JSON.parse(JSON.stringify(srcCell.border));
    if (srcCell.alignment)  destCell.alignment  = JSON.parse(JSON.stringify(srcCell.alignment));
    if (srcCell.numFmt)     destCell.numFmt     = srcCell.numFmt;
  }

  /**
   * Copy an entire source row (values + styles) into the destination row.
   * @param {ExcelJS.Row} srcRow
   * @param {ExcelJS.Row} destRow
   * @param {number} colCount   How many columns to copy
   */
  copyRow(srcRow, destRow, colCount) {
    destRow.height = srcRow.height;
    for (let c = 1; c <= colCount; c++) {
      const srcCell  = srcRow.getCell(c);
      const destCell = destRow.getCell(c);
      // Copy value (but skip formula values – keep them as-is for header/static rows)
      const v = srcCell.value;
      if (v !== null && v !== undefined) {
        if (typeof v === 'object' && v.formula) {
          // Don't propagate template formulas into static header rows
          destCell.value = v.result !== undefined ? v.result : null;
        } else {
          destCell.value = v;
        }
      }
      this.copyCellStyles(srcCell, destCell);
    }
    destRow.commit();
  }

  /**
   * Apply merged cell ranges from the source sheet to the destination sheet,
   * adjusting row numbers by rowOffset.
   */
  copyMerges(srcSheet, destSheet, maxSrcRow, rowOffset, colCount) {
    const merges = srcSheet.model.merges || [];
    merges.forEach(rangeStr => {
      // Range is like "A1:N1"
      const match = rangeStr.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (!match) return;
      const r1 = parseInt(match[2], 10);
      const r2 = parseInt(match[4], 10);
      if (r1 > maxSrcRow || r2 > maxSrcRow) return;
      const c1 = colLetterToNum(match[1]);
      const c2 = colLetterToNum(match[3]);
      if (c1 > colCount || c2 > colCount) return;
      try {
        destSheet.mergeCells(r1 + rowOffset, c1, r2 + rowOffset, c2);
      } catch (_) { /* ignore duplicate merge attempts */ }
    });
  }

  formatDateLabel(d) {
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return '';
    const day   = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year  = dateObj.getFullYear();
    return `${day}.${month}.${year}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC: Generate the three-sheet workbook buffer
  // ─────────────────────────────────────────────────────────────────────────────
  async generateWorkbook({ fromDate, toDate }) {
    const templateDir = path.join(__dirname, '..', 'template');

    // Load template workbooks
    const gstWb = new ExcelJS.Workbook();
    await gstWb.xlsx.readFile(path.join(templateDir, 'GST_Payment_Template.xlsx'));
    const gstSrc = gstWb.worksheets[0];

    const rcmWb = new ExcelJS.Workbook();
    await rcmWb.xlsx.readFile(path.join(templateDir, 'RCM_Payment_Template.xlsx'));
    const rcmSrc = rcmWb.worksheets[0];

    const chequeWb = new ExcelJS.Workbook();
    await chequeWb.xlsx.readFile(path.join(templateDir, 'Cheque_Template.xlsx'));
    const chequeSrc = chequeWb.worksheets[0];

    // Create output workbook
    const outWb = new ExcelJS.Workbook();
    const gstOut    = outWb.addWorksheet('GST Payment');
    const rcmOut    = outWb.addWorksheet('RCM Payment');
    const chequeOut = outWb.addWorksheet('Cheque Details');

    // Fetch owner summary data
    const allSummaries = await ownerSummaryService.getOwnerSummary({ fromDate, toDate });
    const gstList   = allSummaries.filter(s => s.gstApplicable);
    const rcmList   = allSummaries.filter(s => !s.gstApplicable);

    const fromStr = this.formatDateLabel(new Date(fromDate));
    const toStr   = this.formatDateLabel(new Date(toDate));

    this.renderGstSheet(gstSrc,    gstOut,    gstList,      fromStr, toStr);
    this.renderRcmSheet(rcmSrc,    rcmOut,    rcmList,      fromStr, toStr);
    this.renderChequeSheet(chequeSrc, chequeOut, allSummaries, fromStr, toStr);

    return await outWb.xlsx.writeBuffer();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GST PAYMENT SHEET
  //
  // Template rows:
  //   Row 1 = Company name (merged A1:N1)
  //   Row 2 = Title with date range (merged A2:N2)
  //   Row 3 = Column headers
  //   Row 4 = Data row template (used for style cloning)
  //
  // Columns (14):
  //   1=Sl  2=Owner Name  3=Truck No  4=Gross Payt  5=Taxable Value
  //   6=CGST  7=SGST  8=Round off  9=Invoice Value
  //   10=Diesel (per truck)  11=Total Diesel  12=Less Shortage
  //   13=Less TDS  14=Net Payment
  //
  // Layout per owner:
  //   - One row per truck (col 3=truck, col 4=gross pay, col 10=truck diesel)
  //   - Owner-level fields (Sl, Name, GST-related totals) in merged cells spanning
  //     all trucks of that owner.
  // ─────────────────────────────────────────────────────────────────────────────
  renderGstSheet(srcSheet, outSheet, list, fromStr, toStr) {
    const COL_COUNT = 14;

    // 1. Copy rows 1-3 verbatim (company, title, headers)
    for (let r = 1; r <= 3; r++) {
      this.copyRow(srcSheet.getRow(r), outSheet.getRow(r), COL_COUNT);
    }

    // Apply merged cells for rows 1-3
    (srcSheet.model.merges || []).forEach(rangeStr => {
      const m = rangeStr.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (!m) return;
      const r1 = parseInt(m[2], 10);
      if (r1 > 3) return;
      try {
        outSheet.mergeCells(rangeStr);
      } catch (_) {}
    });

    // 2. Update the title row with the actual date range
    // Keep the company name in row 1 as-is from template
    // Update row 2's first cell only (it's merged across the whole row)
    outSheet.getRow(2).getCell(1).value =
      `TRUCK PAYMENT DETAILS FOR THE PERIOD FROM ${fromStr} to ${toStr} (WITH GST)`;

    // Copy column widths
    for (let c = 1; c <= COL_COUNT; c++) {
      const srcCol = srcSheet.getColumn(c);
      if (srcCol.width) outSheet.getColumn(c).width = srcCol.width;
    }

    // 3. Data template row (row 4 of src)
    const tDataRow  = srcSheet.getRow(4);
    const dataHeight = tDataRow.height || 22;

    let currRow = 4; // data starts at row 4 (overwriting template data row)
    let serial  = 1;

    list.forEach(owner => {
      const ownerStartRow = currRow;
      const truckCount    = owner.trucks.length || 1;

      owner.trucks.forEach((truck, tIdx) => {
        const row = outSheet.getRow(currRow);
        row.height = dataHeight;

        // Apply template styles to all cells first
        for (let c = 1; c <= COL_COUNT; c++) {
          this.copyCellStyles(tDataRow.getCell(c), row.getCell(c));
        }

        // Per-truck columns (always filled for each truck row)
        row.getCell(3).value  = truck.truckNumber;           // Truck No
        row.getCell(4).value  = Math.round(truck.grossPay);  // Gross Payt (per truck)
        row.getCell(10).value = Math.round(truck.diesel);    // Diesel (per truck)

        // Owner-level columns: only fill on the first truck row of this owner
        if (tIdx === 0) {
          row.getCell(1).value  = serial++;
          row.getCell(2).value  = owner.ownerName;
          row.getCell(5).value  = Math.round(owner.totals.taxableValue);   // Taxable Value
          row.getCell(6).value  = Math.round(owner.totals.cgst);           // CGST
          row.getCell(7).value  = Math.round(owner.totals.sgst);           // SGST
          row.getCell(8).value  = owner.totals.roundOff;                   // Round off (keep decimal)
          row.getCell(9).value  = Math.round(owner.totals.invoiceValue);   // Invoice Value
          row.getCell(11).value = Math.round(owner.totals.totalDiesel);    // Total Diesel
          row.getCell(12).value = Math.round(owner.totals.lessShortage);   // Less Shortage
          row.getCell(13).value = Math.round(owner.totals.tds);            // Less TDS
          row.getCell(14).value = Math.round(owner.totals.netPayment);     // Net Payment
        }

        row.commit();
        currRow++;
      });

      // Merge owner-level columns vertically if more than 1 truck
      if (truckCount > 1) {
        const ownerCols = [1, 2, 5, 6, 7, 8, 9, 11, 12, 13, 14];
        ownerCols.forEach(col => {
          try {
            outSheet.mergeCells(ownerStartRow, col, ownerStartRow + truckCount - 1, col);
          } catch (_) {}
        });
      }
    });

    // 4. Grand total row
    const grandTotalRow = outSheet.getRow(currRow);
    grandTotalRow.height = dataHeight;
    for (let c = 1; c <= COL_COUNT; c++) {
      this.copyCellStyles(tDataRow.getCell(c), grandTotalRow.getCell(c));
    }
    grandTotalRow.getCell(2).value = 'TOTAL';

    if (currRow > 4) {
      const endData = currRow - 1;
      grandTotalRow.getCell(4).value  = { formula: `=SUM(D4:D${endData})` };
      grandTotalRow.getCell(5).value  = { formula: `=SUM(E4:E${endData})` };
      grandTotalRow.getCell(6).value  = { formula: `=SUM(F4:F${endData})` };
      grandTotalRow.getCell(7).value  = { formula: `=SUM(G4:G${endData})` };
      grandTotalRow.getCell(9).value  = { formula: `=SUM(I4:I${endData})` };
      grandTotalRow.getCell(10).value = { formula: `=SUM(J4:J${endData})` };
      grandTotalRow.getCell(11).value = { formula: `=SUM(K4:K${endData})` };
      grandTotalRow.getCell(12).value = { formula: `=SUM(L4:L${endData})` };
      grandTotalRow.getCell(13).value = { formula: `=SUM(M4:M${endData})` };
      grandTotalRow.getCell(14).value = { formula: `=SUM(N4:N${endData})` };
    }
    grandTotalRow.commit();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RCM PAYMENT SHEET
  //
  // Template rows:
  //   Row 1 = Company name (merged A1:K1)
  //   Row 2 = Title with date range (merged A2:K2)
  //   Row 3 = Headers
  //   Row 4 = Data row template
  //
  // Columns (11):
  //   1=Sl  2=Owner Name  3=Truck No  4=Gross Payt (per truck)
  //   5=Total Payt (owner sum)  6=Less Diesel (per truck)  7=Total Diesel
  //   8=Gross Payt after diesel  9=Less TDS  10=Less Shortage  11=Total Payt (net)
  // ─────────────────────────────────────────────────────────────────────────────
  renderRcmSheet(srcSheet, outSheet, list, fromStr, toStr) {
    const COL_COUNT = 11;

    for (let r = 1; r <= 3; r++) {
      this.copyRow(srcSheet.getRow(r), outSheet.getRow(r), COL_COUNT);
    }

    (srcSheet.model.merges || []).forEach(rangeStr => {
      const m = rangeStr.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (!m) return;
      if (parseInt(m[2], 10) > 3) return;
      try {
        outSheet.mergeCells(rangeStr);
      } catch (_) {}
    });

    outSheet.getRow(2).getCell(1).value =
      `TRUCK PAYMENT DETAILS FOR THE PERIOD FROM ${fromStr} to ${toStr} (RCM)`;

    for (let c = 1; c <= COL_COUNT; c++) {
      const srcCol = srcSheet.getColumn(c);
      if (srcCol.width) outSheet.getColumn(c).width = srcCol.width;
    }

    const tDataRow   = srcSheet.getRow(4);
    const dataHeight = tDataRow.height || 22;

    let currRow = 4;
    let serial  = 1;

    list.forEach(owner => {
      const ownerStartRow = currRow;
      const truckCount    = owner.trucks.length || 1;

      owner.trucks.forEach((truck, tIdx) => {
        const row = outSheet.getRow(currRow);
        row.height = dataHeight;

        for (let c = 1; c <= COL_COUNT; c++) {
          this.copyCellStyles(tDataRow.getCell(c), row.getCell(c));
        }

        // Per-truck: Truck No, Gross Payt, Less Diesel
        row.getCell(3).value = truck.truckNumber;
        row.getCell(4).value = Math.round(truck.grossPay);   // Gross Payt (per truck)
        row.getCell(6).value = Math.round(truck.diesel);     // Less Diesel (per truck)

        // Owner-level: only on first truck row
        if (tIdx === 0) {
          row.getCell(1).value  = serial++;
          row.getCell(2).value  = owner.ownerName;
          row.getCell(5).value  = Math.round(owner.totals.totalPay);          // Total Payt (gross)
          row.getCell(7).value  = Math.round(owner.totals.totalDiesel);       // Total Diesel
          row.getCell(8).value  = Math.round(owner.totals.grossAfterDiesel);  // Gross after diesel
          row.getCell(9).value  = Math.round(owner.totals.tds);               // Less TDS
          row.getCell(10).value = Math.round(owner.totals.shortage);          // Less Shortage
          row.getCell(11).value = Math.round(owner.totals.netPayment);        // Total Payt (net)
        }

        row.commit();
        currRow++;
      });

      if (truckCount > 1) {
        const ownerCols = [1, 2, 5, 7, 8, 9, 10, 11];
        ownerCols.forEach(col => {
          try {
            outSheet.mergeCells(ownerStartRow, col, ownerStartRow + truckCount - 1, col);
          } catch (_) {}
        });
      }
    });

    // Grand total row
    const grandTotalRow = outSheet.getRow(currRow);
    grandTotalRow.height = dataHeight;
    for (let c = 1; c <= COL_COUNT; c++) {
      this.copyCellStyles(tDataRow.getCell(c), grandTotalRow.getCell(c));
    }
    grandTotalRow.getCell(2).value = 'TOTAL';

    if (currRow > 4) {
      const endData = currRow - 1;
      grandTotalRow.getCell(4).value  = { formula: `=SUM(D4:D${endData})` };
      grandTotalRow.getCell(5).value  = { formula: `=SUM(E4:E${endData})` };
      grandTotalRow.getCell(6).value  = { formula: `=SUM(F4:F${endData})` };
      grandTotalRow.getCell(7).value  = { formula: `=SUM(G4:G${endData})` };
      grandTotalRow.getCell(8).value  = { formula: `=SUM(H4:H${endData})` };
      grandTotalRow.getCell(9).value  = { formula: `=SUM(I4:I${endData})` };
      grandTotalRow.getCell(10).value = { formula: `=SUM(J4:J${endData})` };
      grandTotalRow.getCell(11).value = { formula: `=SUM(K4:K${endData})` };
    }
    grandTotalRow.commit();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHEQUE DETAILS SHEET
  //
  // Template rows:
  //   Row 1 = Company name (merged A1:G1)
  //   Row 2 = Title with date range (merged A2:G2)
  //   Row 3 = Headers
  //   Row 4 = Data row template
  //
  // Columns (7):
  //   1=Sl  2=Owner Name  3=Net Payment  4=Cheque Date  5=Cheque No
  //   6=Total Amount  7=Cheque Amt
  //
  // One row per owner (no per-truck breakdown).
  // ─────────────────────────────────────────────────────────────────────────────
  renderChequeSheet(srcSheet, outSheet, summaries, fromStr, toStr) {
    const COL_COUNT = 7;

    for (let r = 1; r <= 3; r++) {
      this.copyRow(srcSheet.getRow(r), outSheet.getRow(r), COL_COUNT);
    }

    (srcSheet.model.merges || []).forEach(rangeStr => {
      const m = rangeStr.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (!m) return;
      if (parseInt(m[2], 10) > 3) return;
      try {
        outSheet.mergeCells(rangeStr);
      } catch (_) {}
    });

    outSheet.getRow(2).getCell(1).value =
      `CHEQUE DETAILS FOR THE PERIOD FROM ${fromStr} to ${toStr}`;

    for (let c = 1; c <= COL_COUNT; c++) {
      const srcCol = srcSheet.getColumn(c);
      if (srcCol.width) outSheet.getColumn(c).width = srcCol.width;
    }

    const tDataRow   = srcSheet.getRow(4);
    const dataHeight = tDataRow.height || 20;

    let currRow = 4;
    let serial  = 1;

    summaries.forEach(owner => {
      const row = outSheet.getRow(currRow);
      row.height = dataHeight;

      for (let c = 1; c <= COL_COUNT; c++) {
        this.copyCellStyles(tDataRow.getCell(c), row.getCell(c));
      }

      row.getCell(1).value = serial++;
      row.getCell(2).value = owner.ownerName;
      row.getCell(3).value = Math.round(owner.totals.netPayment); // Net Payment
      row.getCell(4).value = '';  // Cheque Date (to be filled manually)
      row.getCell(5).value = '';  // Cheque No   (to be filled manually)
      row.getCell(6).value = '';  // Total Amount (to be filled manually)
      row.getCell(7).value = '';  // Cheque Amt   (to be filled manually)

      row.commit();
      currRow++;
    });

    // Grand total row
    const grandTotalRow = outSheet.getRow(currRow);
    grandTotalRow.height = dataHeight;
    for (let c = 1; c <= COL_COUNT; c++) {
      this.copyCellStyles(tDataRow.getCell(c), grandTotalRow.getCell(c));
    }
    grandTotalRow.getCell(2).value = 'TOTAL';
    if (currRow > 4) {
      grandTotalRow.getCell(3).value = { formula: `=SUM(C4:C${currRow - 1})` };
    }
    grandTotalRow.commit();
  }
}

// Helper: convert column letter(s) like "A", "N", "AA" to column number
function colLetterToNum(letters) {
  let num = 0;
  for (let i = 0; i < letters.length; i++) {
    num = num * 26 + (letters.charCodeAt(i) - 64);
  }
  return num;
}

module.exports = new JointReportService();
