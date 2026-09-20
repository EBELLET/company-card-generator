-- =====================================================================
-- Migration v2.12.0 : Personnalisation du mail de réponse au clic sur Email
-- =====================================================================
-- Ce script ajoute les colonnes nécessaires à la configuration de l'objet
-- et du corps du message pour le partage de coordonnées par email.
-- =====================================================================

-- 1. Ajout sécurisé des colonnes contact_email_subject et contact_email_body sur company_info

SET @dbname = DATABASE();
SET @tablename = "company_info";

-- Ajout de la colonne contact_email_subject si elle n'existe pas
SET @colname = "contact_email_subject";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @colname
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " VARCHAR(255) DEFAULT 'Échange de coordonnées';")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Ajout de la colonne contact_email_body si elle n'existe pas
SET @colname = "contact_email_body";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @colname
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " TEXT;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Initialisation des enregistrements existants avec les valeurs par défaut si null ou vide
UPDATE company_info 
SET contact_email_subject = 'Échange de coordonnées' 
WHERE contact_email_subject IS NULL OR contact_email_subject = '';

UPDATE company_info 
SET contact_email_body = 'Bonjour,\r\n\r\nPour faire suite à notre rencontre, je vous adresse mes coordonnées.\r\n\r\nBonne réception.' 
WHERE contact_email_body IS NULL OR contact_email_body = '';
