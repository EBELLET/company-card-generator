/**
 * Script de migration SQLite → MySQL
 * Lit toutes les données de l'ancien database.sqlite
 * et les insère dans la base MySQL existante.
 * 
 * Usage : node scratch/migrate_sqlite_to_mysql.cjs
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');

const SQLITE_PATH = path.join(__dirname, '..', 'database.sqlite');

async function migrate() {
  console.log('\n========================================');
  console.log('  Migration SQLite → MySQL');
  console.log('========================================\n');

  // 1. Ouvrir SQLite en lecture
  const sqliteDb = await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(SQLITE_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });

  const sqliteGet = (query, params = []) => new Promise((resolve, reject) => {
    sqliteDb.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  console.log(`✔ Fichier SQLite ouvert : ${SQLITE_PATH}`);

  // 2. Ouvrir connexion MySQL
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: process.env.DB_NAME || 'company_card_generator',
    waitForConnections: true,
    connectionLimit: 5
  });
  console.log('✔ Connecté à MySQL\n');

  // ─── ENTREPRISES ─────────────────────────────────────────────────────────────
  const companies = await sqliteGet('SELECT * FROM company_info');
  console.log(`→ ${companies.length} entreprise(s) trouvée(s) dans SQLite...`);

  let companiesInserted = 0;
  let companiesSkipped = 0;
  const companyIdMap = {}; // ancien id SQLite → nouvel id MySQL

  for (const c of companies) {
    const [existing] = await pool.query('SELECT id FROM company_info WHERE name = ? AND domain = ?', [c.name, c.domain || '']);
    if (existing.length > 0) {
      console.log(`  ⊘ Entreprise déjà existante (ignorée) : "${c.name}" → id MySQL: ${existing[0].id}`);
      companyIdMap[c.id] = existing[0].id;
      companiesSkipped++;
      continue;
    }

    const [result] = await pool.query(`
      INSERT INTO company_info (
        name, domain, address, zip, city, country, logo_custom_url,
        theme, font, accent_color, logo_size, button_style,
        avatar_size, show_name_under_logo, show_tdconnect_message,
        tdconnect_message, logo_x
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      c.name, c.domain || '', c.address || '', c.zip || '',
      c.city || '', c.country || '', c.logo_custom_url || '',
      c.theme || 'theme-glass', c.font || 'font-outfit',
      c.accent_color || '#6366f1',
      c.logo_size != null ? c.logo_size : 72,
      c.button_style || 'rectangle',
      c.avatar_size != null ? c.avatar_size : 100,
      c.show_name_under_logo != null ? c.show_name_under_logo : 1,
      c.show_tdconnect_message != null ? c.show_tdconnect_message : 0,
      c.tdconnect_message || '',
      c.logo_x != null ? c.logo_x : 0
    ]);

    companyIdMap[c.id] = result.insertId;
    console.log(`  ✔ Entreprise migrée : "${c.name}" (SQLite id:${c.id} → MySQL id:${result.insertId})`);
    companiesInserted++;
  }

  console.log(`\n  Entreprises : ${companiesInserted} insérée(s), ${companiesSkipped} ignorée(s) (déjà existantes)\n`);

  // ─── COLLABORATEURS ───────────────────────────────────────────────────────────
  const collaborators = await sqliteGet('SELECT * FROM collaborators');
  console.log(`→ ${collaborators.length} collaborateur(s) trouvé(s) dans SQLite...`);

  let collabInserted = 0;
  let collabSkipped = 0;

  for (const col of collaborators) {
    const mysqlCompanyId = companyIdMap[col.company_id];
    if (!mysqlCompanyId) {
      console.warn(`  ⚠ Collaborateur "${col.first_name} ${col.last_name}" ignoré : entreprise id ${col.company_id} non trouvée dans le mapping.`);
      collabSkipped++;
      continue;
    }

    const [existing] = await pool.query('SELECT id FROM collaborators WHERE id = ?', [col.id]);
    if (existing.length > 0) {
      console.log(`  ⊘ Collaborateur déjà existant (ignoré) : ${col.first_name} ${col.last_name} (id: ${col.id})`);
      collabSkipped++;
      continue;
    }

    await pool.query(`
      INSERT INTO collaborators (
        id, company_id, first_name, last_name, civility, role, phone, email, address,
        photo_url, photo_zoom, photo_x, photo_y, phone_mobile, phone_work, phone_fax,
        phone_default, photo_click_url, is_active, custom_slug, avatar_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      col.id, mysqlCompanyId,
      col.first_name, col.last_name,
      col.civility || '', col.role || '', col.phone || '',
      col.email || '', col.address || '', col.photo_url || '',
      col.photo_zoom != null ? col.photo_zoom : 1.0,
      col.photo_x != null ? col.photo_x : 50,
      col.photo_y != null ? col.photo_y : 50,
      col.phone_mobile || '', col.phone_work || '', col.phone_fax || '',
      col.phone_default || 'mobile', col.photo_click_url || '',
      col.is_active != null ? col.is_active : 1,
      col.custom_slug || '',
      col.avatar_size != null ? col.avatar_size : 100
    ]);

    console.log(`  ✔ Collaborateur migré : ${col.first_name} ${col.last_name} (id: ${col.id})`);
    collabInserted++;
  }

  console.log(`\n  Collaborateurs : ${collabInserted} inséré(s), ${collabSkipped} ignoré(s)\n`);

  // ─── UTILISATEURS ─────────────────────────────────────────────────────────────
  const users = await sqliteGet('SELECT * FROM users WHERE role != "superadmin"');
  console.log(`→ ${users.length} utilisateur(s) (hors superadmin) trouvé(s) dans SQLite...`);

  let usersInserted = 0;
  let usersSkipped = 0;

  for (const u of users) {
    const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [u.id]);
    if (existing.length > 0) {
      console.log(`  ⊘ Utilisateur déjà existant (ignoré) : ${u.id}`);
      usersSkipped++;
      continue;
    }

    await pool.query(`
      INSERT INTO users (id, password_hash, first_name, last_name, email, role, is_temp_password)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [u.id, u.password_hash, u.first_name, u.last_name, u.email, u.role || 'admin', u.is_temp_password || 0]);

    console.log(`  ✔ Utilisateur migré : ${u.id} (${u.email})`);
    usersInserted++;
  }

  console.log(`\n  Utilisateurs : ${usersInserted} inséré(s), ${usersSkipped} ignoré(s)\n`);

  // ─── ASSOCIATIONS UTILISATEURS / ENTREPRISES ──────────────────────────────────
  const associations = await sqliteGet('SELECT * FROM user_companies');
  console.log(`→ ${associations.length} association(s) utilisateur/entreprise trouvée(s) dans SQLite...`);

  let assocInserted = 0;
  let assocSkipped = 0;

  for (const a of associations) {
    const mysqlCompanyId = companyIdMap[a.company_id];
    if (!mysqlCompanyId) {
      assocSkipped++;
      continue;
    }

    try {
      await pool.query(
        'INSERT IGNORE INTO user_companies (user_id, company_id) VALUES (?, ?)',
        [a.user_id, mysqlCompanyId]
      );
      assocInserted++;
    } catch (e) {
      assocSkipped++;
    }
  }

  console.log(`  Associations : ${assocInserted} insérée(s), ${assocSkipped} ignorée(s)\n`);

  // ─── FERMETURE ────────────────────────────────────────────────────────────────
  sqliteDb.close();
  await pool.end();

  console.log('========================================');
  console.log('  Migration terminée avec succès ! ✔');
  console.log('========================================\n');
}

migrate().catch(err => {
  console.error('\n✘ Erreur fatale lors de la migration :', err.message);
  process.exit(1);
});
