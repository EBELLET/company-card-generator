const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.all("PRAGMA table_info(collaborators);", (err, rows) => {
  console.log(rows);
  db.close();
});
