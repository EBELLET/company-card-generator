-- ==============================================================================
-- Migration Base de Données - Version v2.15.0
-- TDConnect - Limite d'autosouscription journalière (Protection anti-robots)
-- Date : 21 Septembre 2026
-- ==============================================================================
-- Ce script idempotent ajoute le paramètre `register_rate_limit_per_day`
-- dans la table `app_settings` (valeur par défaut : 5).
-- Il préserve STRICTEMENT toutes les données existantes sur votre VPS.
-- ==============================================================================

INSERT IGNORE INTO app_settings (setting_key, setting_value) 
VALUES ('register_rate_limit_per_day', '5');

SELECT "Migration v2.15.0 exécutée avec succès sans altération de données." AS status_message;
