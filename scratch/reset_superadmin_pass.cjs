const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const hashPassword = (password) => {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
};

async function resetPassword(newPassword = 'AdminPass123!') {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'rootpassword',
      database: process.env.DB_NAME || 'company_card_generator'
    });

    const passHash = await hashPassword(newPassword);
    const [result] = await conn.query('UPDATE users SET password_hash = ?, is_temp_password = 0 WHERE id = ?', [passHash, 'superadm']);
    
    if (result.affectedRows > 0) {
      console.log(`SUCCÈS: Le mot de passe de superadm a été réinitialisé avec succès sur : ${newPassword}`);
    } else {
      console.log("ERREUR: Utilisateur 'superadm' non trouvé dans la base.");
    }
    await conn.end();
  } catch (err) {
    console.error("ERREUR lors de la réinitialisation:", err.message);
  }
}

const args = process.argv.slice(2);
const desiredPassword = args[0] || 'AdminPass123!';
resetPassword(desiredPassword);
