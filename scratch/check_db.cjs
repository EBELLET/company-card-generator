const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'rootpassword',
      database: process.env.DB_NAME || 'company_card_generator'
    });
    const [rows] = await conn.query('SELECT id, first_name, last_name, email, role, is_temp_password FROM users WHERE id = ?', ['superadm']);
    console.log('MYSQL_RESULT:', rows);
    await conn.end();
  } catch (err) {
    console.log('MYSQL_ERR:', err.message);
  }
}

check();
