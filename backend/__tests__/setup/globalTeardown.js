const { execSync } = require('child_process');

const DB_CONTAINER = 'doc-appointment-booking-db-1';

module.exports = async () => {
  try {
    execSync(`docker exec ${DB_CONTAINER} psql -U postgres -c "DROP DATABASE IF EXISTS appointments_test WITH (FORCE)"`, { stdio: 'pipe' });
  } catch (_) {
    try {
      execSync(`docker exec ${DB_CONTAINER} psql -U postgres -c "DROP DATABASE IF EXISTS appointments_test"`, { stdio: 'pipe' });
    } catch (_2) { /* ignore */ }
  }
};
