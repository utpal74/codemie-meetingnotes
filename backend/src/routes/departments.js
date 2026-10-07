const { Router } = require('express');
const DoctorService = require('../services/DoctorService');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const departments = await DoctorService.listDepartments();
    res.json(departments);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
