require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const logger = require('./helpers/logger');
const { authenticate } = require('./middleware/authenticate');
const { requireRole } = require('./middleware/requireRole');

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const departmentsRouter = require('./routes/departments');
const doctorsRouter = require('./routes/doctors');
const slotsRouter = require('./routes/slots');
const appointmentsRouter = require('./routes/appointments');

const adminDepartmentsRouter = require('./routes/admin/departments');
const adminDoctorsRouter = require('./routes/admin/doctors');

const app = express();

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json());

app.use(pinoHttp({ logger }));

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET environment variable is required in production');
}
app.use(
  session({
    secret: sessionSecret || 'dev-secret-not-for-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Public routes
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);

// Protected routes — require a valid session
app.use('/api/departments', authenticate, departmentsRouter);
app.use('/api/doctors', authenticate, doctorsRouter);
app.use('/api/slots', authenticate, slotsRouter);
app.use('/api/appointments', authenticate, appointmentsRouter);

// Admin routes — require ADMIN role
app.use('/api/admin/departments', authenticate, requireRole('ADMIN'), adminDepartmentsRouter);
app.use('/api/admin/doctors', authenticate, requireRole('ADMIN'), adminDoctorsRouter);

// Global error handler — only domain errors (status < 500) expose their message
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) logger.error({ err }, 'Internal server error');
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: status < 500 ? err.message : 'An unexpected error occurred',
      field: err.field || null,
    },
  });
});

module.exports = app;
