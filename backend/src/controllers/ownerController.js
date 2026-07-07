const ownerService = require('../services/ownerService');

exports.createOwner = async (req, res, next) => {
  try {
    const owner = await ownerService.createOwner(req.body);
    res.status(201).json({ success: true, data: owner });
  } catch (error) {
    next(error);
  }
};

exports.getAllOwners = async (req, res, next) => {
  try {
    const { search, page, limit } = req.query;
    const result = await ownerService.getAllOwners({ search, page, limit });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

exports.getOwnerById = async (req, res, next) => {
  try {
    const owner = await ownerService.getOwnerById(req.params.id);
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }
    res.status(200).json({ success: true, data: owner });
  } catch (error) {
    next(error);
  }
};

exports.updateOwner = async (req, res, next) => {
  try {
    const owner = await ownerService.updateOwner(req.params.id, req.body);
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }
    res.status(200).json({ success: true, data: owner });
  } catch (error) {
    next(error);
  }
};

exports.deleteOwner = async (req, res, next) => {
  try {
    const owner = await ownerService.deleteOwner(req.params.id);
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }
    res.status(200).json({ success: true, message: 'Owner deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.searchOwners = async (req, res, next) => {
  try {
    const owners = await ownerService.searchOwners(req.query.q || '');
    res.status(200).json({ success: true, data: owners });
  } catch (error) {
    next(error);
  }
};
