const express = require('express');
const router = express.Router();
const path = require('path');
const ExcelJS = require('exceljs');
const dieselService = require('../services/dieselService');

// Get preview logic (Diesel logs grouped by Owner -> Truck -> Diesel Rows)
router.get('/preview-report', async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'Please provide both fromDate and toDate' });
    }
    const start = new Date(fromDate);
    start.setHours(0,0,0,0);
    const end = new Date(toDate);
    end.setHours(23,59,59,999);

    const rows = await require('../models/DieselRow').find({
      date: { $gte: start, $lte: end }
    }).populate('matchedOwner').populate('pump');

    // Sort: Owner -> Truck -> Date -> SlNo
    rows.sort((a, b) => {
      const ownerA = a.matchedOwner ? a.matchedOwner.name.toLowerCase() : 'zzz';
      const ownerB = b.matchedOwner ? b.matchedOwner.name.toLowerCase() : 'zzz';
      if (ownerA !== ownerB) return ownerA.localeCompare(ownerB);

      const truckA = a.vehicleNo.toLowerCase();
      const truckB = b.vehicleNo.toLowerCase();
      if (truckA !== truckB) return truckA.localeCompare(truckB);

      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;

      return (a.slNo || '').toLowerCase().localeCompare((b.slNo || '').toLowerCase());
    });

    const groups = [];
    const seen = new Map();

    rows.forEach(row => {
      const tNum = row.vehicleNo.toUpperCase().trim();
      if (!seen.has(tNum)) {
        seen.set(tNum, groups.length);
        groups.push({
          truckNumber: tNum,
          ownerName: row.matchedOwner ? row.matchedOwner.name : 'Unknown Owner',
          _ownerId: row.matchedOwner ? String(row.matchedOwner._id) : '__unknown__',
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

    res.status(200).json({ success: true, data: groups });
  } catch (error) {
    next(error);
  }
});

// Download Diesel Detail Excel Report
router.get('/generate-excel', async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'Please provide both fromDate and toDate' });
    }

    const templatePath = path.join(__dirname, '..', 'template', 'Payment_Template.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const srcSheet = workbook.worksheets[0];

    const headerRowTemp = srcSheet.getRow(3);
    const headerHeight  = headerRowTemp.height;
    const headerStyles  = [];
    const headerValues  = [];
    for (let c = 1; c <= 7; c++) {
      headerStyles.push(headerRowTemp.getCell(c));
      headerValues.push(headerRowTemp.getCell(c).value);
    }
    // Rename headers
    headerValues[0] = 'Date';
    headerValues[1] = 'Sl No';
    headerValues[2] = 'Product';
    headerValues[3] = 'Pump';
    headerValues[4] = 'Vehicle No';
    headerValues[5] = 'Qty';
    headerValues[6] = 'Amount';

    const dataRowTemp = srcSheet.getRow(4);
    const dataHeight  = dataRowTemp.height;
    const dataStyles  = [];
    for (let c = 1; c <= 7; c++) dataStyles.push(dataRowTemp.getCell(c));

    const totalRowTemp = srcSheet.getRow(5);
    const totalHeight  = totalRowTemp.height;
    const totalStyles  = [];
    for (let c = 1; c <= 7; c++) totalStyles.push(totalRowTemp.getCell(c));

    const blankHeight = dataHeight || 18;

    const fromDateStr = formatDate(new Date(fromDate));
    const toDateStr   = formatDate(new Date(toDate));
    srcSheet.getCell('A1').value = `DIESEL SHEET FOR THE PERIOD FROM ${fromDateStr} TO ${toDateStr}`;

    const start = new Date(fromDate);
    start.setHours(0,0,0,0);
    const end = new Date(toDate);
    end.setHours(23,59,59,999);

    const rows = await require('../models/DieselRow').find({
      date: { $gte: start, $lte: end }
    }).populate('matchedOwner').populate('pump');

    rows.sort((a, b) => {
      const ownerA = a.matchedOwner ? a.matchedOwner.name.toLowerCase() : 'zzz';
      const ownerB = b.matchedOwner ? b.matchedOwner.name.toLowerCase() : 'zzz';
      if (ownerA !== ownerB) return ownerA.localeCompare(ownerB);

      const truckA = a.vehicleNo.toLowerCase();
      const truckB = b.vehicleNo.toLowerCase();
      if (truckA !== truckB) return truckA.localeCompare(truckB);

      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;

      return (a.slNo || '').toLowerCase().localeCompare((b.slNo || '').toLowerCase());
    });

    const groups = [];
    const seen = new Map();

    rows.forEach(row => {
      const tNum = row.vehicleNo.toUpperCase().trim();
      if (!seen.has(tNum)) {
        seen.set(tNum, groups.length);
        groups.push({
          truckNumber: tNum,
          _ownerId: row.matchedOwner ? String(row.matchedOwner._id) : '__unknown__',
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

    srcSheet.spliceRows(3, 3);

    let currentExcelRow = 3;
    let pageStartRow = 3; 
    const rowsPerPage = 58;

    const copyStyles = (src, dest) => {
      if (src.font) dest.font = JSON.parse(JSON.stringify(src.font));
      if (src.fill) dest.fill = JSON.parse(JSON.stringify(src.fill));
      if (src.border) dest.border = JSON.parse(JSON.stringify(src.border));
      if (src.alignment) dest.alignment = JSON.parse(JSON.stringify(src.alignment));
      if (src.protection) dest.protection = JSON.parse(JSON.stringify(src.protection));
      if (src.numFormat) dest.numFormat = src.numFormat;
    };

    const writeRow = (height, cells, tempRow) => {
      const exRow = srcSheet.getRow(currentExcelRow);
      exRow.height = height;
      if (tempRow) {
        exRow.hidden = tempRow.hidden;
        exRow.outlineLevel = tempRow.outlineLevel;
      }
      cells.forEach(({ col, value, style, numFormat }) => {
        const cell = exRow.getCell(col);
        if (value !== undefined) cell.value = value;
        if (style) copyStyles(style, cell);
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

    groups.forEach((group) => {
      const blockRowsCount = group.rows.length + 2;
      let extraSpacingCount = group.ownerChangeAfter ? 2 : 0;
      const totalRequiredRows = blockRowsCount + extraSpacingCount;
      const currentUsedRows = currentExcelRow - pageStartRow;

      if (currentUsedRows > 0 && (currentUsedRows + totalRequiredRows > rowsPerPage)) {
        const prevRow = srcSheet.getRow(currentExcelRow - 1);
        prevRow.addPageBreak();
        pageStartRow = currentExcelRow;
      }

      // Header: Date, Sl No, Product, Pump, Vehicle No, Qty, Amount
      writeRow(headerHeight, [
        { col: 1, value: 'Date', style: headerStyles[0] },
        { col: 2, value: 'Sl No', style: headerStyles[1] },
        { col: 3, value: 'Product', style: headerStyles[2] },
        { col: 4, value: 'Pump', style: headerStyles[3] },
        { col: 5, value: 'Vehicle No', style: headerStyles[4] },
        { col: 6, value: 'Qty', style: headerStyles[5] },
        { col: 7, value: 'Amount', style: headerStyles[6] }
      ], headerRowTemp);

      // Data Rows
      group.rows.forEach(item => {
        writeRow(dataHeight, [
          { col: 1, value: formatDate(item.date), style: dataStyles[0] },
          { col: 2, value: item.slNo, style: dataStyles[1] },
          { col: 3, value: item.product, style: dataStyles[2] },
          { col: 4, value: item.pump ? item.pump.name : '', style: dataStyles[3] },
          { col: 5, value: item.vehicleNo, style: dataStyles[4] },
          { col: 6, value: item.qty, style: dataStyles[5], numFormat: '#,##0.00' },
          { col: 7, value: Math.round(item.amount || 0), style: dataStyles[6], numFormat: '#,##0' }
        ], dataRowTemp);
      });

      // Total Row
      writeRow(totalHeight, [
        { col: 1, value: null, style: totalStyles[0] },
        { col: 2, value: null, style: totalStyles[1] },
        { col: 3, value: null, style: totalStyles[2] },
        { col: 4, value: null, style: totalStyles[3] },
        { col: 5, value: 'Total:', style: totalStyles[4] },
        { col: 6, value: group.totalQty, style: totalStyles[5], numFormat: '#,##0.00' },
        { col: 7, value: Math.round(group.totalAmount), style: totalStyles[6], numFormat: '#,##0' }
      ], totalRowTemp);

      if (group.ownerChangeAfter) {
        writeBlankRow();
        writeBlankRow();
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const formattedFrom = fromDate.replace(/-/g, '');
    const formattedTo = toDate.replace(/-/g, '');
    const fileName = `Diesel_Sheet_${formattedFrom}_to_${formattedTo}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

function formatDate(d) {
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}.${month}.${year}`;
}

module.exports = router;
