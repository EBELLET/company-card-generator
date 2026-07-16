const express = require('express');
const cors = require('cors');
const db = require('./database.cjs');
const seed = require('./seed.cjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const crypto = require('crypto');

// --- Custom JWT Authentication Helpers using crypto ---
const SECRET_KEY = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, body, signature] = token.split('.');
    const expectedSignature = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: "Token d'authentification manquant." });
  
  const decoded = verifyToken(token);
  if (!decoded) return res.status(403).json({ error: "Session expirée ou invalide. Veuillez vous reconnecter." });
  
  req.user = decoded;
  next();
}

// Serve static frontend files in production (Docker & unified host hosting)
const path = require('path');
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// --- HTML Template for Virtual Business Card ---
function generateVirtualCardHTML(collab, company, isStandalone = false) {
  const accentColor = company.accent_color || '#6366f1';
  const theme = company.theme || 'theme-glass';
  const fontClass = company.font || 'font-outfit';
  const companyName = company.name || '';
  const avatarSize = company.avatar_size != null ? company.avatar_size : 100;
  
  const cleanFirst = collab.firstName.trim().replace(/[^a-zA-Z0-9-]/g, '_');
  const cleanLast = collab.lastName.trim().toUpperCase().replace(/[^a-zA-Z0-9-]/g, '_');
  const vcfFilename = `${cleanFirst}_${cleanLast}.vcf`;
  
  const showCustomMsg = company.show_tdconnect_message !== 0;
  const customMsgHTML = (showCustomMsg && company.tdconnect_message) ? `<div class="tdconnect-custom-message" style="font-size: 0.65rem; color: var(--text-muted); opacity: 0.8; margin-top: 0.35rem; font-weight: 500; text-align: center; width: 100%;">${company.tdconnect_message}</div>` : '';
  
  // Resolve profile picture with alignment properties
  let avatarHTML = '';
  if (collab.photoUrl) {
    const zoom = collab.photoZoom != null ? parseFloat(collab.photoZoom) : 1.0;
    const x = collab.photoX != null ? parseFloat(collab.photoX) : 50;
    const y = collab.photoY != null ? parseFloat(collab.photoY) : 50;
    
    const transX = zoom > 1 ? (50 - x) * (1 - 1 / zoom) : 0;
    const transY = zoom > 1 ? (50 - y) * (1 - 1 / zoom) : 0;
    
    let photoSrc = collab.photoUrl;
    if (isStandalone) {
      let photoExt = 'png';
      if (collab.photoUrl.startsWith('data:image/')) {
        const mime = collab.photoUrl.split(';')[0].split(':')[1];
        photoExt = mime.split('/')[1] || 'png';
      }
      photoSrc = `./photo.${photoExt}`;
    }
    
    avatarHTML = `<img src="${photoSrc}" style="transform: scale(${zoom}) translate(${transX}%, ${transY}%); object-position: 50% 50%;" alt="${collab.firstName} ${collab.lastName}" />`;
  } else {
    const initials = (collab.firstName[0] + (collab.lastName[0] || '')).toUpperCase();
    avatarHTML = `<div class="initials-avatar">${initials}</div>`;
  }

  // Wrap avatarHTML in a link if custom click Url is set
  const clickUrlVal = collab.photoClickUrl || '';
  if (clickUrlVal) {
    const targetUrl = clickUrlVal.startsWith('http') ? clickUrlVal : 'https://' + clickUrlVal;
    avatarHTML = `<a href="${targetUrl}" target="_blank" style="display: contents; cursor: pointer;">${avatarHTML}</a>`;
  }

  // Resolve logo redirection target url
  const companyUrlVal = company.domain || '';
  const logoTargetUrl = companyUrlVal ? (companyUrlVal.startsWith('http') ? companyUrlVal : 'https://' + companyUrlVal) : '#';

  // Resolve logo
  let logoHTML = '';
  let logoSrc = company.logo_custom_url || (company.domain ? `https://logo.clearbit.com/${company.domain}?size=128` : '');
  if (isStandalone && logoSrc) {
    let logoExt = 'png';
    if (logoSrc.startsWith('data:image/')) {
      const mime = logoSrc.split(';')[0].split(':')[1];
      logoExt = mime.split('/')[1] || 'png';
    }
    logoSrc = `./logo.${logoExt}`;
  }
  
  const showNameUnderLogo = company.show_name_under_logo !== 0;
  if (logoSrc) {
    const nameSubtext = showNameUnderLogo ? `<div class="company-logo-subtext" style="font-size: 0.85rem; font-weight: 700; margin-top: 0.35rem; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent); text-align: center;">${companyName}</div>` : '';
    logoHTML = `<a href="${logoTargetUrl}" target="_blank" style="display:flex; flex-direction:column; align-items:center; text-decoration:none; color:inherit;"><img class="company-logo" src="${logoSrc}" alt="${companyName} Logo" />${nameSubtext}</a>`;
  } else {
    logoHTML = `<a href="${logoTargetUrl}" target="_blank" style="text-decoration:none; color:inherit;"><span class="company-logo-text">${companyName}</span></a>`;
  }

  // Resolve address
  let street = collab.address ? collab.address.trim() : '';
  if (!street) {
    const mainStreet = company.address || '';
    const mainZip = company.zip || '';
    const mainCity = company.city || '';
    const mainCountry = company.country || '';
    street = mainStreet;
    if (mainZip || mainCity) {
      street += (street ? ', ' : '') + `${mainZip} ${mainCity}`.trim();
    }
    if (mainCountry) {
      street += (street ? ', ' : '') + mainCountry;
    }
  }
  if (!street) street = 'Adresse non renseignée';

  // Fonts URL loading
  let fontLink = '';
  if (fontClass === 'font-playfair') {
    fontLink = '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet">';
  } else if (fontClass === 'font-mono') {
    fontLink = '<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet">';
  } else {
    fontLink = '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap" rel="stylesheet">';
  }
  // Determine active phone number based on choice
  let activePhone = collab.phoneMobile || collab.phone || '';
  let activePhoneLabel = 'Mobile';
  if (collab.phoneDefault === 'work') {
    activePhone = collab.phoneWork || activePhone;
    activePhoneLabel = 'Fixe';
  } else if (collab.phoneDefault === 'fax') {
    activePhone = collab.phoneFax || activePhone;
    activePhoneLabel = 'Fax';
  } else {
    activePhone = collab.phoneMobile || activePhone;
    activePhoneLabel = 'Mobile';
  }

  const buttonStyle = company.button_style || 'rectangle';
  let buttonsHTML = '';
  if (buttonStyle === 'round') {
    buttonsHTML = `
    <div class="actions-list-round">
      <a href="tel:${activePhone}" class="action-row-btn" title="${activePhoneLabel} : ${activePhone}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
      </a>

      <a href="mailto:${collab.email}" class="action-row-btn" title="Email : ${collab.email}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
      </a>

      <a href="${isStandalone ? `./${vcfFilename}` : `/api/collaborators/${collab.id}/vcf`}" class="action-row-btn" title="vCard">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      </a>
    </div>
    `;
  } else {
    buttonsHTML = `
    <div class="actions-list-stacked">
      <a href="tel:${activePhone}" class="action-row-btn">
        <span>${activePhoneLabel} : ${activePhone}</span>
      </a>

      <a href="mailto:${collab.email}" class="action-row-btn">
        <span>Email : ${collab.email}</span>
      </a>

      <a href="${isStandalone ? `./${vcfFilename}` : `/api/collaborators/${collab.id}/vcf`}" class="action-row-btn">
        <span>Téléchargez ma vCard</span>
      </a>
    </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${collab.firstName} ${collab.lastName} - Carte de Visite Virtuelle</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${fontLink}
  
  <style>
    :root {
      --accent: ${accentColor};
    }

    /* THEME STYLING RULES */
    body.theme-glass {
      --bg: #f1f5f9;
      --card-bg: #ffffff;
      --card-border: rgba(0, 0, 0, 0.05);
      --text: #0f172a;
      --text-muted: #475569;
    }

    body.theme-obsidian {
      --bg: #0b0f19;
      --card-bg: #111827;
      --card-border: rgba(255, 255, 255, 0.08);
      --text: #f9fafb;
      --text-muted: #9ca3af;
    }

    body.theme-aurora {
      --bg: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
      --card-bg: rgba(255, 255, 255, 0.15);
      --card-border: rgba(255, 255, 255, 0.25);
      --text: #ffffff;
      --text-muted: rgba(255, 255, 255, 0.8);
    }

    body.theme-minimalist {
      --bg: #ffffff;
      --card-bg: transparent;
      --card-border: transparent;
      --text: #000000;
      --text-muted: #71717a;
    }

    /* Assign variables dynamically */
    body {
      background: var(--bg);
      background-attachment: fixed;
      color: var(--text);
      font-family: ${fontClass === 'font-playfair' ? "'Playfair Display', serif" : fontClass === 'font-mono' ? "'JetBrains Mono', monospace" : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"};
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start; /* Stable top margin alignment */
      padding: 3rem 1.5rem;
      position: relative;
    }

    @media (max-width: 480px) {
      body {
        padding: 1.5rem 1rem;
      }
      .card-container {
        padding: 1.75rem 1.25rem;
      }
    }

    /* Main Card Frame */
    .card-container {
      width: 100%;
      max-width: 400px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 2.5rem 2rem;
      box-shadow: 
        0 10px 25px -5px rgba(0, 0, 0, 0.05),
        0 8px 10px -6px rgba(0, 0, 0, 0.03);
      text-align: center;
      z-index: 10;
      transition: all 0.3s ease;
    }

    /* Glassmorphism theme specific card effect */
    body.theme-glass .card-container {
      backdrop-filter: blur(8px);
    }

    /* Aurora theme specific card effect */
    body.theme-aurora .card-container {
      backdrop-filter: blur(20px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    }

    /* Minimalist card layout override */
    body.theme-minimalist .card-container {
      box-shadow: none !important;
      border: none !important;
    }

    /* Logo Brand Header */
    .logo-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .company-logo {
      height: ${company.logo_size !== undefined ? company.logo_size : 72}px;
      max-width: ${company.logo_size !== undefined ? company.logo_size * 3.5 : 252}px;
      object-fit: contain;
    }

    .company-logo-text {
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.01em;
      opacity: 0.9;
    }

    /* Company Address underneath Logo */
    .company-address {
      font-size: 0.72rem;
      color: var(--text-muted);
      margin-bottom: 1.5rem;
      line-height: 1.4;
      letter-spacing: 0.02em;
    }

    /* Profile Avatar */
    .avatar-wrapper {
      width: ${avatarSize}px;
      height: ${avatarSize}px;
      border-radius: 50%;
      overflow: hidden;
      margin: 0 auto 1rem auto;
      border: 2px solid var(--accent);
      background: #ffffff;
      box-shadow: 0 4px 10px rgba(0,0,0,0.05);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Aurora theme profile avatar border */
    body.theme-aurora .avatar-wrapper {
      border: 2px solid #ffffff;
    }

    .avatar-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .initials-avatar {
      font-size: ${avatarSize * 0.35}px;
      font-weight: 700;
      color: var(--accent);
      background: rgba(99, 102, 241, 0.05);
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    body.theme-aurora .initials-avatar {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.15);
    }

    body.theme-obsidian .initials-avatar {
      color: var(--text);
      background: rgba(255, 255, 255, 0.05);
    }

    /* Collaborator Identity Names */
    .collab-name {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.015em;
      margin-bottom: 0.25rem;
    }

    .collab-role {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 1.75rem;
    }

    /* Stacked Wide Action Buttons */
    .actions-list-stacked {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
      margin-top: 0.5rem;
    }

    /* Horizontal Circular Buttons Layout */
    .actions-list-round {
      display: flex;
      flex-direction: row;
      justify-content: center;
      gap: 1.25rem;
      width: 100%;
      margin-top: 1rem;
    }

    .actions-list-round .action-row-btn {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .action-row-btn {
      text-decoration: none;
      background: var(--accent);
      color: #ffffff !important;
      font-weight: 600;
      font-size: 0.85rem;
      padding: 0.85rem 1.25rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }

    /* Aurora theme specific buttons look white with accent text */
    body.theme-aurora .action-row-btn {
      background: #ffffff;
      color: var(--accent) !important;
    }

    .action-row-btn:hover {
      filter: brightness(0.92);
      transform: translateY(-1px);
    }

    body.theme-aurora .action-row-btn:hover {
      background: rgba(255, 255, 255, 0.9);
      filter: none;
    }

    /* Footer Info */
    .card-footer {
      margin-top: 2rem;
      font-size: 0.72rem;
      color: var(--text-muted);
      opacity: 0.8;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    body.theme-obsidian .card-footer {
      color: #64748b;
    }

    body.theme-aurora .card-footer {
      color: rgba(255, 255, 255, 0.7);
    }
  </style>
</head>
<body class="${theme}">
  <div class="card-container">
    <div class="logo-container">
      ${logoHTML}
    </div>
    
    <div class="company-address">
      ${street.replace(/\r\n|\r|\n/g, '<br>')}
    </div>

    <div class="avatar-wrapper">
      ${avatarHTML}
    </div>

    <h1 class="collab-name">${collab.firstName} ${collab.lastName}</h1>
    <p class="collab-role">${collab.role || 'Collaborateur'}</p>

    ${buttonsHTML}

    <div class="card-footer">
      <div>Carte de visite virtuelle</div>
      ${customMsgHTML}
    </div>
  </div>
</body>
</html>`;
}

// --- Company API Routes ---

app.get('/api/companies', authenticateToken, async (req, res) => {
  try {
    const list = await db.getCompanies();
    if (req.user.role === 'superadmin') {
      return res.json(list);
    }
    const users = await db.getUsers();
    const currUser = users.find(u => u.id === req.user.id);
    const allowedIds = currUser ? currUser.managedCompanies : [];
    const filtered = list.filter(c => allowedIds.includes(c.id));
    res.json(filtered);
  } catch (err) {
    console.error('Erreur GET /api/companies:', err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des entreprises.' });
  }
});

app.get('/api/companies/:id', authenticateToken, async (req, res) => {
  const companyId = parseInt(req.params.id);
  try {
    if (req.user.role !== 'superadmin') {
      const users = await db.getUsers();
      const currUser = users.find(u => u.id === req.user.id);
      const allowedIds = currUser ? currUser.managedCompanies : [];
      if (!allowedIds.includes(companyId)) {
        return res.status(403).json({ error: "Vous n'avez pas l'autorisation d'accéder à cette entreprise." });
      }
    }
    const info = await db.getCompanyById(companyId);
    if (!info) return res.status(404).json({ error: 'Entreprise non trouvée.' });
    res.json(info);
  } catch (err) {
    console.error(`Erreur GET /api/companies/${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'entreprise.' });
  }
});

app.post('/api/companies', authenticateToken, async (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: "Seul le Super Admin peut créer des entreprises." });
  }
  try {
    const newCompany = await db.addCompany(req.body);
    res.status(201).json(newCompany);
  } catch (err) {
    console.error('Erreur POST /api/companies:', err.message);
    res.status(500).json({ error: 'Erreur lors de la création de l\'entreprise.' });
  }
});

app.put('/api/companies/:id', authenticateToken, async (req, res) => {
  const companyId = parseInt(req.params.id);
  if (req.user.role !== 'superadmin') {
    const users = await db.getUsers();
    const currUser = users.find(u => u.id === req.user.id);
    const allowedIds = currUser ? currUser.managedCompanies : [];
    if (!allowedIds.includes(companyId)) {
      return res.status(403).json({ error: "Vous n'avez pas l'autorisation de modifier cette entreprise." });
    }
  }
  try {
    const updated = await db.updateCompany(companyId, req.body);
    res.json(updated);
  } catch (err) {
    console.error(`Erreur PUT /api/companies/${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Erreur lors de la modification de l\'entreprise.' });
  }
});

app.delete('/api/companies/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: "Seul le Super Admin peut supprimer des entreprises." });
  }
  try {
    await db.deleteCompany(req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error(`Erreur DELETE /api/companies/${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'entreprise.' });
  }
});

// --- Collaborators API Routes ---

app.get('/api/companies/:companyId/collaborators', authenticateToken, async (req, res) => {
  const companyId = parseInt(req.params.companyId);
  if (req.user.role !== 'superadmin') {
    const users = await db.getUsers();
    const currUser = users.find(u => u.id === req.user.id);
    const allowedIds = currUser ? currUser.managedCompanies : [];
    if (!allowedIds.includes(companyId)) {
      return res.status(403).json({ error: "Accès refusé pour cette entreprise." });
    }
  }
  try {
    const list = await db.getCollaboratorsForCompany(companyId);
    res.json(list);
  } catch (err) {
    console.error(`Erreur GET collaborateurs pour company ${req.params.companyId}:`, err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération des collaborateurs.' });
  }
});

app.post('/api/companies/:companyId/collaborators', authenticateToken, async (req, res) => {
  const companyId = parseInt(req.params.companyId);
  if (req.user.role !== 'superadmin') {
    const users = await db.getUsers();
    const currUser = users.find(u => u.id === req.user.id);
    const allowedIds = currUser ? currUser.managedCompanies : [];
    if (!allowedIds.includes(companyId)) {
      return res.status(403).json({ error: "Vous n'avez pas l'autorisation d'ajouter des collaborateurs pour cette entreprise." });
    }
  }
  try {
    const data = { ...req.body, companyId };
    const newCollab = await db.addCollaborator(data);
    res.status(201).json(newCollab);
  } catch (err) {
    console.error(`Erreur POST collaborateurs pour company ${req.params.companyId}:`, err.message);
    res.status(500).json({ error: 'Erreur lors de la création du collaborateur.' });
  }
});

app.put('/api/collaborators/:id', authenticateToken, async (req, res) => {
  try {
    const collab = await db.getCollaboratorById(req.params.id);
    if (!collab) return res.status(404).json({ error: "Collaborateur non trouvé." });
    
    if (req.user.role !== 'superadmin') {
      const users = await db.getUsers();
      const currUser = users.find(u => u.id === req.user.id);
      const allowedIds = currUser ? currUser.managedCompanies : [];
      if (!allowedIds.includes(collab.companyId)) {
        return res.status(403).json({ error: "Vous n'avez pas l'autorisation de modifier ce collaborateur." });
      }
    }
    const collabData = { ...req.body, id: req.params.id };
    const updated = await db.updateCollaborator(collabData);
    res.json(updated);
  } catch (err) {
    console.error(`Erreur PUT /api/collaborators/${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du collaborateur.' });
  }
});

app.delete('/api/collaborators/:id', authenticateToken, async (req, res) => {
  try {
    const collab = await db.getCollaboratorById(req.params.id);
    if (!collab) return res.status(404).json({ error: "Collaborateur non trouvé." });
    
    if (req.user.role !== 'superadmin') {
      const users = await db.getUsers();
      const currUser = users.find(u => u.id === req.user.id);
      const allowedIds = currUser ? currUser.managedCompanies : [];
      if (!allowedIds.includes(collab.companyId)) {
        return res.status(403).json({ error: "Vous n'avez pas l'autorisation de supprimer ce collaborateur." });
      }
    }
    await db.deleteCollaborator(req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error(`Erreur DELETE /api/collaborators/${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Erreur lors de la suppression du collaborateur.' });
  }
});

app.get('/api/collaborators/check-slug/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.trim().toLowerCase();
    const excludeId = req.query.excludeId;
    
    if (!slug) {
      return res.json({ available: true });
    }

    const collab = await db.getCollaboratorBySlug(slug);
    if (collab) {
      if (excludeId && collab.id === excludeId) {
        return res.json({ available: true });
      }
      return res.json({ 
        available: false, 
        owner: `${collab.firstName} ${collab.lastName}` 
      });
    }
    return res.json({ available: true });
  } catch (err) {
    console.error(`Erreur GET check-slug pour ${req.params.slug}:`, err.message);
    res.status(500).json({ error: 'Erreur lors de la vérification du lien public.' });
  }
});

// --- Authentication & User Admin Routes ---

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || username.trim().length !== 8) {
    return res.status(400).json({ error: "L'identifiant doit comporter exactement 8 caractères." });
  }
  
  try {
    const user = await db.getUserById(username.trim());
    if (!user) {
      return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
    }
    
    const isValid = await db.verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
    }
    
    // Fetch managed companies
    let managedCompanies = [];
    if (user.role === 'superadmin') {
      const companies = await db.getCompanies();
      managedCompanies = companies.map(c => c.id);
    } else {
      const usersList = await db.getUsers();
      const foundUser = usersList.find(u => u.id === user.id);
      managedCompanies = foundUser ? foundUser.managedCompanies : [];
    }

    const token = generateToken({
      id: user.id,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email
    });

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        managedCompanies
      }
    });
  } catch (err) {
    console.error("Erreur lors de la connexion:", err.message);
    res.status(500).json({ error: "Une erreur est survenue lors de la connexion." });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { companyName, companyDomain, userId, firstName, lastName, email, password } = req.body;

  if (!userId || userId.trim().length !== 8) {
    return res.status(400).json({ error: "L'identifiant doit comporter exactement 8 caractères." });
  }
  if (!firstName || !firstName.trim() || !lastName || !lastName.trim() || !email || !email.trim()) {
    return res.status(400).json({ error: "Veuillez remplir tous les champs obligatoires de l'administrateur." });
  }
  if (!password || password.trim().length < 4) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 4 caractères." });
  }

  try {
    // Hash password
    const passwordHash = await db.hashPassword(password);
    
    // Register
    const { companyId } = await db.registerUserWithCompany({
      id: userId.trim(),
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim()
    }, {
      name: companyName ? companyName.trim() : '',
      domain: companyDomain ? companyDomain.trim() : ''
    });

    // Generate token
    const token = generateToken({
      id: userId.trim(),
      role: 'admin',
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim()
    });

    res.status(201).json({
      token,
      user: {
        id: userId.trim(),
        role: 'admin',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        managedCompanies: companyId ? [companyId] : []
      }
    });
  } catch (err) {
    console.error("Erreur lors de l'inscription:", err.message);
    res.status(400).json({ error: err.message || "Une erreur est survenue lors de l'inscription." });
  }
});

app.put('/api/auth/me', authenticateToken, async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const userId = req.user.id;
  const role = req.user.role; // Maintain original role

  if (!firstName || !firstName.trim() || !lastName || !lastName.trim() || !email || !email.trim()) {
    return res.status(400).json({ error: "Prenom, Nom et Email sont obligatoires." });
  }

  try {
    const updatedUser = await db.updateUser(userId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      role,
      password: password ? password : undefined
    });

    // Fetch updated managed companies
    let managedCompanies = [];
    if (role === 'superadmin') {
      const companies = await db.getCompanies();
      managedCompanies = companies.map(c => c.id);
    } else {
      const usersList = await db.getUsers();
      const foundUser = usersList.find(u => u.id === userId);
      managedCompanies = foundUser ? foundUser.managedCompanies : [];
    }

    // Sign new token
    const token = generateToken({
      id: userId,
      role,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim()
    });

    res.json({
      success: true,
      token,
      user: {
        id: userId,
        role,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        managedCompanies
      }
    });
  } catch (err) {
    console.error("Erreur lors de la mise a jour de mon compte:", err.message);
    res.status(500).json({ error: "Erreur lors de la mise a jour du compte." });
  }
});

// Admin management routes (Super Admin only)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: "Accès réservé au Super Admin." });
  }
  try {
    const users = await db.getUsers();
    res.json(users);
  } catch (err) {
    console.error("Erreur GET /api/admin/users:", err.message);
    res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs." });
  }
});

app.post('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: "Accès réservé au Super Admin." });
  }
  const { id, firstName, lastName, email, role, password, managedCompanies } = req.body;
  if (!id || id.trim().length !== 8) {
    return res.status(400).json({ error: "L'identifiant doit comporter exactement 8 caractères." });
  }
  if (!password || password.trim().length < 4) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 4 caractères." });
  }
  
  try {
    const existing = await db.getUserById(id.trim());
    if (existing) {
      return res.status(400).json({ error: "Cet identifiant est déjà utilisé." });
    }
    
    const newUser = await db.addUser({
      id: id.trim(),
      firstName,
      lastName,
      email,
      role,
      password
    });
    
    if (role === 'admin' && Array.isArray(managedCompanies)) {
      await db.assignCompaniesToUser(newUser.id, managedCompanies);
    }
    
    res.status(201).json(newUser);
  } catch (err) {
    console.error("Erreur POST /api/admin/users:", err.message);
    res.status(500).json({ error: "Erreur lors de la création de l'utilisateur." });
  }
});

app.put('/api/admin/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: "Accès réservé au Super Admin." });
  }
  const { firstName, lastName, email, role, password, managedCompanies } = req.body;
  const userId = req.params.id;
  
  try {
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    }
    
    // Prevent self-demotion or self-deletion of Super Admin role if they are the last one
    if (userId === 'superadm' && role !== 'superadmin') {
      return res.status(400).json({ error: "Impossible de modifier le rôle du Super Admin principal." });
    }
    
    const updated = await db.updateUser(userId, {
      firstName,
      lastName,
      email,
      role,
      password
    });
    
    if (role === 'admin' && Array.isArray(managedCompanies)) {
      await db.assignCompaniesToUser(userId, managedCompanies);
    } else if (role === 'superadmin') {
      // Clear associations for superadmins as they have access to all
      await db.assignCompaniesToUser(userId, []);
    }
    
    res.json(updated);
  } catch (err) {
    console.error("Erreur PUT /api/admin/users/:id:", err.message);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'utilisateur." });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: "Accès réservé au Super Admin." });
  }
  const userId = req.params.id;
  if (userId === 'superadm') {
    return res.status(400).json({ error: "Le Super Admin principal ne peut pas être supprimé." });
  }
  if (userId === req.user.id) {
    return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
  }
  
  try {
    await db.deleteUser(userId);
    res.json({ success: true, id: userId });
  } catch (err) {
    console.error("Erreur DELETE /api/admin/users/:id:", err.message);
    res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur." });
  }
});

// --- Public Virtual Card web page serving ---

app.get('/card/:id', async (req, res) => {
  try {
    let collab = await db.getCollaboratorById(req.params.id);
    if (!collab) {
      collab = await db.getCollaboratorBySlug(req.params.id);
    }
    if (!collab) {
      return res.status(404).send('<h1 style="color:#f43f5e;font-family:sans-serif;text-align:center;margin-top:5rem;">Collaborateur non trouvé</h1>');
    }
    if (collab.isActive === 0) {
      return res.status(403).send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Profil Inactif</title>
          <style>
            body {
              background: radial-gradient(circle at 50% 50%, #0e172a 0%, #020617 100%);
              color: #f8fafc;
              font-family: sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 1.5rem;
              text-align: center;
            }
            .panel {
              background: rgba(15, 23, 42, 0.65);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 24px;
              padding: 3rem 2rem;
              max-width: 400px;
              box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
              backdrop-filter: blur(16px);
            }
            h1 {
              font-size: 1.5rem;
              font-weight: 800;
              margin-bottom: 1rem;
              background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            p {
              color: #94a3b8;
              line-height: 1.6;
              font-size: 0.95rem;
            }
          </style>
        </head>
        <body>
          <div class="panel">
            <h1>Profil Inactif</h1>
            <p>Cette carte de visite virtuelle est actuellement désactivée par son administrateur.</p>
          </div>
        </body>
        </html>
      `);
    }
    const company = await db.getCompanyById(collab.companyId);
    if (!company) {
      return res.status(404).send('<h1 style="color:#f43f5e;font-family:sans-serif;text-align:center;margin-top:5rem;">Entreprise non trouvée</h1>');
    }
    const htmlContent = generateVirtualCardHTML(collab, company);
    
    res.send(htmlContent);
  } catch (err) {
    console.error(`Erreur GET /card/${req.params.id}:`, err.message);
    res.status(500).send('<h1 style="color:#f43f5e;font-family:sans-serif;text-align:center;margin-top:5rem;">Erreur interne lors du chargement de la carte</h1>');
  }
});

// --- Public Direct VCF vCard download link ---

app.get('/api/collaborators/:id/vcf', async (req, res) => {
  try {
    let collab = await db.getCollaboratorById(req.params.id);
    if (!collab) {
      collab = await db.getCollaboratorBySlug(req.params.id);
    }
    if (!collab) return res.status(404).send('Collaborateur non trouvé');
    if (collab.isActive === 0) return res.status(403).send('Ce collaborateur est inactif');
    const company = await db.getCompanyById(collab.companyId);
    if (!company) return res.status(404).send('Entreprise non trouvée');
    
    const companyName = company.name || '';
    const companyUrl = company.domain || '';
    
    let street = collab.address ? collab.address.trim() : '';
    let zip = '';
    let city = '';
    let country = '';

    if (!street) {
      street = company.address || '';
      zip = company.zip || '';
      city = company.city || '';
      country = company.country || '';
    }

    const telLines = [];
    const cleanMobile = (collab.phoneMobile || '').trim();
    const cleanWork = (collab.phoneWork || '').trim();
    const cleanFax = (collab.phoneFax || '').trim();
    const cleanLegacy = (collab.phone || '').trim();

    if (cleanMobile) {
      telLines.push(`TEL;TYPE=CELL,VOICE:${cleanMobile}`);
    }
    if (cleanWork) {
      telLines.push(`TEL;TYPE=WORK,VOICE:${cleanWork}`);
    }
    if (cleanFax) {
      telLines.push(`TEL;TYPE=WORK,FAX:${cleanFax}`);
    }
    if (cleanLegacy && cleanLegacy !== cleanMobile && cleanLegacy !== cleanWork && cleanLegacy !== cleanFax) {
      const hasWork = !!cleanWork;
      telLines.push(`TEL;TYPE=${hasWork ? 'CELL' : 'WORK'},VOICE:${cleanLegacy}`);
    }

    const vcardArray = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `N;CHARSET=ISO-8859-1:${collab.lastName};${collab.firstName};;;`,
      `FN;CHARSET=ISO-8859-1:${collab.firstName} ${collab.lastName}`,
      `ORG;CHARSET=ISO-8859-1:${companyName}`,
      collab.role ? `TITLE;CHARSET=ISO-8859-1:${collab.role}` : '',
      ...telLines,
      `EMAIL;TYPE=WORK,INTERNET:${collab.email}`,
      `ADR;TYPE=WORK;CHARSET=ISO-8859-1:;;${street};${city};;${zip};${country}`,
      companyUrl ? `URL;CHARSET=ISO-8859-1:${companyUrl.startsWith('http') ? companyUrl : 'https://' + companyUrl}` : '',
      "REV:" + new Date().toISOString(),
      "END:VCARD"
    ].filter(line => line !== '');

    const vcardContent = vcardArray.join("\r\n");
    // Send as ISO-8859-1 content type for legacy Windows Contacts compatibility
    const cleanFirst = collab.firstName.trim().replace(/[^a-zA-Z0-9-]/g, '_');
    const cleanLast = collab.lastName.trim().toUpperCase().replace(/[^a-zA-Z0-9-]/g, '_');
    res.setHeader('Content-Type', 'text/vcard; charset=windows-1252');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFirst}_${cleanLast}.vcf"`);
    
    // Output ISO-8859-1 directly as single bytes (resolves BOM crash)
    const vcardBuffer = Buffer.from(vcardContent, 'latin1');
    res.send(vcardBuffer);
  } catch (err) {
    console.error(`Erreur GET VCF pour ${req.params.id}:`, err.message);
    res.status(500).send('Erreur lors du téléchargement de la vCard.');
  }
});

// --- Public ZIP archive package downloader for external hosting ---

app.get('/api/collaborators/:id/export', async (req, res) => {
  try {
    const AdmZip = require('adm-zip');
    let collab = await db.getCollaboratorById(req.params.id);
    if (!collab) {
      collab = await db.getCollaboratorBySlug(req.params.id);
    }
    if (!collab) return res.status(404).send('Collaborateur non trouvé');
    if (collab.isActive === 0) return res.status(403).send('Ce collaborateur est inactif');
    const company = await db.getCompanyById(collab.companyId);
    if (!company) return res.status(404).send('Entreprise non trouvée');

    const zip = new AdmZip();

    // 1. Resolve photo file
    let photoExt = 'png';
    let photoBuffer = null;
    if (collab.photoUrl) {
      if (collab.photoUrl.startsWith('data:image/')) {
        const matches = collab.photoUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          photoExt = mime.split('/')[1] || 'png';
          photoBuffer = Buffer.from(matches[2], 'base64');
        }
      } else {
        // Fetch external image url
        try {
          const imgRes = await fetch(collab.photoUrl);
          if (imgRes.ok) {
            photoBuffer = Buffer.from(await imgRes.arrayBuffer());
            const mime = imgRes.headers.get('content-type') || '';
            photoExt = mime.split('/')[1] || 'png';
          }
        } catch (e) {
          console.error("Échec de récupération de la photo externe pour export ZIP:", e.message);
        }
      }
    }

    if (photoBuffer) {
      zip.addFile(`photo.${photoExt}`, photoBuffer);
    }

    // 2. Resolve logo file
    let logoExt = 'png';
    let logoBuffer = null;
    const logoSrc = company.logo_custom_url || (company.domain ? `https://logo.clearbit.com/${company.domain}?size=128` : '');
    if (logoSrc) {
      if (logoSrc.startsWith('data:image/')) {
        const matches = logoSrc.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          logoExt = mime.split('/')[1] || 'png';
          logoBuffer = Buffer.from(matches[2], 'base64');
        }
      } else {
        // Fetch external image url
        try {
          const logoRes = await fetch(logoSrc);
          if (logoRes.ok) {
            logoBuffer = Buffer.from(await logoRes.arrayBuffer());
            const mime = logoRes.headers.get('content-type') || '';
            logoExt = mime.split('/')[1] || 'png';
          }
        } catch (e) {
          console.error("Échec de récupération du logo externe pour export ZIP:", e.message);
        }
      }
    }

    if (logoBuffer) {
      zip.addFile(`logo.${logoExt}`, logoBuffer);
    }

    // 3. Generate standalone index.html
    const htmlContent = generateVirtualCardHTML(collab, company, true);
    zip.addFile('index.html', Buffer.from(htmlContent, 'utf-8'));

    // 4. Generate contact.vcf
    const companyName = company.name || '';
    const companyUrl = company.domain || '';
    let street = collab.address ? collab.address.trim() : '';
    let zipCode = '';
    let city = '';
    let country = '';

    if (!street) {
      street = company.address || '';
      zipCode = company.zip || '';
      city = company.city || '';
      country = company.country || '';
    }

    const telLines = [];
    const cleanMobile = (collab.phoneMobile || '').trim();
    const cleanWork = (collab.phoneWork || '').trim();
    const cleanFax = (collab.phoneFax || '').trim();
    const cleanLegacy = (collab.phone || '').trim();

    if (cleanMobile) {
      telLines.push(`TEL;TYPE=CELL,VOICE:${cleanMobile}`);
    }
    if (cleanWork) {
      telLines.push(`TEL;TYPE=WORK,VOICE:${cleanWork}`);
    }
    if (cleanFax) {
      telLines.push(`TEL;TYPE=WORK,FAX:${cleanFax}`);
    }
    if (cleanLegacy && cleanLegacy !== cleanMobile && cleanLegacy !== cleanWork && cleanLegacy !== cleanFax) {
      const hasWork = !!cleanWork;
      telLines.push(`TEL;TYPE=${hasWork ? 'CELL' : 'WORK'},VOICE:${cleanLegacy}`);
    }

    const vcardArray = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `N;CHARSET=ISO-8859-1:${collab.lastName};${collab.firstName};;;`,
      `FN;CHARSET=ISO-8859-1:${collab.firstName} ${collab.lastName}`,
      `ORG;CHARSET=ISO-8859-1:${companyName}`,
      collab.role ? `TITLE;CHARSET=ISO-8859-1:${collab.role}` : '',
      ...telLines,
      `EMAIL;TYPE=WORK,INTERNET:${collab.email}`,
      `ADR;TYPE=WORK;CHARSET=ISO-8859-1:;;${street};${city};;${zipCode};${country}`,
      companyUrl ? `URL;CHARSET=ISO-8859-1:${companyUrl.startsWith('http') ? companyUrl : 'https://' + companyUrl}` : '',
      "REV:" + new Date().toISOString(),
      "END:VCARD"
    ].filter(line => line !== '');

    const vcardContent = vcardArray.join("\r\n");
    
    // Send as ISO-8859-1 content type for Windows Contacts
    const vcardBuffer = Buffer.from(vcardContent, 'latin1');
    const cleanFirst = collab.firstName.trim().replace(/[^a-zA-Z0-9-]/g, '_');
    const cleanLast = collab.lastName.trim().toUpperCase().replace(/[^a-zA-Z0-9-]/g, '_');
    zip.addFile(`${cleanFirst}_${cleanLast}.vcf`, vcardBuffer);

    // 5. Send ZIP archive buffer
    const zipBuffer = zip.toBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFirst}_${cleanLast}.zip"`);
    res.send(zipBuffer);
  } catch (err) {
    console.error(`Erreur GET ZIP pour ${req.params.id}:`, err.message);
    res.status(500).send('Erreur lors de la génération du fichier ZIP.');
  }
});

// Run Express API Server and trigger Seed Seeding
app.listen(PORT, async () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const localIPs = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIPs.push(iface.address);
      }
    }
  }

  console.log(`Serveur API SQLite démarré sur http://localhost:${PORT}`);
  localIPs.forEach(ip => {
    console.log(`Disponible sur le réseau local : http://${ip}:${PORT}`);
  });

  // Wait for database schema initialization
  await db.dbReady;
  // Run seed check
  await seed();
});
