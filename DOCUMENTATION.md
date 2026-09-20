# Documentation Générale - TDConnect
**Générateur et Gestionnaire de Cartes de Visite Virtuelles**  
*Version de l'application : v2.13.0*

---

## Sommaire
1. [Partie 1 : Présentation Générale](#partie-1--présentation-générale)
   - [1.1 Contexte et Objectifs](#11-contexte-et-objectifs)
   - [1.2 Fonctionnalités Principales](#12-fonctionnalités-principales)
   - [1.3 Architecture Technique](#13-architecture-technique)
   - [1.4 Sécurité et Confidentialité](#14-sécurité-et-confidentialité)
2. [Partie 2 : Fonctions de l'Administrateur](#partie-2--fonctions-de-ladministrateur)
   - [2.1 Périmètre et Rôle](#21-périmètre-et-rôle)
   - [2.2 Personnalisation de l'Identité Visuelle de l'Entreprise](#22-personnalisation-de-lidentité-visuelle-de-lentreprise)
   - [2.3 Configuration des Boutons d'Action de la Carte Virtuelle](#23-configuration-des-boutons-daction-de-la-carte-virtuelle)
   - [2.4 Gestion des Collaborateurs](#24-gestion-des-collaborateurs)
   - [2.5 Import et Export de Données (Excel)](#25-import-et-export-de-données-excel)
   - [2.6 Suivi de l'Abonnement et Sécurité du Compte](#26-suivi-de-labonnement-et-sécurité-du-compte)
3. [Partie 3 : Fonctions du Super Administrateur](#partie-3--fonctions-du-super-administrateur)
   - [3.1 Périmètre Global](#31-périmètre-global)
   - [3.2 Supervision Multi-Entreprises](#32-supervision-multi-entreprises)
   - [3.3 Gestion des Abonnements et des Droits Avancés](#33-gestion-des-abonnements-et-des-droits-avancés)
   - [3.4 Administration des Utilisateurs](#34-administration-des-utilisateurs)
   - [3.5 Paramètres Généraux de la Plateforme](#35-paramètres-généraux-de-la-plateforme)

---

# Partie 1 : Présentation Générale

### 1.1 Contexte et Objectifs
**TDConnect** est une plateforme professionnelle conçue pour remplacer la carte de visite papier par une **carte de visite virtuelle mobile, écologique, interactive et universelle**.  
Chaque collaborateur d'une entreprise dispose d'une page web optimisée pour smartphone, accessible instantanément par scan d'un **QR Code** ou via une **URL personnalisée** (ex. `tdconnect.fr/c/jean-dupont`).

L'objectif est double :
* **Moderniser l'image de marque** des organisations grâce à des cartes interactives aux couleurs et polices personnalisées de l'entreprise.
* **Faciliter la mise en relation immédiate** : le destinataire peut enregistrer le contact dans son carnet d'adresses en un clic, ou répondre directement par téléphone ou par email préparé.

---

### 1.2 Fonctionnalités Principales
* **Diffusion Multi-Canale** :
  * Affichage web responsive accessible sur tout navigateur (iOS, Android, ordinateur).
  * Génération automatique de **QR Codes** haute définition pour cartes physiques, badges, signatures d'e-mail ou flyers.
  * Exportation d'une **archive ZIP autonome** contenant un site web statique autonome (`index.html` + logo + `.vcf`) hébergeable sur tout serveur sans dépendance technique.
* **Téléchargement vCard standardisé (.vcf)** :
  * Génération à la volée d'une fiche contact conforme aux standards vCard 3.0 (compatibilité testée avec Apple Contacts, Google Contacts, Microsoft Outlook, Windows Contacts).
  * Options paramétrables par entreprise pour contrôler l'annotation d'origine et l'inclusion de l'URL de la carte.
* **Interactions Directes** :
  * Bouton d'appel téléphonique direct (choix entre numéro mobile, fixe ou fax).
  * Bouton d'échange de coordonnées par e-mail avec objet et texte préremplis.
* **Personnalisation Graphique Avancée** :
  * Choix parmi 4 thèmes visuels (Minimaliste, Verre givré, Obsidienne sombre, Aurore boréale).
  * 3 polices d'écriture modernes (Outfit, Playfair Display, Mono).
  * Palette de couleurs avec calcul automatique du contraste pour assurer une parfaite lisibilité des textes.

---

### 1.3 Architecture Technique
* **Frontend** : Application monopage (SPA) fluide développée en Vanilla JavaScript moderne (ES6+), HTML5 et CSS3 (variables CSS, flexbox, grid), compilée avec **Vite**.
* **Backend** : API REST développée avec **Node.js** et **Express**, intégrant un service d'envoi d'e-mails transactionnels via protocole **SMTP** sécurisé (SSL/TLS).
* **Base de données** : SGBD relationnel **MySQL 8.0**, garantissant l'intégrité référentielle, l'idempotence des schémas et la persistance des données.
* **Déploiement et Conteneurisation** : Orchestration via **Docker** et **Docker Compose** assurant une isolation complète de l'application et de la base de données, avec scripts de migration SQL automatisés.

---

### 1.4 Sécurité et Confidentialité
* **Authentification** : Gestion des sessions sécurisée par tokens signés **JWT** (JSON Web Tokens).
* **Hachage des Mots de Passe** : Utilisation de l'algorithme robuste **Scrypt** avec sel cryptographique aléatoire unique.
* **Contrôle d'Inactivité** : Déconnexion automatique des utilisateurs après une période d'inactivité configurable pour prévenir les accès non autorisés sur postes partagés.
* **Réinitialisation de Mot de Passe** : Procédure sécurisée par jeton à usage unique limité dans le temps transmis par e-mail.
* **Protection contre les abus** : Verrouillage des cartes virtuelles par floutage de sécurité en cas d'abonnement échu ou suspendu.

---

# Partie 2 : Fonctions de l'Administrateur

L'**Administrateur** est le gestionnaire de l'entreprise. Il a accès à l'ensemble des réglages de sa propre structure et de ses collaborateurs.

### 2.1 Périmètre et Rôle
* Gérer l'identité de son entreprise et sa charte graphique.
* Administrer l'équipe de collaborateurs (création, mise à jour, suppression).
* Activer et configurer les boutons d'action de ses cartes virtuelles.
* Suivre l'état de l'abonnement de son entreprise.
* Modifier ses identifiants et son mot de passe de connexion.

---

### 2.2 Personnalisation de l'Identité Visuelle de l'Entreprise
Dans l'onglet **Entreprise**, l'administrateur personnalise l'apparence des cartes de visite de tous ses collaborateurs :
* **Informations Générales** : Nom de l'entreprise, domaine web/site Internet, adresse postale complète (rue, code postal, ville, pays).
* **Logo de l'Entreprise** :
  * Récupération automatique du logo à partir du nom de domaine ou téléversement d'un fichier image (PNG, JPG, SVG, WebP).
  * Curseurs d'ajustement en temps réel : **taille du logo** (de 32px à 200px) et **centrage horizontal** (axe X).
* **Thème Visuel** : Sélection du style graphique parmi Minimaliste, Verre givré, Obsidienne ou Aurore.
* **Typographie** : Choix de la police d'écriture (Outfit, Playfair ou Mono).
* **Couleur d'Accentuation** : Choix parmi des couleurs prédéfinies ou sélection d'une teinte personnalisée via la pipette couleur.
* **Style des Boutons d'Action** : Format rectangulaire complet avec intitulé texte ou format circulaire avec icônes compactes.
* **Taille de l'Avatar / Photo de profil** : Réglage du diamètre par défaut de la bulle photo des collaborateurs (de 50px à 150px).
* **Affichage du Nom sous le Logo** : Possibilité d'afficher ou de masquer le libellé textuel de l'entreprise sous le logo.

---

### 2.3 Configuration des Boutons d'Action de la Carte Virtuelle
La rubrique **"Boutons de la carte virtuelle"** utilise des sélecteurs radio `On / Off` ergonomiques :

1. **Télécharger la fiche contact** `[ On | Off ]` :
   * Active ou désactive le bouton principal d'enregistrement du contact au format `.vcf`.
   * **Sous-encart "Exportation vCard (.vcf)"** (visible lorsque le bouton est sur `On`) :
     * **Annotation dans la carte vcf de l'origine du contact** `[ On | Off ]` : ajoute ou non la mention *"Contact généré par tdconnect.fr le JJ/MM/AAAA"* dans le carnet d'adresses du destinataire.
     * **Ajout de l'url de la carte virtuelle dans le vcf** `[ On | Off ]` : insère l'URL de la carte dans le champ standard vCard *Carte de visite*.
2. **Téléphone / Mobile** `[ On | Off ]` :
   * Affiche ou masque le bouton d'appel direct vers le collaborateur.
3. **Email** `[ On | Off ]` :
   * Affiche ou masque le bouton d'envoi d'e-mail.
   * **Modèle d'e-mail d'échange de coordonnées** (visible lorsque Email est sur `On`) :
     * **Objet du mail** : pré-remplit l'objet du message (ex. *"Échange de coordonnées"*).
     * **Corps du message** : zone multi-lignes préremplie invitant le nouveau contact à transmettre ses propres coordonnées en retour.

---

### 2.4 Gestion des Collaborateurs
Dans l'onglet **Collaborateurs**, l'administrateur gère les fiches individuelles :
* **Informations d'Identité** : Civilité (M., Mme), Prénom, Nom, Titre ou Fonction.
* **Multi-Numéros de Téléphone** :
  * Saisie indépendante du numéro de Mobile, de Fixe professionnel et de Fax.
  * Choix du **numéro par défaut** déclenché par le bouton d'action principal.
* **Adresse E-mail professionnelle**.
* **Adresse Spécifique ou Héritée** : Utilisation de l'adresse générale de l'entreprise ou saisie d'une adresse de site/agence dédiée.
* **Photo de Profil Interactive** :
  * Importation de la photo du collaborateur.
  * Outils de cadrage intuitifs : curseur de **zoom** (1x à 3x), déplacement horizontal (**axe X**) et déplacement vertical (**axe Y**).
* **Identifiant URL Personnalisé (Slug)** :
  * Définition d'une adresse personnalisée simplifiée (ex. `tdconnect.fr/c/dupont`).
* **Statut Actif / Inactif** :
  * Possibilité de désactiver temporairement la carte d'un collaborateur sans supprimer sa fiche.
* **Compteur de Visites** : Suivi du nombre de consultations de la carte.

---

### 2.5 Import et Export de Données (Excel)
* **Importation Massive Excel (`.xlsx`)** :
  * Création automatique d'une série de collaborateurs à partir d'un fichier tableur.
  * Détection automatique des colonnes (Nom, Prénom, Rôle, Téléphones, E-mail, Ville...).
* **Exportation Excel** : Téléchargement de la base complète des collaborateurs de l'entreprise au format `.xlsx`.
* **Exportation ZIP Autonome** : Téléchargement du package autonome de chaque collaborateur pour hébergement indépendant sur tout serveur web.

---

### 2.6 Suivi de l'Abonnement et Sécurité du Compte
* **Bannière d'Abonnement** :
  * L'administrateur visualise l'état de son offre (Période offerte ou Abonnement payant) et sa date de fin.
  * **Gestion des permissions du message de bas de page** :
    * En période payante : l'administrateur peut modifier librement le message et l'URL de bas de carte.
    * En période offerte : ces champs sont verrouillés (réservés au Super Admin).
* **Sécurité du Compte Personnel** :
  * Modification du mot de passe avec validation dynamique des règles (minimum 8 caractères, au moins une lettre, au moins un chiffre).
  * Affichage/masquage du mot de passe par icône œil.

---

# Partie 3 : Fonctions du Super Administrateur

Le **Super Administrateur** dispose des droits d'administration les plus élevés de la plateforme TDConnect.

### 3.1 Périmètre Global
* Vision et supervision panoramique sur **l'ensemble des entreprises** et de leurs collaborateurs.
* Gestion des abonnements, des statuts financiers et des dates de validité.
* Création et administration de tous les comptes utilisateurs (administrateurs et super-administrateurs).
* Configuration des **Paramètres Généraux** transversaux régissant le comportement de l'ensemble de la plateforme.

---

### 3.2 Supervision Multi-Entreprises
* **Sélecteur d'Entreprise Centralisé** :
  * Accès instantané à n'importe quelle entreprise depuis le menu déroulant de l'en-tête.
  * Création d'une nouvelle entreprise ou suppression définitive d'une structure existante (avec nettoyage automatique des collaborateurs associés).
* **Indicateurs de Performance dans la Liste des Entreprises** :
  * Dénombrement en temps réel du nombre de collaborateurs actifs et inactifs.
  * Affichage du type d'abonnement et de la date d'échéance.
  * **Pastilles d'état d'abonnement quadricolores** :
    * 🟢 **Vert** : Abonnement payant en cours de validité.
    * 🟡 **Jaune** : Période offerte d'essai en cours de validité.
    * 🟠 **Orange** : Entreprise suspendue manuellement.
    * 🔴 **Rouge** : Abonnement ou période offerte échu(e).

---

### 3.3 Gestion des Abonnements et des Droits Avancés
Sur la fiche de chaque entreprise, le Super Admin est le seul à pouvoir modifier les critères contractuels :
* **Type d'Abonnement** : Basculement entre `Offerte`, `Payant` et `Echu`.
* **Date d'Échéance** : Modification libre du calendrier de fin de validité.
* **Interrupteur d'Activation** : Suspension immédiate (`is_subscription_active = 0`) ou réactivation d'une entreprise.
* **Contrôle Total du Message de Bas de Carte** :
  * Le Super Admin peut modifier le texte promotionnel, l'URL de redirection et activer/désactiver le message de bas de carte, **y compris pour les entreprises en période offerte**.

---

### 3.4 Administration des Utilisateurs
Dans la modale de **Gestion des Utilisateurs** :
* **Création d'Utilisateurs** : Attribution du nom, prénom, e-mail et rôle (`admin` ou `superadmin`).
* **Liaison Utilisateur - Entreprise** : Association d'un administrateur à une ou plusieurs entreprises.
* **Gestion des Mots de Passe** :
  * Attribution manuelle d'un mot de passe initial ou temporaire.
  * Déclenchement de l'envoi d'un e-mail sécurisé de réinitialisation de mot de passe avec lien à usage unique direct vers la modale de modification.
* **Suppression de Comptes** : Retrait immédiat des accès d'un utilisateur sans altérer les données de l'entreprise.

---

### 3.5 Paramètres Généraux de la Plateforme
Accessible uniquement aux Super Administrateurs via le bouton **Paramètres Généraux** :

1. **Délai d'Inactivité de Session** :
   * Configuration de la temporisation d'inactivité avant déconnexion automatique (15 min, 30 min, 1 heure, 2 heures, 4 heures...).
2. **Support Technique et Contact** :
   * Définition de l'adresse e-mail de support globale (ex. `contact@tdconnect.fr`).
   * Cette adresse est automatiquement mise à jour dans tous les encarts d'aide et liens de contact de l'application.
3. **Abonnements & Période Offerte (Modèle par défaut)** :
   * **Durée de la période offerte** : nombre de jours offerts lors de la création d'une nouvelle entreprise (par défaut : 30 jours).
   * **Texte dans le bas de la carte en période offerte** : modèle de message promotionnel (ex. *"Créez votre propre carte sur TDConnect"*).
   * **URL de redirection au clic sur le message** : lien vers lequel le contact est redirigé s'il clique sur le bas de carte.
   * *Rôle clé :* Ces paramètres constituent le **modèle d'initialisation automatique** injecté dans toute nouvelle entreprise créée manuellement ou par autosouscription.

---

*Document maintenu et synchronisé avec le code source de l'application TDConnect.*
