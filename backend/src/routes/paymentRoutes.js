const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.get('/preview', paymentController.getPreview);
router.put('/update-rows', paymentController.updateRows);
router.get('/generate-excel', paymentController.generateExcel);

module.exports = router;
