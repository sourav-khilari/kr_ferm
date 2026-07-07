const mongoose = require('mongoose');

const ownerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  gstApplicable: {
    type: Boolean,
    default: false
  },
  gstNumber: {
    type: String,
    trim: true,
    default: ''
  },
  tdsPercentage: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  createdDate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Owner', ownerSchema);
