const mongoose = require('mongoose');

const uploadedRowSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  challanNo: {
    type: String,
    trim: true,
    default: ''
  },
  partyName: {
    type: String,
    trim: true,
    default: ''
  },
  destination: {
    type: String,
    trim: true,
    default: ''
  },
  truckNumber: {
    type: String,
    uppercase: true,
    trim: true,
    default: ''
  },
  qty: {
    type: Number,
    default: 0
  },
  rate: {
    type: Number,
    default: 0
  },
  gross: {
    type: Number,
    default: 0
  },
  comm: {
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

module.exports = mongoose.model('UploadedRow', uploadedRowSchema);
