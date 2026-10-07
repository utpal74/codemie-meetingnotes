const { Router } = require('express');
const prisma = require('../lib/prisma');

const router = Router();

router.get('/', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', uptime: Math.floor(process.uptime()) });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected', uptime: Math.floor(process.uptime()) });
  }
});

module.exports = router;
