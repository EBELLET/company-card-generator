-- ==============================================================================
-- Migration Base de Données - Version v2.14.0
-- TDConnect - Statut d'autosouscription, Horodatages et Verrouillage Admin
-- Date : 21 Septembre 2026
-- ==============================================================================
-- Ce script idempotent ajoute les colonnes nécessaires à la table `users` :
--  - `is_locked` : Verrouillage / déverrouillage du compte par le Super Admin (0 = actif, 1 = verrouillé)
--  - `status` : Statut du compte ('pending_confirmation' ou 'confirmed')
--  - `created_at` : Date et heure de création
--  - `confirmed_at` : Date et heure de confirmation (premier changement de mot de passe)
-- Il est conçu pour préserver STRICTEMENT toutes les données existantes sur votre VPS.
-- ==============================================================================

SET @dbname = DATABASE();
SET @tablename = "users";

-- ------------------------------------------------------------------------------
-- 1. Table `users` : Ajout de la colonne `is_locked` (INT DEFAULT 0)
-- ------------------------------------------------------------------------------
SET @colname = "is_locked";
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @colname) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " INT DEFAULT 0;")
));
PREPARE runStmt FROM @stmt; EXECUTE runStmt; DEALLOCATE PREPARE runStmt;

-- ------------------------------------------------------------------------------
-- 2. Table `users` : Ajout de la colonne `status` (VARCHAR(50) DEFAULT 'confirmed')
-- ------------------------------------------------------------------------------
SET @colname = "status";
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @colname) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " VARCHAR(50) DEFAULT 'confirmed';")
));
PREPARE runStmt FROM @stmt; EXECUTE runStmt; DEALLOCATE PREPARE runStmt;

-- ------------------------------------------------------------------------------
-- 3. Table `users` : Ajout de la colonne `created_at` (DATETIME DEFAULT CURRENT_TIMESTAMP)
-- ------------------------------------------------------------------------------
SET @colname = "created_at";
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @colname) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " DATETIME DEFAULT CURRENT_TIMESTAMP;")
));
PREPARE runStmt FROM @stmt; EXECUTE runStmt; DEALLOCATE PREPARE runStmt;

-- ------------------------------------------------------------------------------
-- 4. Table `users` : Ajout de la colonne `confirmed_at` (DATETIME NULL)
-- ------------------------------------------------------------------------------
SET @colname = "confirmed_at";
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @colname) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " DATETIME NULL;")
));
PREPARE runStmt FROM @stmt; EXECUTE runStmt; DEALLOCATE PREPARE runStmt;

-- ------------------------------------------------------------------------------
-- 5. Initialisation sécurisée pour les utilisateurs existants
-- ------------------------------------------------------------------------------
-- Les comptes existants sont tous initialisés déverrouillés
UPDATE users SET is_locked = 0 WHERE is_locked IS NULL;

-- Les comptes existants ayant déjà changé leur mot de passe temporaire (ou créés par superadmin) sont confirmés
UPDATE users 
SET status = IF(is_temp_password = 1, 'pending_confirmation', 'confirmed') 
WHERE status IS NULL OR status = '';

-- Date de création fixée à maintenant si manquante
UPDATE users SET created_at = NOW() WHERE created_at IS NULL;

-- Date de confirmation renseignée pour les comptes déjà confirmés
UPDATE users 
SET confirmed_at = NOW() 
WHERE status = 'confirmed' AND confirmed_at IS NULL;

SELECT "Migration v2.14.0 exécutée avec succès sans altération de données." AS status_message;
