const db = require('./database.cjs');

async function seed() {
  try {
    // 1. Check if database already has companies
    const companies = await db.getCompanies();
    if (companies.length > 0) {
      console.log('La base de données contient déjà des entreprises. Amorçage ignoré.');
      return;
    }

    console.log("Début de l'amorçage de la base de données SQLite...");

    // 2. Fetch Estimancy Logo as Base64
    let logoBase64 = '';
    const logoUrl = 'https://www.estimancy.com/Contacts/Estimancy_Logo_Base%20Line_300px_RVB.png';
    try {
      console.log(`Téléchargement du logo depuis ${logoUrl}...`);
      const logoRes = await fetch(logoUrl);
      if (logoRes.ok) {
        const logoBuf = Buffer.from(await logoRes.arrayBuffer());
        const mime = logoRes.headers.get('content-type') || 'image/png';
        logoBase64 = `data:${mime};base64,${logoBuf.toString('base64')}`;
        console.log("Logo Estimancy converti en Base64 avec succès.");
      } else {
        console.warn("Échec du téléchargement du logo. Code HTTP:", logoRes.status);
      }
    } catch (e) {
      console.error("Erreur lors de la récupération du logo:", e.message);
    }

    // 3. Fetch Eric Bellet Profile Photo as Base64
    let photoBase64 = '';
    const photoUrl = 'https://www.estimancy.com/Contacts/Eric%20BELLET.png';
    try {
      console.log(`Téléchargement de la photo depuis ${photoUrl}...`);
      const photoRes = await fetch(photoUrl);
      if (photoRes.ok) {
        const photoBuf = Buffer.from(await photoRes.arrayBuffer());
        const mime = photoRes.headers.get('content-type') || 'image/png';
        photoBase64 = `data:${mime};base64,${photoBuf.toString('base64')}`;
        console.log("Photo d'Eric Bellet convertie en Base64 avec succès.");
      } else {
        console.warn("Échec du téléchargement de la photo. Code HTTP:", photoRes.status);
      }
    } catch (e) {
      console.error("Erreur lors de la récupération de la photo:", e.message);
    }

    // 4. Seed Company (Estimancy)
    console.log("Insertion de l'entreprise Estimancy...");
    const companyData = {
      name: 'Estimancy',
      domain: 'estimancy.com',
      address: '5 Avenue Carnot',
      zip: '91300',
      city: 'Massy',
      country: 'France',
      logo_custom_url: logoBase64,
      theme: 'theme-glass',
      font: 'font-outfit',
      accent_color: '#0284c7', // Blue accent color
      logo_size: 72,
      button_style: 'rectangle',
      show_tdconnect_message: 0,
      tdconnect_message: 'TDConnect est une marque de TDC Création'
    };
    
    const company = await db.addCompany(companyData);
    console.log(`Entreprise Estimancy créée avec l'ID: ${company.id}`);

    // 5. Seed Collaborator (Eric BELLET)
    console.log("Insertion du collaborateur Eric BELLET...");
    const collaboratorData = {
      id: 'ebe',
      companyId: company.id,
      firstName: 'Eric',
      lastName: 'BELLET',
      civility: 'M.',
      role: 'Directeur Associé',
      phone: '+33 6 70 17 48 23',
      email: 'eric.bellet@estimancy.com',
      address: '',
      photoUrl: photoBase64,
      phoneMobile: '+33 6 70 17 48 23',
      phoneWork: '+33 1 80 84 52 40', // Sample Estimancy work number
      phoneFax: '+33 1 80 84 52 41',
      phoneDefault: 'mobile'
    };

    await db.addCollaborator(collaboratorData);
    console.log("Collaborateur Eric BELLET inséré avec succès.");
    
    console.log("Amorçage de la base de données terminé avec succès !");

  } catch (err) {
    console.error("Erreur lors de l'amorçage de la base de données:", err.message);
  }
}

module.exports = seed;
