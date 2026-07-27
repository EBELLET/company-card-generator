const db = require('../server/database.cjs');

async function testUrl() {
  await db.dbReady;

  const companies = await db.getCompanies();
  if (companies.length === 0) {
    console.log("Aucune entreprise trouvée.");
    process.exit(0);
  }

  const comp = companies[0];
  console.log("Entreprise initialement:", comp.name, "Message:", comp.tdconnect_message, "URL:", comp.tdconnect_url);

  // Update URL
  await db.updateCompany(comp.id, {
    ...comp,
    show_tdconnect_message: 1,
    tdconnect_message: 'Message test redirection',
    tdconnect_url: 'https://example.com/promo'
  });

  const updated = await db.getCompanyById(comp.id);
  console.log("Entreprise mise à jour - Message:", updated.tdconnect_message, "URL:", updated.tdconnect_url);

  if (updated.tdconnect_url !== 'https://example.com/promo') {
    throw new Error("Attendu: https://example.com/promo, obtenu: " + updated.tdconnect_url);
  }

  console.log("Test URL de redirection réussi avec succès !");
  process.exit(0);
}

testUrl().catch(err => {
  console.error("Test échec:", err);
  process.exit(1);
});
