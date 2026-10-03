-- ==============================================================================
-- Migration Base de Données - Version v2.20.0
-- Objet : Indexation de la colonne custom_slug pour l'unicité et la rapidité des recherches
-- Application : Company Card Generator (Tdconnect)
-- ==============================================================================

SET NAMES utf8mb4;

-- 1. Création de l'index sur custom_slug (si non existant)
SET @index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'collaborators'
    AND index_name = 'idx_collab_custom_slug'
);

SET @sql_create_index = IF(@index_exists = 0,
  'CREATE INDEX idx_collab_custom_slug ON collaborators(custom_slug);',
  'SELECT "Index idx_collab_custom_slug déjà existant" AS notice;'
);

PREPARE stmt FROM @sql_create_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT "Migration v2.20.0 (Index custom_slug) exécutée avec succès." AS status_message;
