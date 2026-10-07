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

const DB_CONTAINER = process.env.TEST_DB_CONTAINER || 'doc-appointment-booking-db-1';

function dockerPsql(sql) {
  execSync(`docker exec ${DB_CONTAINER} psql -U postgres -c "${sql}"`, { stdio: 'pipe' });
}

module.exports = async () => {
  // Always allow unit tests to run without requiring the DB container.
  // Integration tests depend on dockerised Postgres.
  const isIntegrationRun = (process.argv || []).some((a) => a.includes('integration'));

  // In CI the workflow creates appointments_test, runs migrations, and seeds
  // before npm test is invoked — nothing to do here.
  if (process.env.CI) {
    console.log('\n[test setup] CI environment — database already prepared by workflow.\n');
    return;
  }

  if (!isIntegrationRun) {
    console.log('\n[test setup] Unit test run — skipping DB setup.\n');
    return;
  }

  // If integration tests are running, require dockerised Postgres.
  try {
    const running = execSync(`docker inspect -f "{{.State.Running}}" ${DB_CONTAINER}`, { stdio: 'pipe' })
      .toString()
      .trim();
    if (running !== 'true') {
      throw new Error('container not running');
    }
  } catch (_) {
    throw new Error(
      `Test DB container '${DB_CONTAINER}' is required for integration tests. ` +
        `Start it (docker compose up -d) or set TEST_DB_CONTAINER.`
    );
  }

  console.log('\n[test setup] Creating test database...');
  try {
    dockerPsql('DROP DATABASE IF EXISTS appointments_test WITH (FORCE)');
  } catch (_) {
    /* older PG */
  }
  try {
    dockerPsql('DROP DATABASE IF EXISTS appointments_test');
  } catch (_) {
    /* ignore */
  }
  dockerPsql('CREATE DATABASE appointments_test');

  console.log('[test setup] Running migrations...');
  execSync('npx prisma migrate deploy', { env: testEnv, cwd: ROOT, stdio: 'pipe' });

  console.log('[test setup] Seeding test data...');
  execSync('node prisma/seed.js', { env: testEnv, cwd: ROOT, stdio: 'pipe' });

  console.log('[test setup] Ready.\n');
};
