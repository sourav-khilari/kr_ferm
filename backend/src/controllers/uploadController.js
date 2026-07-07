const uploadService = require('../services/uploadService');
const multer = require('multer');

// Configure multer for memory storage
const storage = multer.memoryStorage();
exports.uploadMiddleware = multer({ storage: storage }).single('file');

// POST /api/upload/validate  — parse + validate (no DB save)
exports.validateUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }
    const report = await uploadService.validateExcel(req.file.buffer, req.file.originalname);
    res.status(200).json({ success: true, report });
  } catch (error) {
    next(error);
  }
};

// POST /api/upload/save  — persist parsed rows (only if no critical errors)
exports.saveUpload = async (req, res, next) => {
  try {
    const { fileName, rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows to save' });
    }
    // Block save if any row has critical errors
    const hasBlockingErrors = rows.some(r => r.rowErrors && r.rowErrors.length > 0);
    if (hasBlockingErrors) {
      return res.status(422).json({
        success: false,
        message: 'Cannot save: some rows have critical errors. Fix them before saving.'
      });
    }
    const uploadRun = await uploadService.saveUploadRun(fileName || 'UploadedSheet.xlsx', rows);
    res.status(201).json({ success: true, data: uploadRun });
  } catch (error) {
    next(error);
  }
};

// GET /api/upload/history  — list all upload runs
exports.getUploadHistory = async (req, res, next) => {
  try {
    const history = await uploadService.getHistory();
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

// GET /api/upload/run/:runId/rows  — get all rows for a given upload run
exports.getRunRows = async (req, res, next) => {
  try {
    const rows = await uploadService.getRunRows(req.params.runId);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/upload/run/:runId  — delete a run and all its rows
exports.deleteRun = async (req, res, next) => {
  try {
    await uploadService.deleteRun(req.params.runId);
    res.status(200).json({ success: true, message: 'Upload run deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// GET /api/upload/records  — get all uploaded rows (with filters + pagination)
exports.getAllRows = async (req, res, next) => {
  try {
    const result = await uploadService.getAllRows(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// PUT /api/upload/records/:rowId  — edit a single uploaded row
exports.updateRow = async (req, res, next) => {
  try {
    const updated = await uploadService.updateRow(req.params.rowId, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Row not found' });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/upload/records/:rowId  — delete a single row
exports.deleteRow = async (req, res, next) => {
  try {
    const deleted = await uploadService.deleteRow(req.params.rowId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Row not found' });
    res.status(200).json({ success: true, message: 'Row deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
