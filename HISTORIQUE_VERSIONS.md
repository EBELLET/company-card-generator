# Historique des Versions - Application TDConnect

Ce document retrace l'historique complet des versions et des évolutions de l'application **TDConnect - Générateur de Cartes de Visite Virtuelles**.

---

## 📌 Synthèse de la Version Actuelle
* **Version / Tag** : `v2.8.0-unicite-nom-entreprise-insensible-casse`
* **Date** : 19 septembre 2026
* **Statut** : Version stable en production / MySQL / Docker

---

## 📜 Historique Chronologique des Versions

### 🚀 Version `v2.8.0-unicite-nom-entreprise-insensible-casse` (Dernière version)
**Thème : Contrôle d'unicité insensible à la casse du nom d'entreprise lors de la modification et création**
* **Contrôle d'unicité SQL en base de données (`updateCompany`)** :
  * Vérification systématique par requête SQL `LOWER(TRIM(name)) = LOWER(?) AND id != ?` lors de la modification d'une entreprise existante.
  * Si une autre entreprise possède déjà ce nom (ex. "TOTO" existant et tentative de renommer en "toto"), la modification est immédiatement rejetée avec un message explicite.
  * Le changement de casse sur sa propre entreprise (ex. "toto" vers "Toto") reste parfaitement autorisé car l'identifiant est le même.
* **Gestion des erreurs API (`PUT /api/companies/:id`)** :
  * Renvoi d'un code HTTP 400 avec le message d'erreur JSON précis (`err.message`) en lieu et place d'une erreur 500 générique masquant la cause.
* **Expérience utilisateur et pré-validation côté interface (`src/main.js`)** :
  * Pré-validation instantanée côté client dans `btnSaveCompany` et `btnSaveNewCompany` contre la liste locale `allCompanies`.
  * Affichage de la notification d'alerte avec le message renvoyé par l'API au lieu d'une alerte d'échec générique.
  * Synchronisation en direct du nom dans le cache local `allCompanies` après validation.
* **Contraste adaptatif des symboles et textes des boutons d'action (Téléchargement, Mobile, Email)** :
  * Calcul dynamique de la luminosité perçue YIQ de la couleur des boutons (`--accent` / `--accent-color`).
  * Si l'utilisateur choisit une couleur claire ou proche du blanc (ex: `#ffffff`, teintes pastel ou claires), les symboles SVG et textes passent automatiquement en noir `#0f172a` avec une bordure subtile garantissant une lisibilité parfaite.
  * Préservation automatique de la couleur blanche sur les teintes sombres et adaptation conjointe dans l'aperçu mobile et sur la carte virtuelle HTML publique.
* **Affichage des initiales du collaborateur en l'absence de photo sur la carte publique** :
  * Harmonisation de la carte virtuelle publique avec l'aperçu mobile : affichage systématique des initiales (`PD`, `JD`, etc.) lorsque le collaborateur n'a pas de photo de profil.
  * Déclinaison des styles selon le thème actif (`theme-minimalist`, `theme-glass`, `theme-obsidian`, `theme-aurora`) pour une visibilité et une lisibilité optimales.
  * Sécurisation du fallback `onerror` sur l'image en cas de lien brisé.
* **Optimisation de la typographie et lisibilité sur la carte virtuelle publique** :
  * Augmentation harmonieuse de la taille des polices de texte sur la carte publique pour s'aligner avec le confort de lecture de l'aperçu :
    * Nom du collaborateur porté à `1.7rem` (au lieu de `1.45rem`).
    * Fonction / Poste à `1.05rem` (au lieu de `0.9rem`).
    * Adresse de l'entreprise à `0.98rem` (au lieu de `0.85rem`).
    * Texte d'invitation au partage à `0.95rem` (au lieu de `0.85rem`).
    * Boutons d'action (*Télécharger la fiche contact*, *Mobile*, *Email*) portés à `0.98rem` / `0.95rem` avec un espacement interne plus généreux.
    * Pied de page et messages personnalisés portés à `0.85rem` et `0.8rem`.
  * Ajustement conjoint des règles responsives sur smartphones (`@media (max-width: 480px)`).

---

### 🚀 Version `v2.7.9-saut-de-ligne-br-champs-collaborateur`
**Thème : Prise en charge des sauts de ligne via le code `<br>` dans les champs texte des collaborateurs**
* **Aperçu mobile et Carte virtuelle HTML publique** :
  * Interprétation du code `<br>` (ainsi que `<br/>`, `<br />`, `<BR>`) pour créer un véritable retour à la ligne dans tous les champs texte de la fiche collaborateur (*Fonction / Poste*, *Civilité*, *Prénom*, *Nom*, *Adresse*).
  * Traitement sécurisé anti-XSS via `renderWithBr()` pour empêcher toute injection HTML malveillante.
  * Ajustement du `line-height` et du retour à la ligne (`word-break: break-word`) pour une présentation nette et aérée des intitulés multilignes.
* **Effacement automatique dans le fichier .vcf (vCard)** :
  * Nettoyage systématique via `stripBr()` de tous les champs injectés dans la vCard (`TITLE`, `FN`, `N`, `ADR`, `ORG`).
  * Les codes `<br>` sont effacés et remplacés par un espace propre, préservant la netteté du carnet d'adresses des smartphones.
* **Contraste & gestion d'erreur de l'encart Réinitialisation de mot de passe** :
  * Remplacement de la couleur blanche par du noir/gris foncé (`#0f172a` et `#334155`) sur l'identifiant et le titulaire du compte concerné dans la modale de réinitialisation de mot de passe, garantissant une lisibilité optimale sur fond clair.
  * Positionnement du bloc de message d'état hors du formulaire pour afficher immédiatement un message d'alerte explicite si le lien est invalide ou expiré, avec bouton de réémission rapide.
* **Structuration multi-URLs du fichier .vcf (vCard)** :
  * **Site web de l'entreprise** : déclaré sous l'étiquette standard `bureau` (`item1.URL` + `X-ABLabel:_$!<Work>!$_`).
  * **Carte de visite virtuelle** : déclarée sous l'étiquette explicite personnalisée `Carte de visite` (`item2.URL` + `X-ABLabel:Carte de visite`) avec protocole sécurisé `https://`, offrant un champ web dédié et propre sur iPhone et Android sans doublon dans les notes.
* **Liste latérale des collaborateurs** :
  * Rendu compact et net sans balise `<br>` apparente dans la liste sommaire d'administration.

---

### 🚀 Version `v2.7.8-correctif-timeout-inactivite-mobile`
**Thème : Respect strict du délai d'inactivité (Timeout) sur mobile et à la reprise d'écran**
* **Persistance & Non-écrasement de l'horodatage au rechargement** :
  * Préservation de l'horodatage de la dernière activité (`tdconnect_last_activity`) au démarrage de l'application sans écrasement automatique avec `Date.now()`.
  * Synchronisation conjointe du timestamp dans `sessionStorage` et `localStorage`.
  * Mise en cache locale du délai configuré (`tdconnect_inactivity_timeout`) pour une évaluation synchrone immédiate dès le chargement de la page.
* **Neutralisation du premier contact tactile au réveil (`touchstart`)** :
  * Contrôle préalable de l'état d'expiration de la session avant d'accepter de rafraîchir l'horodatage lors d'un événement utilisateur (toucher tactile, clic, saisie).
* **Interception des événements de reprise système** :
  * Écoute conjointe de `visibilitychange`, `pageshow` et `focus` pour déconnecter immédiatement dès la sortie de veille ou le retour sur l'onglet mobile.

---

### 🚀 Version `v2.7.7-correctifs-routeur-et-liste-collaborateurs`
**Thème : Correctifs du routeur SPA au rafraîchissement (F5), isolation multi-comptes et refonte UX de la liste des collaborateurs**
* **Stabilité du routeur SPA & Session F5** :
  * Correction du problème de déconnexion/retour au landing page lors d'un rafraîchissement (F5) en réexécutant le rendu de route (`renderRoute`) directement au démarrage.
  * Réinitialisation de `lastActivityTime` à `Date.now()` au chargement pour éviter tout faux délai d'inactivité lors du rechargement de page.
  * Isolation de session par onglet grâce à `sessionStorage` combiné à `localStorage` (permettant aux administrateurs concurrents de travailler simultanément sans conflits).
* **Refonte UX de la Liste des Collaborateurs** :
  * Clic direct sur n'importe quel encart de collaborateur pour ouvrir ses détails et son formulaire de modification.
  * Suppression de l'icône "stylo" de la liste des collaborateurs.
  * Agrandissement des icônes d'action (statut et suppression) pour un confort visuel et tactile accru.
  * Le formulaire "Modifier le collaborateur" reste fermé par défaut à l'ouverture de l'onglet collaborateurs (affichage unique de la liste).
* **Correctif Accès Suspendu Entreprise d'Essai** :
  * Correction de la valeur par défaut de `is_subscription_active` à `1` lors de l'enregistrement de compte et création d'entreprise d'essai.

---

### 🚀 Version `v2.7.6-isolation-sessions-multicomptes-sessionstorage`
**Thème : Isolation des sessions multi-comptes et accès concurrents via `sessionStorage`**
**Thème : Isolation des sessions multi-comptes et accès concurrents via `sessionStorage`**
* **Isolation par onglet / fenêtre** :
  * Migration des jetons et de l'état d'authentification (`tdconnect_token`, `tdconnect_user`, `tdconnect_last_activity`) de `localStorage` vers `sessionStorage`.
  * Permet la connexion simultanée de plusieurs administrateurs ou du Super Admin dans des onglets différents du même navigateur sans écrasement de session ni déconnexion intempestive.

---

### 🚀 Version `v2.7.5-correctif-statut-acces-suspendu-creation-compte`
**Thème : Correctif du statut d'accès suspendu lors de la création d'entreprise d'essai**
* **Statut de l'entreprise d'essai** :
  * Correction du bug où la création d'un compte et d'une entreprise pour une période d'essai définissait la colonne `is_subscription_active` à `0` par défaut.
  * L'accès n'est plus suspendu ("Accès suspendu" décoché, valeur par défaut `1`) à la création d'une entreprise.
* **Phrase d'explication de carte virtuelle** :
  * Ajout des deux-points à la fin : *"Partagez vos coordonnées avec votre nouveau contact :"*.
  * Ajustement des espacements (ligne d'espace ajoutée au-dessus, espace supprimé en dessous pour coller aux boutons).
* **Lien et Note dans la vCard (.vcf)** :
  * Le champ `NOTE` contient uniquement l'annotation d'origine (*"Contact généré par tdconnect.fr le..."*).
  * L'URL de la carte virtuelle est intégrée dans le champ standard `URL` du fichier `.vcf`.
* **Taille des polices de la carte virtuelle (URL publique & Aperçu)** :
  * Agrandissement léger des polices de caractères sur la carte publique (`1.45rem` pour le nom, `0.9rem` pour la fonction, `0.85rem` pour l'adresse et le texte de partage, `0.88rem` pour les boutons d'action).
  * Harmonisation parfaite entre l'aperçu de la carte dans l'espace collaborateur et le rendu final de l'URL publique.

---

### 🚀 Version `v2.7.3-correctif-sauvegarde-flag-dirty`
**Thème : Correctif de la réinitialisation de l'état de modification lors de la sauvegarde**
* **Réinitialisation du flag de modifications** :
  * Correction du bug où `isCompanyFormDirty` n'était pas remis à `false` lors du clic sur le bouton *"Valider les modifications"*.
  * Désormais, après un clic réussi sur *"Valider les modifications"*, la pop-up de modifications non enregistrées ne se réaffiche plus de manière intempestive lors du changement d'onglet ou de page.

---

### 🚀 Version `v2.7.2-remise-a-zéro-champs-et-aperçu-abandon`
**Thème : Réinitialisation automatique des champs et de l'image d'aperçu lors de l'abandon des modifications**
* **Rétablissement du paramétrage enregistré** :
  * Lors de la confirmation d'abandon (bouton *"Oui"*), les champs de formulaire et l'image d'aperçu virtuelle sont automatiquement rechargés à partir des données enregistrées en BDD (`loadCompanyDetail` et `closeCollabForm`).
  * Ajout d'un bouton *"Annuler"* (`#btn-cancel-company`) à côté du bouton *"Valider les modifications"* sur le formulaire Entreprise.

---

### 🚀 Version `v2.7.1-correctif-visibilite-bouton-non-et-onglets`
**Thème : Correctif de la visibilité du bouton "Non" et protection lors du basculement d'onglets Entreprise/Collaborateurs**
* **Visibilité du bouton "Non"** :
  * Refonte du contraste de la pop-up de confirmation avec un fond blanc solide et des boutons à fort contraste (`#f1f5f9` / texte `#0f172a` pour le bouton Non).
* **Protection au changement d'onglets** :
  * Interception du clic sur les onglets *"Informations Entreprise"* et *"Collaborateurs"* (`.tab-btn`) en cas de modifications non enregistrées sur l'un ou l'autre formulaire.
  * Interception de la sélection d'un collaborateur dans la liste de gauche (`collabItem`) en cas de modifications en cours.

---

### 🚀 Version `v2.7-avertissement-modifications-non-enregistrees`
**Thème : Détection et pop-up de confirmation pour les modifications non enregistrées**
* **Confirmation d'abandon des modifications** :
  * Affichage d'une fenêtre de confirmation lors des tentatives de sortie sans enregistrer ("Les modifications n'ont pas été enregistrées. Souhaitez-vous les abandonner ?").
  * **Bouton Oui** : abandonne les modifications et poursuit l'action ou la navigation.
  * **Bouton Non** : ferme la pop-up et conserve l'utilisateur sur la page avec ses modifications en attente.
  * Protection appliquée aux formulaires Entreprise et Collaborateur (navigation d'onglet, bouton retour, fermeture de formulaire, changement de collaborateur, déconnexion et fermeture de l'onglet du navigateur).

---

### 🚀 Version `v2.6-correctifs-ergonomie-securite`
**Thème : Correctifs d'ergonomie, gestion des identifiants, sécurité des inscriptions & réinitialisation par e-mail**
* **Boutons de Téléphone sur Cartes** :
  * Affichage uniquement du type (*Mobile*, *Fixe*, *Fax*) sans afficher le numéro de téléphone dans le libellé du bouton.
  * Correction du rafraîchissement du libellé d'aperçu dans l'administration après enregistrement d'un collaborateur.
* **Sécurité des Inscriptions** :
  * Refus et annulation de la création de compte si l'entreprise spécifiée existe déjà (nom ou nom de domaine en doublon).
* **Flexibilité des Identifiants** :
  * Ajustement de la règle de validation des identifiants utilisateurs/administrateurs à un minimum de 6 caractères (au lieu d'exactement 8).
* **Réinitialisation de Mot de Passe par E-mail** :
  * Détection automatique du paramètre `token` dans l'URL lors du clic sur le lien d'e-mail pour ouvrir immédiatement la fenêtre de saisie du nouveau mot de passe.
* **Déconnexion & Bouton CTA** :
  * Remise à jour automatique du bouton CTA principal *"Essayez, créez votre carte"* dès la déconnexion d'un compte.

---

### 🚀 Version `v2.5-reorganisation-boutons`
**Thème : Réorganisation des boutons d'action, mailto prérempli, aperçu dynamique & support styles de boutons**
* **Réorganisation des boutons d'action** :
  * 1er : Bouton *"Télécharger la fiche contact"* (vCard).
  * 2ème : Texte d'explication centré *"Partagez vos coordonnées avec votre nouveau contact"*.
  * 3ème : Boutons Téléphone et Email positionnés côte à côte sous le texte.
* **Email prérempli** :
  * Objet du mail : `Échange de coordonnées`.
  * Corps du mail : `Bonjour. Pour faire suite à notre rencontre je vous adresse mes coordonnées`.
* **Rendu & Maquette** :
  * Respect du style de boutons choisi par l'entreprise (`Boutons Rectangulaires` vs `Boutons Ronds`) sur les cartes publiques (`/card/:id`).
  * Suppression du texte *"Carte de visite virtuelle"* des bas de cartes.
  * Hauteur dynamique du smartphone d'aperçu dans l'administration pour afficher la carte complète sans défilement.

---

### 🚀 Version `v2.4-affichage-carte-url`
**Thème : Ajustement de la mise en page des cartes virtuelles autonomes (URL public)**
* **Espacement supérieur** :
  * Réduction de 50 % des marges/paddings supérieurs au-dessus du logo sur les cartes virtuelles autonomes pour un rendu plus compact et équilibré.
* **Dimension du cercle photo** :
  * Ajustement et réduction de la taille du cercle de photo de profil/initiales du collaborateur sur les cartes virtuelles générées par URL.

---

### 🚀 Version `v2.3-affichage-carte`
**Thème : Ordre d'affichage Prénom NOM sur les cartes virtuelles**
* **Affichage des Identités** :
  * Mise à jour de l'ordre d'affichage au format **Prénom NOM** sur les cartes de visite virtuelles (`/card/:id`) et dans l'aperçu dynamique de droite.
  * Maintien de la présentation **NOM Prénom** dans la liste de gestion des collaborateurs (panneau de gauche) pour le classement alphabétique.

---

### 🚀 Version `v2.2-securite-abonnements`
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
