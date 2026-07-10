const mongoose = require('mongoose');

const dieselRowSchema = new mongoose.Schema({
  pump: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pump',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  slNo: {
    type: String,
    default: '',
    trim: true
  },
  vehicleNo: {
    type: String,
    uppercase: true,
    trim: true,
    required: true
  },
  product: {
    type: String,
    default: '',
    trim: true
  },
  qty: {
    type: Number,
    default: 0
  },
  rate: {
    type: Number,
    default: 0
  },
  amount: {
    type: Number,
    default: 0
  },
  matchedOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    default: null
  },
  uploadRun: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UploadRun',
    required: true
  },
  validationStatus: {
    type: String,
    enum: ['valid', 'warning', 'error'],
    default: 'valid'
  },
  rowErrors: {
    type: [String],
    default: []
  },
  rowWarnings: {
    type: [String],
    default: []
  },
  createdDate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DieselRow', dieselRowSchema);
