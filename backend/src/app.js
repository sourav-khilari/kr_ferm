const express = require('express');
const cors = require('cors');
const ownerRoutes = require('./routes/ownerRoutes');
const truckRoutes = require('./routes/truckRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const pumpRoutes = require('./routes/pumpRoutes');
const dieselRoutes = require('./routes/dieselRoutes');
const dieselReportRoutes = require('./routes/dieselReportRoutes');
const summaryRoutes = require('./routes/summaryRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/owners', ownerRoutes);
app.use('/api/trucks', truckRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/pumps', pumpRoutes);
app.use('/api/diesel', dieselRoutes);
app.use('/api/diesel-report', dieselReportRoutes);
app.use('/api/summary', summaryRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

module.exports = app;
