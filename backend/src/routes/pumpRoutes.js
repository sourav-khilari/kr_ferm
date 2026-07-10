const express = require('express');
const router = express.Router();
const Pump = require('../models/Pump');

// Get active pumps
router.get('/', async (req, res, next) => {
  try {
    const list = await Pump.find({ status: 'Active' }).sort({ name: 1 });
    res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
});

// Full pageable list for management
router.get('/all', async (req, res, next) => {
  try {
    const list = await Pump.find().sort({ name: 1 });
    res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
});

// Create pump
router.post('/', async (req, res, next) => {
  try {
    const newPump = new Pump(req.body);
    await newPump.save();
    res.status(201).json({ success: true, data: newPump });
  } catch (error) {
    next(error);
  }
});

// Update pump
router.put('/:id', async (req, res, next) => {
  try {
    const updated = await Pump.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// Delete pump
router.delete('/:id', async (req, res, next) => {
  try {
    await Pump.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Pump deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
