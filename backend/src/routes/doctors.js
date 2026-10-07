const { Router } = require('express');
const DoctorService = require('../services/DoctorService');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { departmentId } = req.query;
    const doctors = await DoctorService.listDoctors(departmentId || null);
    res.json(doctors);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
