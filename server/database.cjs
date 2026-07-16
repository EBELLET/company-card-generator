const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

let resolveDbReady;
const dbReady = new Promise((resolve) => {
  resolveDbReady = resolve;
});

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur lors de la connexion à SQLite:', err.message);
  } else {
    console.log('Connecté à la base de données SQLite à', dbPath);
    // CRITICAL: Enable foreign key constraints in SQLite for ON DELETE CASCADE to work
    db.run("PRAGMA foreign_keys = ON;", (pragmaErr) => {
      if (pragmaErr) console.error("Erreur d'activation des Foreign Keys:", pragmaErr.message);
      else console.log("Foreign Keys SQLite activées.");
    });
    // OPTIMIZATION: Enable WAL mode for concurrent read/write support
    db.run("PRAGMA journal_mode = WAL;", (pragmaErr) => {
      if (pragmaErr) console.error("Erreur d'activation du mode WAL:", pragmaErr.message);
      else console.log("Mode WAL SQLite activé.");
    });
    // OPTIMIZATION: Set busy timeout to prevent SQLITE_BUSY errors
    db.run("PRAGMA busy_timeout = 5000;", (pragmaErr) => {
      if (pragmaErr) console.error("Erreur de configuration busy_timeout:", pragmaErr.message);
      else console.log("SQLite busy_timeout configuré à 5000ms.");
    });
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // 1. Create company_info table with Auto-increment ID
    db.run(`
      CREATE TABLE IF NOT EXISTS company_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        domain TEXT,
        address TEXT,
        zip TEXT,
        city TEXT,
        country TEXT,
        logo_custom_url TEXT,
        theme TEXT DEFAULT 'theme-glass',
        font TEXT DEFAULT 'font-outfit',
        accent_color TEXT DEFAULT '#6366f1',
        logo_size INTEGER DEFAULT 72,
        button_style TEXT DEFAULT 'rectangle',
        avatar_size INTEGER DEFAULT 100,
        show_name_under_logo INTEGER DEFAULT 1,
        show_tdconnect_message INTEGER DEFAULT 0,
        tdconnect_message TEXT DEFAULT ''
      )
    `);

    // 2. Create collaborators table with relation to company_info and photo alignment options
    db.run(`
      CREATE TABLE IF NOT EXISTS collaborators (
        id TEXT PRIMARY KEY,
        company_id INTEGER NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        civility TEXT,
        role TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        address TEXT,
        photo_url TEXT,
        photo_zoom REAL DEFAULT 1.0,
        photo_x INTEGER DEFAULT 50,
        photo_y INTEGER DEFAULT 50,
        phone_mobile TEXT,
        phone_work TEXT,
        phone_fax TEXT,
        phone_default TEXT DEFAULT 'mobile',
        photo_click_url TEXT,
        is_active INTEGER DEFAULT 1,
        custom_slug TEXT,
        avatar_size INTEGER DEFAULT 100,
        FOREIGN KEY(company_id) REFERENCES company_info(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error("Erreur d'initialisation de la table des collaborateurs:", err.message);
      } else {
        console.log("Schéma de la base SQLite initialisé avec succès.");
      }
      
      // Perform dynamic migrations if database already existed but didn't have these columns
      db.run("ALTER TABLE company_info ADD COLUMN logo_size INTEGER DEFAULT 48", () => {});
      db.run("ALTER TABLE company_info ADD COLUMN button_style TEXT DEFAULT 'rectangle'", () => {});
      db.run("ALTER TABLE company_info ADD COLUMN avatar_size INTEGER DEFAULT 100", () => {});
      db.run("ALTER TABLE company_info ADD COLUMN show_name_under_logo INTEGER DEFAULT 1", () => {});
      db.run("ALTER TABLE company_info ADD COLUMN show_tdconnect_message INTEGER DEFAULT 0", () => {});
      db.run("ALTER TABLE company_info ADD COLUMN tdconnect_message TEXT DEFAULT ''", () => {});
      db.run("ALTER TABLE collaborators ADD COLUMN phone_mobile TEXT", () => {});
      db.run("ALTER TABLE collaborators ADD COLUMN phone_work TEXT", () => {});
      db.run("ALTER TABLE collaborators ADD COLUMN phone_fax TEXT", () => {});
      db.run("ALTER TABLE collaborators ADD COLUMN phone_default TEXT DEFAULT 'mobile'", () => {});
      db.run("ALTER TABLE collaborators ADD COLUMN photo_click_url TEXT", () => {});
      db.run("ALTER TABLE collaborators ADD COLUMN is_active INTEGER DEFAULT 1", () => {});
      db.run("ALTER TABLE collaborators ADD COLUMN custom_slug TEXT", () => {});
      db.run("ALTER TABLE collaborators ADD COLUMN avatar_size INTEGER DEFAULT 100", () => {});

      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          password_hash TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT NOT NULL,
          role TEXT CHECK(role IN ('superadmin', 'admin')) DEFAULT 'admin'
        )
      `, () => {
        db.run(`
          CREATE TABLE IF NOT EXISTS user_companies (
            user_id TEXT NOT NULL,
            company_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, company_id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(company_id) REFERENCES company_info(id) ON DELETE CASCADE
          )
        `, async () => {
          try {
            await seedSuperAdmin();
          } catch (seedErr) {
            console.error("Erreur de seeding du Super Admin:", seedErr.message);
          }
          resolveDbReady();
        });
      });
    });
  });
}

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
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [superAdminId], async (err, row) => {
      if (err) {
        reject(err);
      } else if (!row) {
        try {
          const passHash = await hashPassword('AdminPass123!');
          db.run(`
            INSERT INTO users (id, password_hash, first_name, last_name, email, role)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [superAdminId, passHash, 'Super', 'Admin', 'superadmin@example.com', 'superadmin'], (insertErr) => {
            if (insertErr) {
              console.error("Erreur de création du Super Admin par défaut:", insertErr.message);
              reject(insertErr);
            } else {
              console.log("Super Admin par défaut ('superadm') créé avec succès.");
              resolve();
            }
          });
        } catch (hashErr) {
          reject(hashErr);
        }
      } else {
        resolve();
      }
    });
  });
}

// --- Company Info Queries ---

const getCompanies = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM company_info ORDER BY name ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const getCompanyById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM company_info WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const addCompany = (c) => {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO company_info (name, domain, address, zip, city, country, logo_custom_url, theme, font, accent_color, logo_size, button_style, avatar_size, show_name_under_logo, show_tdconnect_message, tdconnect_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      c.tdconnect_message || ''
    ], function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, ...c });
    });
  });
};

const updateCompany = (id, c) => {
  return new Promise((resolve, reject) => {
    db.run(`
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
        tdconnect_message = ?
      WHERE id = ?
    `, [
      c.name,
      c.domain,
      c.address,
      c.zip,
      c.city,
      c.country,
      c.logo_custom_url,
      c.theme,
      c.font,
      c.accent_color,
      c.logo_size !== undefined ? c.logo_size : 72,
      c.button_style || 'rectangle',
      c.avatar_size !== undefined ? c.avatar_size : 100,
      c.show_name_under_logo !== undefined ? c.show_name_under_logo : 1,
      c.show_tdconnect_message !== undefined ? c.show_tdconnect_message : 0,
      c.tdconnect_message || '',
      id
    ], function(err) {
      if (err) reject(err);
      else resolve({ id, ...c });
    });
  });
};

const deleteCompany = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM company_info WHERE id = ?', [id], function(err) {
      if (err) reject(err);
      else resolve({ id });
    });
  });
};

// --- Collaborators Queries ---

const getCollaboratorsForCompany = (companyId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM collaborators WHERE company_id = ? ORDER BY last_name ASC, first_name ASC', [companyId], (err, rows) => {
      if (err) reject(err);
      else {
        const mapped = rows.map(r => ({
          id: r.id,
          companyId: r.company_id,
          firstName: r.first_name,
          lastName: r.last_name,
          civility: r.civility,
          role: r.role,
          phone: r.phone,
          email: r.email,
          address: r.address,
          photoUrl: r.photo_url,
          photoZoom: r.photo_zoom,
          photoX: r.photo_x,
          photoY: r.photo_y,
          phoneMobile: r.phone_mobile,
          phoneWork: r.phone_work,
          phoneFax: r.phone_fax,
          phoneDefault: r.phone_default,
          photoClickUrl: r.photo_click_url,
          isActive: r.is_active,
          customSlug: r.custom_slug,
          avatarSize: r.avatar_size
        }));
        resolve(mapped);
      }
    });
  });
};

const getCollaboratorById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM collaborators WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else if (!row) resolve(null);
      else {
        resolve({
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
          avatarSize: row.avatar_size
        });
      }
    });
  });
};

const addCollaborator = (c) => {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO collaborators (id, company_id, first_name, last_name, civility, role, phone, email, address, photo_url, photo_zoom, photo_x, photo_y, phone_mobile, phone_work, phone_fax, phone_default, photo_click_url, is_active, custom_slug, avatar_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c.id, 
      c.companyId, 
      c.firstName, 
      c.lastName, 
      c.civility || '', 
      c.role, 
      c.phone || '', 
      c.email, 
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
      c.isActive !== false ? 1 : 0,
      c.customSlug || '',
      c.avatarSize != null ? c.avatarSize : 100
    ], function(err) {
      if (err) reject(err);
      else resolve(c);
    });
  });
};

const updateCollaborator = (c) => {
  return new Promise((resolve, reject) => {
    db.run(`
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
        avatar_size = ?
      WHERE id = ?
    `, [
      c.companyId, 
      c.firstName, 
      c.lastName, 
      c.civility || '', 
      c.role, 
      c.phone || '', 
      c.email, 
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
      c.isActive !== false ? 1 : 0,
      c.customSlug || '',
      c.avatarSize != null ? c.avatarSize : 100,
      c.id
    ], function(err) {
      if (err) reject(err);
      else resolve(c);
    });
  });
};

const getCollaboratorBySlug = (slug) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM collaborators WHERE custom_slug = ?', [slug], (err, row) => {
      if (err) reject(err);
      else if (!row) resolve(null);
      else {
        resolve({
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
          avatarSize: row.avatar_size
        });
      }
    });
  });
};

const deleteCollaborator = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM collaborators WHERE id = ?', [id], function(err) {
      if (err) reject(err);
      else resolve({ id });
    });
  });
};

// --- User Management Queries ---

const getUserById = (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getUsers = () => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT id, first_name, last_name, email, role,
             (SELECT group_concat(company_id) FROM user_companies WHERE user_id = users.id) as managed_companies
      FROM users
      ORDER BY last_name ASC, first_name ASC
    `, (err, rows) => {
      if (err) reject(err);
      else {
        const mapped = rows.map(r => ({
          id: r.id,
          firstName: r.first_name,
          lastName: r.last_name,
          email: r.email,
          role: r.role,
          managedCompanies: r.managed_companies ? r.managed_companies.split(',').map(Number) : []
        }));
        resolve(mapped);
      }
    });
  });
};

const addUser = async (u) => {
  try {
    const hash = await hashPassword(u.password);
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO users (id, password_hash, first_name, last_name, email, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [u.id, hash, u.firstName, u.lastName, u.email, u.role || 'admin'], function(err) {
        if (err) reject(err);
        else resolve({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role || 'admin' });
      });
    });
  } catch (err) {
    return Promise.reject(err);
  }
};

const updateUser = (id, u) => {
  return new Promise(async (resolve, reject) => {
    let query = `
      UPDATE users SET
        first_name = ?,
        last_name = ?,
        email = ?,
        role = ?
    `;
    const params = [u.firstName, u.lastName, u.email, u.role || 'admin'];

    if (u.password) {
      try {
        const hash = await hashPassword(u.password);
        query += `, password_hash = ?`;
        params.push(hash);
      } catch (hashErr) {
        return reject(hashErr);
      }
    }

    query += ` WHERE id = ?`;
    params.push(id);

    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role || 'admin' });
    });
  });
};

const deleteUser = (id) => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
      if (err) reject(err);
      else resolve({ id });
    });
  });
};

const assignCompaniesToUser = (userId, companyIds) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM user_companies WHERE user_id = ?', [userId], (err) => {
        if (err) return reject(err);
        
        if (!companyIds || companyIds.length === 0) {
          return resolve();
        }
        
        const stmt = db.prepare('INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)');
        companyIds.forEach(cid => {
          stmt.run(userId, cid);
        });
        stmt.finalize((finalizeErr) => {
          if (finalizeErr) reject(finalizeErr);
          else resolve();
        });
      });
    });
  });
};

const registerUserWithCompany = async (userData, companyData) => {
  const hasCompany = companyData && companyData.name && companyData.name.trim();

  if (hasCompany) {
    // Check if company already exists (case-insensitive checks)
    const existingCompany = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM company_info WHERE LOWER(name) = ? OR (domain IS NOT NULL AND domain != "" AND LOWER(domain) = ?)',
        [companyData.name.toLowerCase().trim(), companyData.domain ? companyData.domain.toLowerCase().trim() : ''],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    if (existingCompany) {
      throw new Error("L'entreprise (nom ou domaine) existe déjà.");
    }
  }

  // Check if user already exists
  const existingUser = await getUserById(userData.id.trim());
  if (existingUser) {
    throw new Error("L'identifiant administrateur est déjà utilisé.");
  }

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION;');
      
      if (hasCompany) {
        // 1. Insert company
        db.run(`
          INSERT INTO company_info (name, domain, theme, font, accent_color, logo_size, button_style, avatar_size, show_name_under_logo, show_tdconnect_message, tdconnect_message)
          VALUES (?, ?, 'theme-glass', 'font-outfit', '#6366f1', 72, 'rectangle', 100, 1, 0, '')
        `, [companyData.name.trim(), companyData.domain ? companyData.domain.trim() : ''], function(companyErr) {
          if (companyErr) {
            db.run('ROLLBACK;');
            return reject(companyErr);
          }
          
          const companyId = this.lastID;
          
          // 2. Insert user
          db.run(`
            INSERT INTO users (id, password_hash, first_name, last_name, email, role)
            VALUES (?, ?, ?, ?, ?, 'admin')
          `, [
            userData.id.trim(),
            userData.passwordHash,
            userData.firstName.trim(),
            userData.lastName.trim(),
            userData.email.trim()
          ], function(userErr) {
            if (userErr) {
              db.run('ROLLBACK;');
              return reject(userErr);
            }
            
            // 3. Insert association
            db.run(`
              INSERT INTO user_companies (user_id, company_id)
              VALUES (?, ?)
            `, [userData.id.trim(), companyId], function(linkErr) {
              if (linkErr) {
                db.run('ROLLBACK;');
                return reject(linkErr);
              }
              
              db.run('COMMIT;', (commitErr) => {
                if (commitErr) {
                  db.run('ROLLBACK;');
                  return reject(commitErr);
                }
                resolve({ companyId, userId: userData.id.trim() });
              });
            });
          });
        });
      } else {
        // Just insert user
        db.run(`
          INSERT INTO users (id, password_hash, first_name, last_name, email, role)
          VALUES (?, ?, ?, ?, ?, 'admin')
        `, [
          userData.id.trim(),
          userData.passwordHash,
          userData.firstName.trim(),
          userData.lastName.trim(),
          userData.email.trim()
        ], function(userErr) {
          if (userErr) {
            db.run('ROLLBACK;');
            return reject(userErr);
          }
          
          db.run('COMMIT;', (commitErr) => {
            if (commitErr) {
              db.run('ROLLBACK;');
              return reject(commitErr);
            }
            resolve({ companyId: null, userId: userData.id.trim() });
          });
        });
      }
    });
  });
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
  deleteCollaborator,
  hashPassword,
  verifyPassword,
  getUserById,
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  assignCompaniesToUser,
  registerUserWithCompany
};
