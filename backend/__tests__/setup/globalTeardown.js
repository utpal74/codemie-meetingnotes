const { execSync } = require('child_process');

const DB_CONTAINER = process.env.TEST_DB_CONTAINER || 'doc-appointment-booking-db-1';

module.exports = async () => {
  const isIntegrationRun = (process.argv || []).some((a) => a.includes('integration'));
  if (!isIntegrationRun) return;

  // If docker container isn't present/running, nothing to tear down.
  try {
    const running = execSync(`docker inspect -f "{{.State.Running}}" ${DB_CONTAINER}`, { stdio: 'pipe' })
      .toString()
      .trim();
    if (running !== 'true') return;
  } catch (_) {
    return;
  }

  try {
    execSync(`docker exec ${DB_CONTAINER} psql -U postgres -c "DROP DATABASE IF EXISTS appointments_test WITH (FORCE)"`, {
      stdio: 'pipe',
    });
  } catch (_) {
    try {
      execSync(`docker exec ${DB_CONTAINER} psql -U postgres -c "DROP DATABASE IF EXISTS appointments_test"`, { stdio: 'pipe' });
    } catch (_2) {
      /* ignore */
    }
  }
};
