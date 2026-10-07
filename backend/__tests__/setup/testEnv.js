// Set all env vars BEFORE any module is required.
// dotenv.config() in app.js will NOT override these.
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/appointments_test';
process.env.SESSION_SECRET = 'test-session-secret-32-chars-long!!';
process.env.RECEPTIONIST_USERNAME = 'receptionist';
// bcrypt hash of 'admin123'
process.env.RECEPTIONIST_PASSWORD_HASH = '$2b$10$W067FU19fpt6QZWzObWZ.u5MvGZYDw9ocfYA6oaRhMjEo6ukeXyI2';
process.env.PHONE_HMAC_SECRET = 'test-hmac-secret-for-unit-and-integration-tests';
process.env.PHONE_ENCRYPTION_KEY = '0000000000000000000000000000000000000000000000000000000000000000';
process.env.ALLOWED_ORIGIN = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.PORT = '4001';
process.env.TWILIO_ACCOUNT_SID = '';
process.env.TWILIO_AUTH_TOKEN = '';
