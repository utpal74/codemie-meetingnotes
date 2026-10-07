require('dotenv').config();
const app = require('./app');
const logger = require('./helpers/logger');
const { startRetryJob } = require('./jobs/smsRetryJob');
const bcrypt = require('bcrypt');

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  // Auto-generate password hash in dev if not set
  if (!process.env.RECEPTIONIST_PASSWORD_HASH && process.env.NODE_ENV !== 'production') {
    const hash = await bcrypt.hash('admin123', 10);
    process.env.RECEPTIONIST_PASSWORD_HASH = hash;
    logger.warn(
      { hash },
      'RECEPTIONIST_PASSWORD_HASH not set. Using default password "admin123". ' +
      'Run: node scripts/hash-password.js and add to .env'
    );
  }

  app.listen(PORT, () => {
    logger.info({ port: PORT }, `API server listening`);
    startRetryJob();
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
