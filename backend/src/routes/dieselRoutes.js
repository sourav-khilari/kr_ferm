const express = require('express');
const router = express.Router();
const dieselService = require('../services/dieselService');
const multer = require('multer');

const storage = multer.memoryStorage();
const uploadMiddleware = multer({ storage: storage }).single('file');

// Parse & Validate
router.post('/validate', uploadMiddleware, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }
    const report = await dieselService.validateExcel(req.file.buffer, req.file.originalname);
    res.status(200).json({ success: true, report });
  } catch (error) {
    next(error);
  }
});

// Save Rows
router.post('/save', async (req, res, next) => {
  try {
    const { fileName, pumpId, rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows to save' });
    }
    if (!pumpId) {
      return res.status(400).json({ success: false, message: 'Please select a pump' });
    }
    const hasBlockingErrors = rows.some(r => r.rowErrors && r.rowErrors.length > 0);
    if (hasBlockingErrors) {
      return res.status(422).json({
        success: false,
        message: 'Cannot save: some rows have critical errors. Fix them before saving.'
      });
    }
    const uploadRun = await dieselService.saveUploadRun(fileName, pumpId, rows);
    res.status(201).json({ success: true, data: uploadRun });
  } catch (error) {
    next(error);
  }
});

// History Logs
router.get('/history', async (req, res, next) => {
  try {
    const history = await dieselService.getHistory();
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

// Run Details
router.get('/run/:runId/rows', async (req, res, next) => {
  try {
    const rows = await dieselService.getRunRows(req.params.runId);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.delete('/run/:runId', async (req, res, next) => {
  try {
    await dieselService.deleteRun(req.params.runId);
    res.status(200).json({ success: true, message: 'Upload run deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

// All Rows List
router.get('/records', async (req, res, next) => {
  try {
    const result = await dieselService.getAllRows(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Edit & Delete row
router.put('/records/:rowId', async (req, res, next) => {
  try {
    const updated = await dieselService.updateRow(req.params.rowId, req.body);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/records/:rowId', async (req, res, next) => {
  try {
    await dieselService.deleteRow(req.params.rowId);
    res.status(200).json({ success: true, message: 'Record deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
