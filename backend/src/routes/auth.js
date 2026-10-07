const { Router } = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { LoginSchema } = require('../schemas');
const { Errors } = require('../helpers/errors');
const logger = require('../helpers/logger');

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Try again in 15 minutes.', field: null } },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, validate(LoginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const expectedUsername = process.env.RECEPTIONIST_USERNAME || 'receptionist';
    const expectedHash = process.env.RECEPTIONIST_PASSWORD_HASH;

    if (!expectedHash) {
      logger.warn('RECEPTIONIST_PASSWORD_HASH not set — run: node scripts/hash-password.js');
      return res.status(503).json({
        error: { code: 'SERVER_MISCONFIGURED', message: 'Authentication not configured. Run setup script.', field: null },
      });
    }

    const usernameMatch = username === expectedUsername;
    const passwordMatch = await bcrypt.compare(password, expectedHash);

    if (!usernameMatch || !passwordMatch) {
      logger.warn({ username }, 'Failed login attempt');
      const err = Errors.INVALID_CREDENTIALS();
      return res.status(err.status).json({ error: { code: err.code, message: err.message, field: null } });
    }

    req.session.authenticated = true;
    logger.info({ username }, 'Receptionist logged in');
    res.json({ message: 'Login successful' });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authenticate, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

router.get('/me', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

module.exports = router;
