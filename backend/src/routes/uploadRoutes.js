const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

// Upload & validate
router.post('/validate', uploadController.uploadMiddleware, uploadController.validateUpload);
// Save confirmed rows to DB
router.post('/save', uploadController.saveUpload);
// Upload run history
router.get('/history', uploadController.getUploadHistory);
// Get rows for a specific run
router.get('/run/:runId/rows', uploadController.getRunRows);
// Delete an entire upload run + its rows
router.delete('/run/:runId', uploadController.deleteRun);
// All uploaded rows – list with filters
router.get('/records', uploadController.getAllRows);
// Edit a single row
router.put('/records/:rowId', uploadController.updateRow);
// Delete a single row
router.delete('/records/:rowId', uploadController.deleteRow);

module.exports = router;
