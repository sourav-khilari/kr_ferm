const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');

router.post('/', ownerController.createOwner);
router.get('/', ownerController.getAllOwners);
router.get('/search', ownerController.searchOwners);
router.get('/:id', ownerController.getOwnerById);
router.put('/:id', ownerController.updateOwner);
router.delete('/:id', ownerController.deleteOwner);

module.exports = router;
