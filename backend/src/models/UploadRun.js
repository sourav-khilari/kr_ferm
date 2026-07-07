const mongoose = require('mongoose');

const uploadRunSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  totalRows: {
    type: Number,
    default: 0
  },
  validRows: {
    type: Number,
    default: 0
  },
  warningRows: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Completed'
  }
});

module.exports = mongoose.model('UploadRun', uploadRunSchema);
