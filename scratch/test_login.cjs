const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const verifyPassword = (password, hash) => {
  return new Promise((resolve, reject) => {
    const parts = hash.split(':');
    if (parts.length !== 2) return resolve(false);
    const [salt, key] = parts;
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(key === derivedKey.toString('hex'));
    });
  });
};

async function testLogin() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'rootpassword',
      database: process.env.DB_NAME || 'company_card_generator'
    });

    const [rows] = await conn.query('SELECT * FROM users WHERE id = ?', ['superadm']);
    if (rows.length === 0) {
      console.log('User superadm not found!');
      await conn.end();
      return;
    }

    const user = rows[0];
    console.log('User found in DB:', { id: user.id, role: user.role, email: user.email });
    
    const isValid = await verifyPassword('AdminPass123!', user.password_hash);
    console.log('Password AdminPass123! verification result:', isValid);

    await conn.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testLogin();
