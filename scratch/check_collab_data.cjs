const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.all("SELECT id, first_name, last_name, photo_zoom, photo_x, photo_y FROM collaborators;", (err, rows) => {
  console.log(rows);
  db.close();
});
