-- ==============================================================================
-- Migration Base de Données - Version v2.19.0
-- TDConnect - Gestion et affichage des CGU et CGV en texte enrichi
-- Date : 30 Septembre 2026
-- ==============================================================================
-- Ce script idempotent :
-- 1. Modifie le type de colonne `setting_value` en MEDIUMTEXT pour supporter les longs textes enrichis
-- 2. Insère la clé `cgu_cgv` avec un modèle par défaut dans `app_settings` (INSERT IGNORE)
-- Il préserve STRICTEMENT toutes les données existantes sur votre base MySQL.
-- ==============================================================================

-- Agrandissement de la taille de setting_value pour supporter de longs documents HTML
ALTER TABLE app_settings MODIFY setting_value MEDIUMTEXT NOT NULL;

-- Insertion de la clé cgu_cgv avec le texte par défaut (si non déjà présente)
INSERT IGNORE INTO app_settings (setting_key, setting_value) 
VALUES (
  'cgu_cgv',
  '<h2>Conditions Générales d''Utilisation (CGU)</h2>
<h3>1. Présentation des services</h3>
<p>L''application TDConnect permet la création, la personnalisation, l''hébergement et la diffusion de cartes de visite virtuelles connectées, intégrant des profils interactifs (vCard, QR Code, technologies sans contact NFC).</p>

<h3>2. Accès et sécurité des comptes</h3>
<p>L''accès à l''espace d''administration et aux fonctionnalités de gestion est réservé aux clients et utilisateurs autorisés. Chaque utilisateur est responsable de la conservation confidentielle de ses identifiants et mot de passe.</p>

<h3>3. Données personnelles et confidentialité (RGPD)</h3>
<p>Conformément au Règlement Général sur la Protection des Données (RGPD), TDConnect veille scrupuleusement à la confidentialité et à la sécurité des données transmises. Les informations professionnelles ne sont utilisées que pour la publication et le bon fonctionnement des profils connectés.</p>

<hr>

<h2>Conditions Générales de Vente (CGV)</h2>
<h3>1. Souscription et commandes</h3>
<p>Toute commande de cartes physiques (NFC en bois noble, métal ou polymère) ou souscription à un forfait d''utilisation de l''application implique l''adhésion complète et sans réserve aux présentes conditions.</p>

<h3>2. Périodes offertes et tarification</h3>
<p>Des périodes offertes d''évaluation peuvent être allouées lors de la création d''une nouvelle entreprise. À l''issue de cette période, la continuité des services nécessite la souscription aux formules d''abonnement en vigueur.</p>

<h3>3. Service client & Réclamations</h3>
<p>Pour toute question, réclamation ou exercice de vos droits d''accès ou de rectification, vous pouvez joindre nos équipes via les coordonnées mentionnées dans la rubrique Mentions Légales.</p>'
);

SELECT "Migration v2.19.0 (CGU-CGV) exécutée avec succès sans altération de données." AS status_message;
