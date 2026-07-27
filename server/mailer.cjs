/**
 * Service d'envoi de mail via SMTP (nodemailer)
 * Utilise les variables d'environnement SMTP_* du fichier .env
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

// ── Transporteur SMTP ─────────────────────────────────────────────────────────
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: (process.env.SMTP_SECURE || 'true') === 'true', // true = SSL/TLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  return transporter;
}

// ── Adresse & nom de l'expéditeur ─────────────────────────────────────────────
function getSender() {
  const name = process.env.SMTP_FROM_NAME || 'TDConnect';
  const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  return `"${name}" <${email}>`;
}

// ── URL publique de l'application ─────────────────────────────────────────────
function getAppUrl(origin) {
  let rawUrl = origin || process.env.APP_URL;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      return `${parsed.protocol}//${parsed.host}`;
    } catch (e) {
      if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
        try {
          const parsed = new URL(`http://${rawUrl}`);
          return `${parsed.protocol}//${parsed.host}`;
        } catch (err) {}
      }
      return rawUrl;
    }
  }
  return `http://localhost:${process.env.PORT || 3000}`;
}

// ── Template HTML commun ─────────────────────────────────────────────────────
function htmlWrapper(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #0f0f1a; font-family: 'Segoe UI', Arial, sans-serif; }
    .wrapper { max-width: 580px; margin: 40px auto; background: #1a1a2e; border-radius: 16px; overflow: hidden; border: 1px solid rgba(99,102,241,0.2); }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 1.5rem; font-weight: 700; letter-spacing: 0.03em; }
    .header p { margin: 6px 0 0; color: rgba(255,255,255,0.75); font-size: 0.85rem; }
    .body { padding: 36px 40px; color: #d1d5db; line-height: 1.7; }
    .body h2 { color: #e2e8f0; font-size: 1.1rem; margin-top: 0; }
    .info-box { background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
    .info-box .label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
    .info-box .value { font-size: 1rem; color: #e2e8f0; font-weight: 600; font-family: monospace; }
    .btn { display: inline-block; margin: 24px 0 8px; padding: 14px 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff !important; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 0.95rem; letter-spacing: 0.03em; }
    .footer { background: #0f0f1a; padding: 20px 40px; text-align: center; font-size: 0.75rem; color: #4b5563; border-top: 1px solid rgba(255,255,255,0.05); }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 20px 0; }
    p { margin: 0 0 12px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🪪 TDConnect</h1>
      <p>Plateforme de cartes de visite virtuelles</p>
    </div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">Cet email a été envoyé automatiquement par TDConnect. Merci de ne pas y répondre.</div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Email de bienvenue à la création de compte admin
// ─────────────────────────────────────────────────────────────────────────────
async function sendWelcomeEmail({ to, firstName, lastName, userId, password, origin }) {
  const appUrl = getAppUrl(origin);
  const subject = 'Votre compte TDConnect a été créé';

  const body = `
    <h2>Bienvenue ${firstName} ${lastName} 👋</h2>
    <p>Un compte administrateur TDConnect vient d'être créé pour vous. Voici vos identifiants de connexion :</p>

    <div class="info-box">
      <div class="label">Identifiant</div>
      <div class="value">${userId}</div>
    </div>
    <div class="info-box">
      <div class="label">Mot de passe temporaire</div>
      <div class="value">${password}</div>
    </div>

    <p style="margin-top:20px;">Connectez-vous dès maintenant et modifiez votre mot de passe lors de votre première connexion :</p>
    <a href="${appUrl}" class="btn">Accéder à TDConnect →</a>

    <hr class="divider"/>
    <p style="font-size:0.8rem; color:#6b7280;">Pour des raisons de sécurité, nous vous recommandons de changer votre mot de passe dès votre première connexion.</p>
  `;

  await getTransporter().sendMail({
    from: getSender(),
    to,
    subject,
    html: htmlWrapper(subject, body)
  });

  console.log(`[Mail] Email de bienvenue envoyé à ${to}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Email de réinitialisation du mot de passe
// ─────────────────────────────────────────────────────────────────────────────
async function sendPasswordResetEmail({ to, firstName, lastName, userId, resetToken, origin }) {
  const appUrl = getAppUrl(origin);
  const resetUrl = `${appUrl}/?token=${resetToken}`;
  const subject = `Réinitialisation du mot de passe pour le compte ${userId}`;

  const body = `
    <h2>Réinitialisation de mot de passe 🔑</h2>
    <p>Bonjour ${firstName} ${lastName || ''},</p>
    <p>Nous avons reçu une demande de réinitialisation du mot de passe pour votre compte administrateur <strong>TDConnect</strong>.</p>
    
    <div class="info-box">
      <div class="label">Identifiant du compte concerné</div>
      <div class="value">${userId}</div>
    </div>

    <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe pour ce compte. Ce lien est <strong>valable 1 heure</strong>.</p>

    <a href="${resetUrl}" class="btn">Réinitialiser le mot de passe (${userId}) →</a>

    <hr class="divider"/>
    <p style="font-size:0.8rem; color:#6b7280;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email. Le mot de passe du compte <strong>${userId}</strong> ne sera pas modifié.</p>
    <p style="font-size:0.8rem; color:#6b7280;">Lien direct :<br/><a href="${resetUrl}" style="color:#818cf8;">${resetUrl}</a></p>
  `;

  await getTransporter().sendMail({
    from: getSender(),
    to,
    subject,
    html: htmlWrapper(subject, body)
  });

  console.log(`[Mail] Email de réinitialisation envoyé à ${to}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Vérification de la configuration SMTP au démarrage
// ─────────────────────────────────────────────────────────────────────────────
async function verifyMailConfig() {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'];
  const missing = required.filter(k => !process.env[k]);

  if (missing.length > 0) {
    console.warn(`[Mail] ⚠ Configuration SMTP incomplète. Variables manquantes : ${missing.join(', ')}`);
    console.warn('[Mail] ⚠ L\'envoi d\'email est désactivé.');
    return false;
  }

  try {
    await getTransporter().verify();
    console.log(`[Mail] ✔ Connexion SMTP vérifiée (${process.env.SMTP_HOST}:${process.env.SMTP_PORT})`);
    return true;
  } catch (err) {
    console.error(`[Mail] ✘ Échec de la connexion SMTP : ${err.message}`);
    return false;
  }
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  verifyMailConfig
};
