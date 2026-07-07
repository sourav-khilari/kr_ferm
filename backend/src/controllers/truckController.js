const truckService = require('../services/truckService');

exports.createTruck = async (req, res, next) => {
  try {
    // Check if truck number already exists
    const existing = await truckService.findByTruckNumber(req.body.truckNumber);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Truck number already exists in master data' });
    }

    const truck = await truckService.createTruck(req.body);
    res.status(201).json({ success: true, data: truck });
  } catch (error) {
    next(error);
  }
};

exports.getAllTrucks = async (req, res, next) => {
  try {
    const { search, page, limit } = req.query;
    const result = await truckService.getAllTrucks({ search, page, limit });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.getTruckById = async (req, res, next) => {
  try {
    const truck = await truckService.getTruckById(req.params.id);
    if (!truck) {
      return res.status(404).json({ success: false, message: 'Truck not found' });
    }
    res.status(200).json({ success: true, data: truck });
  } catch (error) {
    next(error);
  }
};

exports.updateTruck = async (req, res, next) => {
  try {
    const truck = await truckService.updateTruck(req.params.id, req.body);
    if (!truck) {
      return res.status(404).json({ success: false, message: 'Truck not found' });
    }
    res.status(200).json({ success: true, data: truck });
  } catch (error) {
    next(error);
  }
};

exports.deleteTruck = async (req, res, next) => {
  try {
    const truck = await truckService.deleteTruck(req.params.id);
    if (!truck) {
      return res.status(404).json({ success: false, message: 'Truck not found' });
    }
    res.status(200).json({ success: true, message: 'Truck deleted successfully' });
  } catch (error) {
    next(error);
  }
};
