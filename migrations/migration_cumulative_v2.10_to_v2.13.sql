-- ==============================================================================
-- Migration Base de Données Cumulée - Versions v2.10.0 à v2.13.0
-- TDConnect - Générateur de Cartes de Visite Virtuelles
-- Date : 20 Septembre 2026
-- ==============================================================================
-- Ce script idempotent regroupe TOUTES les modifications de structure de base
-- de données intervenues depuis la version v2.9.0 (v2.10.0, v2.11.0, v2.12.0, v2.13.0).
-- Il peut être exécuté sur le VPS en une seule fois sans risque d'erreur.
-- ==============================================================================

SET @dbname = DATABASE();
SET @tablename = "company_info";

-- ------------------------------------------------------------------------------
-- 1. Table `company_info` : Ajout des colonnes de boutons d'action (v2.10.0)
-- ------------------------------------------------------------------------------
-- show_phone_button
SET @colname = "show_phone_button";
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @colname) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " INT DEFAULT 1;")
));
PREPARE runStmt FROM @stmt; EXECUTE runStmt; DEALLOCATE PREPARE runStmt;

-- show_email_button
SET @colname = "show_email_button";
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @colname) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " INT DEFAULT 1;")
));
PREPARE runStmt FROM @stmt; EXECUTE runStmt; DEALLOCATE PREPARE runStmt;

-- ------------------------------------------------------------------------------
-- 2. Table `company_info` : Personnalisation du mail de réponse (v2.12.0)
-- ------------------------------------------------------------------------------
-- contact_email_subject
SET @colname = "contact_email_subject";
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @colname) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " VARCHAR(255) DEFAULT 'Échange de coordonnées';")
));
PREPARE runStmt FROM @stmt; EXECUTE runStmt; DEALLOCATE PREPARE runStmt;

-- contact_email_body
SET @colname = "contact_email_body";
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @colname) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " TEXT;")
));
PREPARE runStmt FROM @stmt; EXECUTE runStmt; DEALLOCATE PREPARE runStmt;

-- ------------------------------------------------------------------------------
-- 3. Table `company_info` : Options d'exportation vCard .vcf (v2.13.0)
-- ------------------------------------------------------------------------------
-- show_vcf_button
SET @colname = "show_vcf_button";
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @colname) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " INT DEFAULT 1;")
));
PREPARE runStmt FROM @stmt; EXECUTE runStmt; DEALLOCATE PREPARE runStmt;

-- vcf_annotation_origin
SET @colname = "vcf_annotation_origin";
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @colname) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " INT DEFAULT 1;")
));
PREPARE runStmt FROM @stmt; EXECUTE runStmt; DEALLOCATE PREPARE runStmt;

-- vcf_include_card_url
SET @colname = "vcf_include_card_url";
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @colname) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " INT DEFAULT 1;")
));
PREPARE runStmt FROM @stmt; EXECUTE runStmt; DEALLOCATE PREPARE runStmt;

-- ------------------------------------------------------------------------------
-- 4. Initialisation des valeurs par défaut pour les entreprises existantes
-- ------------------------------------------------------------------------------
UPDATE company_info SET show_phone_button = 1 WHERE show_phone_button IS NULL;
UPDATE company_info SET show_email_button = 1 WHERE show_email_button IS NULL;
UPDATE company_info SET show_vcf_button = 1 WHERE show_vcf_button IS NULL;
UPDATE company_info SET vcf_annotation_origin = 1 WHERE vcf_annotation_origin IS NULL;
UPDATE company_info SET vcf_include_card_url = 1 WHERE vcf_include_card_url IS NULL;

UPDATE company_info 
SET contact_email_subject = 'Échange de coordonnées' 
WHERE contact_email_subject IS NULL OR contact_email_subject = '';

UPDATE company_info 
SET contact_email_body = 'Bonjour,\r\n\r\nPour faire suite à notre rencontre, je vous adresse mes coordonnées.\r\n\r\nBonne réception.' 
WHERE contact_email_body IS NULL OR contact_email_body = '';

-- ------------------------------------------------------------------------------
-- 5. Table `app_settings` : Paramètres d'initialisation bas de carte (v2.11.0)
-- ------------------------------------------------------------------------------
INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES 
  ('trial_message_text', ''),
  ('trial_message_url', '');

-- ------------------------------------------------------------------------------
-- 6. Table `app_settings` : Nettoyage des anciennes clés obsolètes (v2.13.0)
-- ------------------------------------------------------------------------------
DELETE FROM app_settings WHERE setting_key IN ('vcf_annotation_origin', 'vcf_include_card_url');

-- ==============================================================================
-- Fin de la migration cumulée (v2.10.0 -> v2.13.0)
-- ==============================================================================
