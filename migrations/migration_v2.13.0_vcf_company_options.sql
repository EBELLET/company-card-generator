-- =====================================================================
-- Migration v2.13.0 : Options d'exportation vCard au niveau de l'entreprise
-- =====================================================================
-- Ce script ajoute le contrôle du bouton "Télécharger la fiche contact"
-- ainsi que les options de contenu vCard au niveau de chaque entreprise.
-- =====================================================================

SET @dbname = DATABASE();
SET @tablename = "company_info";

-- 1. Ajout de la colonne show_vcf_button si elle n'existe pas
SET @colname = "show_vcf_button";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @colname
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " INT DEFAULT 1;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Ajout de la colonne vcf_annotation_origin si elle n'existe pas
SET @colname = "vcf_annotation_origin";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @colname
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " INT DEFAULT 1;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 3. Ajout de la colonne vcf_include_card_url si elle n'existe pas
SET @colname = "vcf_include_card_url";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @colname
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @colname, " INT DEFAULT 1;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 4. Initialisation des enregistrements existants à 1 si NULL
UPDATE company_info SET show_vcf_button = 1 WHERE show_vcf_button IS NULL;
UPDATE company_info SET vcf_annotation_origin = 1 WHERE vcf_annotation_origin IS NULL;
UPDATE company_info SET vcf_include_card_url = 1 WHERE vcf_include_card_url IS NULL;
