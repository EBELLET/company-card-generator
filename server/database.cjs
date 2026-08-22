require('dotenv').config();
const mysql = require('mysql2/promise');
const crypto = require('crypto');

let resolveDbReady;
const dbReady = new Promise((resolve) => {
  resolveDbReady = resolve;
});

let pool;

async function connectAndInitialize() {
  try {
    const host = process.env.DB_HOST || '127.0.0.1';
    const port = parseInt(process.env.DB_PORT || '3306', 10);
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || 'rootpassword';
    const dbName = process.env.DB_NAME || 'company_card_generator';

    console.log(`Connexion à MySQL (${host}:${port}) pour vérification de la base de données...`);
    
    // 1. Create a connection without selecting database to check/create it
    const tempConn = await mysql.createConnection({
      host,
      port,
      user,
      password
    });
    
    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await tempConn.end();
    console.log(`Base de données MySQL "${dbName}" créée ou déjà existante.`);

    // 2. Initialize connection pool with database selected
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('Connecté à la base de données MySQL.');
    
    // 3. Initialize database tables
    await initializeDatabase();
    
    resolveDbReady();
  } catch (err) {
    console.error('Erreur d\'initialisation MySQL :', err.message);
    console.error('Assurez-vous que votre serveur MySQL est démarré et accessible avec les identifiants fournis dans le fichier .env.');
    process.exit(1);
  }
}

async function initializeDatabase() {
  // 1. Create company_info table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_info (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      domain VARCHAR(255),
      address TEXT,
      zip VARCHAR(20),
      city VARCHAR(100),
      country VARCHAR(100),
      logo_custom_url LONGTEXT,
      theme VARCHAR(50) DEFAULT 'theme-glass',
      font VARCHAR(50) DEFAULT 'font-outfit',
      accent_color VARCHAR(7) DEFAULT '#6366f1',
      logo_size INT DEFAULT 72,
      button_style VARCHAR(20) DEFAULT 'rectangle',
      avatar_size INT DEFAULT 100,
      show_name_under_logo INT DEFAULT 1,
      show_tdconnect_message INT DEFAULT 0,
      tdconnect_message TEXT,
      tdconnect_url TEXT,
      logo_x INT DEFAULT 0,
      subscription_end_date DATE NULL,
      is_subscription_active INT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await pool.query(`ALTER TABLE company_info ADD COLUMN subscription_end_date DATE NULL`);
  } catch (e) {}

  try {
    await pool.query(`ALTER TABLE company_info ADD COLUMN is_subscription_active INT DEFAULT 0`);
  } catch (e) {}

  try {
    await pool.query(`ALTER TABLE company_info ADD COLUMN tdconnect_url TEXT`);
  } catch (e) {}

  // Ensure all existing companies have an active valid subscription date for testing
  try {
    await pool.query(`UPDATE company_info SET subscription_end_date = '2030-12-31', is_subscription_active = 1 WHERE subscription_end_date IS NULL OR subscription_end_date < CURRENT_DATE()`);
  } catch (e) {}

  // 2. Create collaborators table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS collaborators (
      id VARCHAR(50) PRIMARY KEY,
      company_id INT NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      civility VARCHAR(20),
      role VARCHAR(150) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(255) NOT NULL,
      address TEXT,
      photo_url LONGTEXT,
      photo_zoom DOUBLE DEFAULT 1.0,
      photo_x INT DEFAULT 50,
      photo_y INT DEFAULT 50,
      phone_mobile VARCHAR(50),
      phone_work VARCHAR(50),
      phone_fax VARCHAR(50),
      phone_default VARCHAR(20) DEFAULT 'mobile',
      photo_click_url TEXT,
      is_active INT DEFAULT 1,
      custom_slug VARCHAR(100),
      avatar_size INT DEFAULT 100,
      connection_count INT DEFAULT 0,
      FOREIGN KEY (company_id) REFERENCES company_info(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await pool.query(`ALTER TABLE collaborators ADD COLUMN connection_count INT DEFAULT 0`);
  } catch (e) {}

  // 3. Create users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      is_temp_password INT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 4. Create user_companies table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_companies (
      user_id VARCHAR(50) NOT NULL,
      company_id INT NOT NULL,
      PRIMARY KEY (user_id, company_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES company_info(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 5. Create password_reset_tokens table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log("Schéma de la base MySQL initialisé avec succès.");
  await seedSuperAdmin();
}

// Start MySQL connection and DB initialization loop
connectAndInitialize();

// --- User Security Helpers ---

const hashPassword = (password) => {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
};

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

// Seed default Super Admin user
async function seedSuperAdmin() {
  const superAdminId = 'superadm';
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [superAdminId]);
  
  if (rows.length === 0) {
    try {
      const passHash = await hashPassword('AdminPass123!');
      await pool.query(`
        INSERT INTO users (id, password_hash, first_name, last_name, email, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [superAdminId, passHash, 'Super', 'Admin', 'superadmin@example.com', 'superadmin']);
      console.log("Super Admin par défaut ('superadm') créé avec succès.");
    } catch (err) {
      console.error("Erreur lors de la création du Super Admin par défaut:", err.message);
    }
  }
}

// --- Collaborator Mapping Helper ---
function mapCollaboratorRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    firstName: row.first_name,
    lastName: row.last_name,
    civility: row.civility,
    role: row.role,
    phone: row.phone,
    email: row.email,
    address: row.address,
    photoUrl: row.photo_url,
    photoZoom: row.photo_zoom,
    photoX: row.photo_x,
    photoY: row.photo_y,
    phoneMobile: row.phone_mobile,
    phoneWork: row.phone_work,
    phoneFax: row.phone_fax,
    phoneDefault: row.phone_default,
    photoClickUrl: row.photo_click_url,
    isActive: row.is_active,
    customSlug: row.custom_slug,
    avatarSize: row.avatar_size,
    connectionCount: row.connection_count != null ? row.connection_count : 0
  };
}

function getOneMonthFromNowDateString() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCompany(row) {
  if (!row) return null;
  let subEndDate = null;
  if (row.subscription_end_date) {
    if (row.subscription_end_date instanceof Date) {
      const d = row.subscription_end_date;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      subEndDate = `${year}-${month}-${day}`;
    } else {
      subEndDate = String(row.subscription_end_date).split('T')[0];
    }
  }
  return {
    ...row,
    subscription_end_date: subEndDate,
    subscriptionEndDate: subEndDate,
    is_subscription_active: row.is_subscription_active != null ? row.is_subscription_active : 1,
    isSubscriptionActive: row.is_subscription_active != null ? row.is_subscription_active : 1,
    active_collabs_count: Number(row.active_collabs_count || 0),
    inactive_collabs_count: Number(row.inactive_collabs_count || 0)
  };
}

// --- Company Info Queries ---

const getCompanies = async () => {
  const [rows] = await pool.query(`
    SELECT 
      c.*,
      COALESCE(SUM(CASE WHEN col.is_active != 0 THEN 1 ELSE 0 END), 0) AS active_collabs_count,
      COALESCE(SUM(CASE WHEN col.is_active = 0 THEN 1 ELSE 0 END), 0) AS inactive_collabs_count
    FROM company_info c
    LEFT JOIN collaborators col ON col.company_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
  `);
  return rows.map(formatCompany);
};

const getCompanyById = async (id) => {
  const [rows] = await pool.query(`
    SELECT 
      c.*,
      COALESCE(SUM(CASE WHEN col.is_active != 0 THEN 1 ELSE 0 END), 0) AS active_collabs_count,
      COALESCE(SUM(CASE WHEN col.is_active = 0 THEN 1 ELSE 0 END), 0) AS inactive_collabs_count
    FROM company_info c
    LEFT JOIN collaborators col ON col.company_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `, [id]);
  return formatCompany(rows[0]) || null;
};

const addCompany = async (c) => {
  const trimmedName = c.name.trim();
  const trimmedDomain = c.domain ? c.domain.trim().toLowerCase() : '';
  let subEndDate = c.subscription_end_date || c.subscriptionEndDate;
  if (!subEndDate) {
    subEndDate = getOneMonthFromNowDateString();
  }

  let existingRows = [];
  if (trimmedDomain) {
    [existingRows] = await pool.query(
      'SELECT * FROM company_info WHERE LOWER(name) = LOWER(?) OR (domain IS NOT NULL AND domain != "" AND LOWER(domain) = LOWER(?)) LIMIT 1',
      [trimmedName, trimmedDomain]
    );
  } else {
    [existingRows] = await pool.query(
      'SELECT * FROM company_info WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [trimmedName]
    );
  }

  if (existingRows.length > 0) {
    return formatCompany(existingRows[0]);
  }

  const isSubActiveVal = c.is_subscription_active !== undefined ? (c.is_subscription_active ? 1 : 0) : (c.isSubscriptionActive !== undefined ? (c.isSubscriptionActive ? 1 : 0) : 0);

  const [result] = await pool.query(`
    INSERT INTO company_info (
      name, domain, address, zip, city, country, logo_custom_url,
      theme, font, accent_color, logo_size, button_style,
      avatar_size, show_name_under_logo, show_tdconnect_message,
      tdconnect_message, tdconnect_url, logo_x, subscription_end_date, is_subscription_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    trimmedName,
    trimmedDomain,
    c.address || '',
    c.zip || '',
    c.city || '',
    c.country || '',
    c.logo_custom_url || '',
    c.theme || 'theme-glass',
    c.font || 'font-outfit',
    c.accent_color || '#6366f1',
    c.logo_size !== undefined ? c.logo_size : 72,
    c.button_style || 'rectangle',
    c.avatar_size !== undefined ? c.avatar_size : 100,
    c.show_name_under_logo !== undefined ? c.show_name_under_logo : 1,
    c.show_tdconnect_message !== undefined ? c.show_tdconnect_message : 0,
    c.tdconnect_message || '',
    c.tdconnect_url || c.tdconnectUrl || '',
    c.logo_x !== undefined ? c.logo_x : 0,
    subEndDate || null,
    isSubActiveVal
  ]);
  return getCompanyById(result.insertId);
};

const updateCompany = async (id, c) => {
  let subEndDate = null;
  if (c.subscription_end_date !== undefined) {
    subEndDate = c.subscription_end_date || null;
  } else if (c.subscriptionEndDate !== undefined) {
    subEndDate = c.subscriptionEndDate || null;
  }

  const isSubActiveVal = c.is_subscription_active !== undefined ? (c.is_subscription_active ? 1 : 0) : (c.isSubscriptionActive !== undefined ? (c.isSubscriptionActive ? 1 : 0) : 0);

  await pool.query(`
    UPDATE company_info SET
      name = ?,
      domain = ?,
      address = ?,
      zip = ?,
      city = ?,
      country = ?,
      logo_custom_url = ?,
      theme = ?,
      font = ?,
      accent_color = ?,
      logo_size = ?,
      button_style = ?,
      avatar_size = ?,
      show_name_under_logo = ?,
      show_tdconnect_message = ?,
      tdconnect_message = ?,
      tdconnect_url = ?,
      logo_x = ?,
      subscription_end_date = ?,
      is_subscription_active = ?
    WHERE id = ?
  `, [
    c.name,
    c.domain || '',
    c.address || '',
    c.zip || '',
    c.city || '',
    c.country || '',
    c.logo_custom_url || '',
    c.theme || 'theme-glass',
    c.font || 'font-outfit',
    c.accent_color || '#6366f1',
    c.logo_size !== undefined ? c.logo_size : 72,
    c.button_style || 'rectangle',
    c.avatar_size !== undefined ? c.avatar_size : 100,
    c.show_name_under_logo !== undefined ? c.show_name_under_logo : 1,
    c.show_tdconnect_message !== undefined ? c.show_tdconnect_message : 0,
    c.tdconnect_message || '',
    c.tdconnect_url !== undefined ? c.tdconnect_url : (c.tdconnectUrl !== undefined ? c.tdconnectUrl : ''),
    c.logo_x !== undefined ? c.logo_x : 0,
    subEndDate || null,
    isSubActiveVal,
    id
  ]);
  return getCompanyById(id);
};

const deleteCompany = async (id) => {
  await pool.query('DELETE FROM company_info WHERE id = ?', [id]);
  return { id };
};

// --- Collaborator Management Queries ---

const getCollaboratorsForCompany = async (companyId) => {
  const [rows] = await pool.query('SELECT * FROM collaborators WHERE company_id = ? ORDER BY last_name ASC, first_name ASC', [companyId]);
  return rows.map(mapCollaboratorRow);
};

const getCollaboratorById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM collaborators WHERE id = ?', [id]);
  return mapCollaboratorRow(rows[0]) || null;
};

const getCollaboratorBySlug = async (slug) => {
  const [rows] = await pool.query('SELECT * FROM collaborators WHERE custom_slug = ?', [slug]);
  return mapCollaboratorRow(rows[0]) || null;
};

const addCollaborator = async (c) => {
  const connectionCountVal = c.connectionCount != null ? parseInt(c.connectionCount, 10) : (c.connection_count != null ? parseInt(c.connection_count, 10) : 0);
  await pool.query(`
    INSERT INTO collaborators (
      id, company_id, first_name, last_name, civility, role, phone, email, address,
      photo_url, photo_zoom, photo_x, photo_y, phone_mobile, phone_work, phone_fax,
      phone_default, photo_click_url, is_active, custom_slug, avatar_size, connection_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    c.id,
    c.companyId,
    c.firstName,
    c.lastName,
    c.civility || '',
    c.role || '',
    c.phone || '',
    c.email || '',
    c.address || '',
    c.photoUrl || '',
    c.photoZoom != null ? c.photoZoom : 1.0,
    c.photoX != null ? c.photoX : 50,
    c.photoY != null ? c.photoY : 50,
    c.phoneMobile || '',
    c.phoneWork || '',
    c.phoneFax || '',
    c.phoneDefault || 'mobile',
    c.photoClickUrl || '',
    (c.isActive === 0 || c.isActive === false || c.is_active === 0 || c.is_active === false) ? 0 : 1,
    c.customSlug || '',
    c.avatarSize != null ? c.avatarSize : 100,
    connectionCountVal
  ]);
  return { ...c, connectionCount: connectionCountVal };
};

const updateCollaborator = async (c) => {
  const connectionCountVal = c.connectionCount != null ? parseInt(c.connectionCount, 10) : (c.connection_count != null ? parseInt(c.connection_count, 10) : 0);
  await pool.query(`
    UPDATE collaborators SET
      company_id = ?,
      first_name = ?,
      last_name = ?,
      civility = ?,
      role = ?,
      phone = ?,
      email = ?,
      address = ?,
      photo_url = ?,
      photo_zoom = ?,
      photo_x = ?,
      photo_y = ?,
      phone_mobile = ?,
      phone_work = ?,
      phone_fax = ?,
      phone_default = ?,
      photo_click_url = ?,
      is_active = ?,
      custom_slug = ?,
      avatar_size = ?,
      connection_count = ?
    WHERE id = ?
  `, [
    c.companyId,
    c.firstName,
    c.lastName,
    c.civility || '',
    c.role || '',
    c.phone || '',
    c.email || '',
    c.address || '',
    c.photoUrl || '',
    c.photoZoom != null ? c.photoZoom : 1.0,
    c.photoX != null ? c.photoX : 50,
    c.photoY != null ? c.photoY : 50,
    c.phoneMobile || '',
    c.phoneWork || '',
    c.phoneFax || '',
    c.phoneDefault || 'mobile',
    c.photoClickUrl || '',
    (c.isActive === 0 || c.isActive === false || c.is_active === 0 || c.is_active === false) ? 0 : 1,
    c.customSlug || '',
    c.avatarSize != null ? c.avatarSize : 100,
    connectionCountVal,
    c.id
  ]);
  return { ...c, connectionCount: connectionCountVal };
};

const incrementCollaboratorConnectionCount = async (id) => {
  try {
    await pool.query('UPDATE collaborators SET connection_count = connection_count + 1 WHERE id = ?', [id]);
  } catch (err) {
    console.error('Erreur lors de l\'incrémentation du compteur de connexions:', err.message);
  }
};

const deleteCollaborator = async (id) => {
  await pool.query('DELETE FROM collaborators WHERE id = ?', [id]);
  return { id };
};

// --- User Management Queries ---

const getUserById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] || null;
};

const getUsers = async () => {
  const [users] = await pool.query('SELECT * FROM users ORDER BY last_name ASC, first_name ASC');
  const [associations] = await pool.query('SELECT * FROM user_companies');
  
  return users.map(user => {
    const managed = associations
      .filter(a => a.user_id === user.id)
      .map(a => a.company_id);
      
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      managedCompanies: managed
    };
  });
};

const addUser = async (u) => {
  const hash = await hashPassword(u.password);
  await pool.query(`
    INSERT INTO users (id, password_hash, first_name, last_name, email, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [u.id, hash, u.firstName, u.lastName, u.email, u.role || 'admin']);
  return { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role || 'admin' };
};

const updateUser = async (id, u) => {
  let query = `
    UPDATE users SET
      first_name = ?,
      last_name = ?,
      email = ?,
      role = ?
  `;
  const params = [u.firstName, u.lastName, u.email, u.role || 'admin'];

  if (u.password) {
    const hash = await hashPassword(u.password);
    query += `, password_hash = ?, is_temp_password = 0`;
    params.push(hash);
  }

  query += ` WHERE id = ?`;
  params.push(id);

  await pool.query(query, params);
  return { id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role || 'admin' };
};

const deleteUser = async (id) => {
  await pool.query('DELETE FROM users WHERE id = ?', [id]);
  return { id };
};

const assignCompaniesToUser = async (userId, companyIds) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM user_companies WHERE user_id = ?', [userId]);
    
    if (companyIds && companyIds.length > 0) {
      for (const companyId of companyIds) {
        await connection.query('INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)', [userId, companyId]);
      }
    }
    
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

const registerUserWithCompany = async (userData, companyData) => {
  const hasCompany = companyData && companyData.name && companyData.name.trim();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    let companyId = null;
    if (hasCompany) {
      const trimmedName = companyData.name.trim();
      const trimmedDomain = companyData.domain ? companyData.domain.trim().toLowerCase() : '';
      
      let existingRows = [];
      if (trimmedDomain) {
        [existingRows] = await connection.query(
          'SELECT id FROM company_info WHERE LOWER(name) = LOWER(?) OR (domain IS NOT NULL AND domain != "" AND LOWER(domain) = LOWER(?)) LIMIT 1',
          [trimmedName, trimmedDomain]
        );
      } else {
        [existingRows] = await connection.query(
          'SELECT id FROM company_info WHERE LOWER(name) = LOWER(?) LIMIT 1',
          [trimmedName]
        );
      }

      if (existingRows.length > 0) {
        companyId = existingRows[0].id;
        console.log(`[DB] Entreprise existante "${trimmedName}" trouvée (ID ${companyId}). Rattachement de l'utilisateur ${userData.id}...`);
      } else {
        const defaultSubEnd = getOneMonthFromNowDateString();
        const [companyResult] = await connection.query(`
          INSERT INTO company_info (name, domain, theme, font, accent_color, logo_size, button_style, avatar_size, show_name_under_logo, show_tdconnect_message, tdconnect_message, subscription_end_date)
          VALUES (?, ?, 'theme-glass', 'font-outfit', '#6366f1', 72, 'rectangle', 100, 1, 0, '', ?)
        `, [trimmedName, trimmedDomain, defaultSubEnd]);
        
        companyId = companyResult.insertId;
        console.log(`[DB] Nouvelle entreprise "${trimmedName}" créée (ID ${companyId}). Date d'abonnement : ${defaultSubEnd}.`);
      }
    }
    
    await connection.query(`
      INSERT INTO users (id, password_hash, first_name, last_name, email, role, is_temp_password)
      VALUES (?, ?, ?, ?, ?, 'admin', ?)
    `, [
      userData.id.trim(),
      userData.passwordHash,
      userData.firstName.trim(),
      userData.lastName.trim(),
      userData.email.trim(),
      userData.isTempPassword ? 1 : 0
    ]);
    
    if (companyId) {
      await connection.query(`
        INSERT INTO user_companies (user_id, company_id)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE company_id = VALUES(company_id)
      `, [userData.id.trim(), companyId]);
    }
    
    await connection.commit();
    return { companyId, userId: userData.id.trim() };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

// --- Password Reset Token Helpers ---

const createPasswordResetToken = async (userId) => {
  const crypto = require('crypto');
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  // Invalidate any previous token for this user
  await pool.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [userId]);
  await pool.query(
    'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
    [token, userId, expiresAt]
  );
  return token;
};

const getPasswordResetToken = async (token) => {
  const [rows] = await pool.query(
    'SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()',
    [token]
  );
  return rows[0] || null;
};

const deletePasswordResetToken = async (token) => {
  await pool.query('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
};

module.exports = {
  dbReady,
  getCompanies,
  getCompanyById,
  addCompany,
  updateCompany,
  deleteCompany,
  getCollaboratorsForCompany,
  getCollaboratorById,
  getCollaboratorBySlug,
  addCollaborator,
  updateCollaborator,
  incrementCollaboratorConnectionCount,
  deleteCollaborator,
  hashPassword,
  verifyPassword,
  getUserById,
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  assignCompaniesToUser,
  registerUserWithCompany,
  createPasswordResetToken,
  getPasswordResetToken,
  deletePasswordResetToken
};
