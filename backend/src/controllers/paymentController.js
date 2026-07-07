const paymentService = require('../services/paymentService');

exports.getPreview = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'Please provide both fromDate and toDate' });
    }

    const preview = await paymentService.getPreview({ fromDate, toDate });
    res.status(200).json({ success: true, data: preview });
  } catch (error) {
    next(error);
  }
};

exports.updateRows = async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ success: false, message: 'Invalid rows data provided' });
    }

    const updated = await paymentService.updateRows(rows);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.generateExcel = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'Please provide both fromDate and toDate' });
    }

    const buffer = await paymentService.generateExcel({ fromDate, toDate });

    // Format download filename
    const formattedFrom = fromDate.replace(/-/g, '');
    const formattedTo = toDate.replace(/-/g, '');
    const fileName = `Payment_Sheet_${formattedFrom}_to_${formattedTo}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};
