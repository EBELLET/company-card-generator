-- ==============================================================================
-- Migration Base de Données - Version 2.10.0
-- Objet : Options d'affichage des boutons Téléphone/Mobile et Email sur la carte
-- Date : 20 Septembre 2026
-- ==============================================================================

-- 1. Ajout sécurisé des colonnes show_phone_button et show_email_button sur company_info
-- Note : Sur MySQL 8.0.19+, ADD COLUMN IF NOT EXISTS est supporté.
-- Pour compatibilité universelle MySQL 5.7+ / MariaDB / MySQL 8.0 :

SET @dbname = DATABASE();
SET @tablename = "company_info";

-- Ajout de la colonne show_phone_button si elle n'existe pas
SET @colname = "show_phone_button";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @colname
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " INT DEFAULT 1")
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ajout de la colonne show_email_button si elle n'existe pas
SET @colname = "show_email_button";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @colname
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " INT DEFAULT 1")
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Initialisation des entreprises existantes à 1 (actif) si NULL
UPDATE company_info SET show_phone_button = 1 WHERE show_phone_button IS NULL;
UPDATE company_info SET show_email_button = 1 WHERE show_email_button IS NULL;

-- Fin de la migration v2.10.0
