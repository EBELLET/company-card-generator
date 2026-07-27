const db = require('../server/database.cjs');

async function runTest() {
  console.log("Attente de l'initialisation de la base de données...");
  await db.dbReady;

  const testCollabId = 'test_collab_' + Date.now();
  console.log("Création d'un collaborateur de test:", testCollabId);

  // Get first company id or create temporary company
  const companies = await db.getCompanies();
  let companyId = companies.length > 0 ? companies[0].id : null;

  if (!companyId) {
    const newComp = await db.addCompany({ name: 'Entreprise Test' });
    companyId = newComp.id;
  }

  // 1. Add collaborator
  await db.addCollaborator({
    id: testCollabId,
    companyId: companyId,
    firstName: 'Test',
    lastName: 'Counter',
    email: 'testcounter@example.com',
    role: 'Developpeur',
    connectionCount: 5
  });

  let collab = await db.getCollaboratorById(testCollabId);
  console.log("Collaborateur créé - Compteur initial:", collab.connectionCount);
  if (collab.connectionCount !== 5) {
    throw new Error("Attendu: 5, obtenu: " + collab.connectionCount);
  }

  // 2. Increment connection count
  await db.incrementCollaboratorConnectionCount(testCollabId);

  collab = await db.getCollaboratorById(testCollabId);
  console.log("Après incrémentation - Compteur:", collab.connectionCount);
  if (collab.connectionCount !== 6) {
    throw new Error("Attendu: 6, obtenu: " + collab.connectionCount);
  }

  // 3. Update connection count explicitly (Super Admin)
  await db.updateCollaborator({
    ...collab,
    connectionCount: 42
  });

  collab = await db.getCollaboratorById(testCollabId);
  console.log("Après modification Super Admin - Compteur:", collab.connectionCount);
  if (collab.connectionCount !== 42) {
    throw new Error("Attendu: 42, obtenu: " + collab.connectionCount);
  }

  // 4. Cleanup
  await db.deleteCollaborator(testCollabId);
  console.log("Test réussi avec succès!");
  process.exit(0);
}

runTest().catch(err => {
  console.error("Test échoué:", err);
  process.exit(1);
});
