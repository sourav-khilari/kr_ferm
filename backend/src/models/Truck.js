const mongoose = require('mongoose');

const truckSchema = new mongoose.Schema({
  truckNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true
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

module.exports = mongoose.model('Truck', truckSchema);
