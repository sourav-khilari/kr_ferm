const Truck = require('../models/Truck');

class TruckService {
  async createTruck(data) {
    if (data.truckNumber) {
      data.truckNumber = data.truckNumber.toUpperCase().trim();
    }
    const truck = new Truck(data);
    return await (await truck.save()).populate('owner');
  }

  async getAllTrucks({ search = '', page = 1, limit = 10 }) {
    const query = {};
    if (search) {
      query.truckNumber = { $regex: search, $options: 'i' };
    }
    const skip = (page - 1) * limit;
    const items = await Truck.find(query)
      .populate('owner')
      .sort({ truckNumber: 1 })
      .skip(skip)
      .limit(Number(limit));
    const total = await Truck.countDocuments(query);
    return { items, total, page: Number(page), pages: Math.ceil(total / limit) };
  }

  async getTruckById(id) {
    return await Truck.findById(id).populate('owner');
  }

  async updateTruck(id, data) {
    if (data.truckNumber) {
      data.truckNumber = data.truckNumber.toUpperCase().trim();
    }
    return await Truck.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('owner');
  }

  async deleteTruck(id) {
    return await Truck.findByIdAndDelete(id);
  }

  async findByTruckNumber(truckNumber) {
    return await Truck.findOne({ truckNumber: truckNumber.toUpperCase().trim() }).populate('owner');
  }
}

module.exports = new TruckService();
