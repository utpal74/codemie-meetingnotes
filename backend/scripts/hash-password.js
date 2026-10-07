require('dotenv').config();
const bcrypt = require('bcrypt');

const password = process.argv[2] || 'admin123';

bcrypt.hash(password, 10).then((hash) => {
  console.log('\nAdd this to your .env file:');
  console.log(`RECEPTIONIST_PASSWORD_HASH=${hash}`);
  console.log(`\nDefault login: receptionist / ${password}`);
});
