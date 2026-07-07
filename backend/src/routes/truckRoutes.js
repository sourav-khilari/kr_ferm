const express = require('express');
const router = express.Router();
const truckController = require('../controllers/truckController');

router.post('/', truckController.createTruck);
router.get('/', truckController.getAllTrucks);
router.get('/:id', truckController.getTruckById);
router.put('/:id', truckController.updateTruck);
router.delete('/:id', truckController.deleteTruck);

module.exports = router;
