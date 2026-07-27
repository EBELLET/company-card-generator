require('dotenv').config();
const nodemailer = require('nodemailer');

const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

t.sendMail({
  from: '"TDConnect" <noreply@tdconnect.fr>',
  to: 'eric@bellet.me',
  subject: 'Test TDConnect - Envoi email',
  html: `<div style="font-family:sans-serif; background:#0f0f1a; color:#e2e8f0; padding:40px; border-radius:16px; max-width:500px; margin:auto;">
    <h2 style="color:#818cf8;">✅ Test réussi !</h2>
    <p>Votre configuration email <strong>TDConnect</strong> fonctionne correctement.</p>
    <p>Vous recevrez dorénavant les emails de :</p>
    <ul>
      <li>Création de compte administrateur</li>
      <li>Réinitialisation de mot de passe</li>
    </ul>
  </div>`
}).then(info => {
  console.log('Email envoyé avec succès !');
  console.log('MessageId:', info.messageId);
  process.exit(0);
}).catch(e => {
  console.error('Erreur envoi:', e.message);
  process.exit(1);
});
