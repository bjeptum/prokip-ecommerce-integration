require('dotenv').config();

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL!');
    await client.end();
  } catch (err) {
    console.error('❌ Connection failed:', err);
  }
})();
