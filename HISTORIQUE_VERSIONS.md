# Historique des Versions - Application TDConnect

Ce document retrace l'historique complet des versions et des évolutions de l'application **TDConnect - Générateur de Cartes de Visite Virtuelles**.

---

## 📌 Synthèse de la Version Actuelle
* **Version / Tag** : `v2.2-securite-abonnements`
* **Date** : 22 août 2026
* **Statut** : Version stable en production / MySQL / Docker

---

## 📜 Historique Chronologique des Versions

### 🚀 Version `v2.2-securite-abonnements` (Dernière version)
**Thème : Sécurité des mots de passe, Gestion fine des abonnements & Badges synthétiques**
* **Sécurité des Mots de Passe & Ergonomie** :
  * Renforcement des mots de passe (minimum 8 caractères alphanumériques avec au moins 1 lettre et 1 chiffre).
  * Inscription des critères précis manquants en cas d'erreur de saisie.
  * Ajout d'un bouton d'affichage/masquage oeil (👁️) sur tous les champs de mot de passe.
* **Ergonomie du Panneau Contact** :
  * Ajout d'une croix de fermeture `✕` sur l'encart de contact du footer.
  * Fermeture automatique de l'encart de contact lors du changement de page/route.
  * Ouverture sécurisée des liens e-mail dans un nouvel onglet navigateur (`target="_blank"`).
* **Réorganisation des Actions Collaborateurs** :
  * Nouvel ordre des boutons d'action dans la fiche entreprise : `+ Ajouter` (violet `#8C52FF`, survol vert `#10b981`), `Import Excel` puis `Export Excel`.
* **Restrictions d'Accès Super Admin** :
  * Export ZIP autonome des cartes, affichage/modification du compteur de visites et forçage de l'URL personnalisé (`customSlug`) strictement réservés au rôle Super Admin (frontend + vérification token backend HTTP 403).
* **Gestion du Statut "Accès suspendu"** :
  * Modification du toggle entreprise vers **"Accès suspendu :"** avec inversion de la logique.
  * Si la case est cochée : accès bloqué et flouté immédiatement (*"Accès suspendu par l'administrateur"*).
  * Si la case est décochée : la date de fin d'abonnement prévaut automatiquement.
* **Tableau de Bord / Liste des Entreprises** :
  * Ajout de badges d'information synthétiques sur chaque carte entreprise : nombre de collaborateurs actifs, inactifs, date d'échéance de l'abonnement et statut d'accès (`⛔ Accès suspendu`, `⚠️ Abonnement échu`, `🟢 Accès actif`).

---

### 🚀 Version `947fc40` (Dernière version)
**Thème : Sécurité Chrome/OVH, Filtrage des Connexions, Navigation F5 & Stabilité Vite**
* **Sécurité & Confidentialité (Chrome / OVH)** :
  * Suppression totale de l'API externe Clearbit (`https://logo.clearbit.com/`) pour éviter les alertes de sécurité Chrome (*Mixed Content / HTTP/HTTPS*) et les requêtes tierces non sollicitées.
  * Nettoyage des anciens fichiers de base de données SQLite (`database.sqlite`, `database.sqlite-wal`, `database.sqlite-shm`) désormais obsolètes.
* **Compteur de Connexions Intelligente** :
  * Filtrage strict des accès : le compteur de visites d'une carte ne s'incrémente désormais **que pour les accès externes réels** (scans de QR Code, clics clients).
  * Les accès internes, les prévisualisations, les requêtes SSR (`?ssr=1`, `?preview=1`) et les accès par les administrateurs connectés sont ignorés par le compteur.
  * Ajout d'un bouton **"Ouvrir"** (en mode aperçu) dans le panneau de partage d'une carte afin que les administrateurs puissent tester le rendu sans incrémenter les statistiques.
* **Ergonomie & Navigation (F5)** :
  * Prise en charge de la persistance d'état via `sessionStorage` : lors d'un rafraîchissement de la page (`F5`), l'application réouvre exactement l'entreprise active, l'onglet actif (*Entreprise* ou *Collaborateurs*), le collaborateur sélectionné et le formulaire d'édition s'il était ouvert.
* **Stabilité du Serveur de Développement** :
  * Ajout des exclusions `watch.ignored` dans `vite.config.js` pour éliminer les boucles de rechargement infinies et le clignotement de l'écran.

---

### 🎨 Version `776440e`
**Thème : Normalisation de l'affichage de l'identité**
* Modification de la hiérarchie d'affichage des noms et prénoms.
* Normalisation de l'ordre **Nom puis Prénom** sur les cartes de visite virtuelles et dans la liste des membres d'équipe.

---

### ⚙️ Version `9b79bf9`
**Thème : Amorçage de la Base de Données**
* Désactivation du processus d'amorçage automatique des données de démonstration dans `server/seed.cjs`.

---

### 🔑 Version `c103eab`
**Thème : Réinitialisation de Mot de Passe**
* Prise en charge automatique de l'ouverture de la modale de réinitialisation de mot de passe lorsqu'un paramètre `?token=...` est détecté dans l'URL.

---

### 🛡️ Version `6804a1b`
**Thème : Exportation et Refonte Landing Page**
* Restriction de l'option d'exportation du pack ZIP autonome d'une carte aux seuls utilisateurs disposant du rôle **Super-Administrateur**.
* Simplification de l'expérience utilisateur sur la page d'accueil avec un bouton d'action principal (CTA) unique.

---

### 🐳 Version `7a7bb68`
**Thème : Ajustement de la Configuration Réseau**
* Modification du port par défaut vers `3001` dans `docker-compose.yml` afin d'éviter les conflits d'écoute sur le port `3000` avec d'autres services hébergés (notamment Open-WebUI).

---

### 📦 Version `fc585e6`
**Thème : Conteneurisation & Déploiement**
* Ajout des fichiers `Dockerfile` et `docker-compose.yml` pour faciliter le déploiement sur les serveurs de production (OVH, VPS, Docker).

---

### 🌱 Version `58543af`
**Thème : Version Initiale (Socle Applicatif)**
* Création du socle complet de l'application **TDConnect** :
  * Architecture Single Page Application (SPA) avec Vite et Express.
  * Gestion multientreprises et collaborateurs.
  * Système d'authentification administrateur et super-administrateur avec JWT.
  * Génération dynamique de cartes virtuelles HTML, téléchargement vCard (`.vcf`) et QR Codes.
  * Thèmes visuels avancés (Verre Poli, Obsidienne, Aurore, Minimaliste).
  * Support de la base de données relationnelle MySQL.

---

## 🛠️ Stack Technique
* **Frontend** : HTML5, CSS3 Vanilla (Design Système personnalisable, animations micro-interactions), JavaScript ES6+ / Vite.js.
* **Backend** : Node.js, Express.js.
* **Base de Données** : MySQL (driver `mysql2`).
* **Format d'échange** : vCard 3.0 / ISO-8859-1 & UTF-8, JSON, XLSX (Import/Export Excel), ZIP (`adm-zip`).
* **E-mails** : Nodemailer avec support SMTP SSL (OVH `ssl0.ovh.net`).
