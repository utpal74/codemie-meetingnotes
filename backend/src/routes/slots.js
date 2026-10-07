const { Router } = require('express');
const SlotService = require('../services/SlotService');
const { Errors } = require('../helpers/errors');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(422).json({
        error: { code: 'MISSING_PARAMS', message: 'doctorId and date are required', field: null },
      });
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return res.status(422).json({
        error: { code: 'INVALID_DATE', message: 'Invalid date format', field: 'date' },
      });
    }
    if (d.getUTCDay() === 0) {
      const err = Errors.INVALID_DATE();
      return res.status(err.status).json({ error: { code: err.code, message: err.message, field: 'date' } });
    }

    const slots = await SlotService.getAvailableSlots(doctorId, date);
    res.json({ date, doctorId, availableSlots: slots });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
