-- ==============================================================================
-- Migration Base de Données - Version 2.11.0
-- Objet : Paramétrage du message de bas de carte en période offerte et URL de redirection
-- Date : 20 Septembre 2026
-- ==============================================================================

-- 1. Ajout sécurisé des clés trial_message_text et trial_message_url dans app_settings
-- Ces paramètres permettent de définir globalement le texte et l'URL de redirection
-- affichés au bas des cartes virtuelles pour les entreprises dont l'abonnement est en période offerte.

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES 
  ('trial_message_text', ''),
  ('trial_message_url', '');

-- Fin de la migration v2.11.0
