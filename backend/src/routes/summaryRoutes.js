const express = require('express');
const router = express.Router();
const ownerSummaryService = require('../services/ownerSummaryService');
const jointReportService = require('../services/jointReportService');

// Get combined JSON summary for GST/RCM/Cheque preview
router.get('/preview', async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'Please provide both fromDate and toDate' });
    }
    const data = await ownerSummaryService.getOwnerSummary({ fromDate, toDate });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Download joint report Excel workbook
router.get('/download', async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'Please provide both fromDate and toDate' });
    }
    const buffer = await jointReportService.generateWorkbook({ fromDate, toDate });

    const formattedFrom = fromDate.replace(/-/g, '');
    const formattedTo = toDate.replace(/-/g, '');
    const fileName = `Joint_Payment_Summary_${formattedFrom}_to_${formattedTo}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
