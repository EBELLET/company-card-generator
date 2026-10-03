-- ==============================================================================
-- Migration Base de Données - Version v2.21.0
-- Objet : Ajout de la colonne inactive_redirect_url dans la table collaborators
-- Application : Company Card Generator (Tdconnect)
-- ==============================================================================

SET NAMES utf8mb4;

-- 1. Ajout de la colonne inactive_redirect_url (si non existante)
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'collaborators'
    AND column_name = 'inactive_redirect_url'
);

SET @sql_add_column = IF(@col_exists = 0,
  'ALTER TABLE collaborators ADD COLUMN inactive_redirect_url TEXT NULL AFTER photo_click_url;',
  'SELECT "Colonne inactive_redirect_url déjà existante" AS notice;'
);

PREPARE stmt FROM @sql_add_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT "Migration v2.21.0 (inactive_redirect_url) exécutée avec succès." AS status_message;
