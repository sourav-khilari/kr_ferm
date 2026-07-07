const Owner = require('../models/Owner');

class OwnerService {
  async createOwner(data) {
    const owner = new Owner(data);
    return await owner.save();
  }

  async getAllOwners({ search = '', page = 1, limit = 10 }) {
    const query = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    const skip = (page - 1) * limit;
    const items = await Owner.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(Number(limit));
    const total = await Owner.countDocuments(query);
    return { items, total, page: Number(page), pages: Math.ceil(total / limit) };
  }

  async getOwnerById(id) {
    return await Owner.findById(id);
  }

  async updateOwner(id, data) {
    return await Owner.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async deleteOwner(id) {
    return await Owner.findByIdAndDelete(id);
  }

  async searchOwners(q) {
    return await Owner.find({ name: { $regex: q, $options: 'i' } }).limit(20);
  }
}

module.exports = new OwnerService();
