const db = require('../server/database.cjs');

async function testLoad() {
  await db.dbReady;
  const companies = await db.getCompanies();
  console.log("Nom de la première entreprise:", companies[0].name);

  const users = await db.getUsers();
  console.log("Nombre d'utilisateurs:", users.length);
  users.forEach(u => {
    console.log(`User ID: ${u.id}, Role: ${u.role}, ManagedCompanies:`, u.managedCompanies);
  });

  console.log("Vérification terminée avec succès!");
  process.exit(0);
}

testLoad().catch(err => {
  console.error("Test échec:", err);
  process.exit(1);
});
