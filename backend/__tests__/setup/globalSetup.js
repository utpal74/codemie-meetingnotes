const { execSync } = require('child_process');
const path = require('path');

const TEST_DB_URL = 'postgresql://postgres:postgres@localhost:5432/appointments_test';
const ROOT = path.join(__dirname, '../../');

const testEnv = {
  ...process.env,
  DATABASE_URL: TEST_DB_URL,
  PHONE_HMAC_SECRET: 'test-hmac-secret-for-unit-and-integration-tests',
  PHONE_ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
};

const DB_CONTAINER = 'doc-appointment-booking-db-1';

function dockerPsql(sql) {
  execSync(`docker exec ${DB_CONTAINER} psql -U postgres -c "${sql}"`, { stdio: 'pipe' });
}

module.exports = async () => {
  // In CI the workflow creates appointments_test, runs migrations, and seeds
  // before npm test is invoked — nothing to do here.
  if (process.env.CI) {
    console.log('\n[test setup] CI environment — database already prepared by workflow.\n');
    return;
  }

  console.log('\n[test setup] Creating test database...');
  try { dockerPsql('DROP DATABASE IF EXISTS appointments_test WITH (FORCE)'); } catch (_) { /* older PG */ }
  try { dockerPsql('DROP DATABASE IF EXISTS appointments_test'); } catch (_) { /* ignore */ }
  dockerPsql('CREATE DATABASE appointments_test');

  console.log('[test setup] Running migrations...');
  execSync('npx prisma migrate deploy', { env: testEnv, cwd: ROOT, stdio: 'pipe' });

  console.log('[test setup] Seeding test data...');
  execSync('node prisma/seed.js', { env: testEnv, cwd: ROOT, stdio: 'pipe' });

  console.log('[test setup] Ready.\n');
};
