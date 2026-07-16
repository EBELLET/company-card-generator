const fs = require('fs');
const lines = fs.readFileSync('src/style.css', 'utf8').split('\n');
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('photo-thumb-preview') || line.toLowerCase().includes('collab-thumb-img')) {
    console.log(`${index + 1}: ${line}`);
  }
});
