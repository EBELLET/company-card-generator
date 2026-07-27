const fs = require('fs');

function findPlaceholders(filename) {
  if (!fs.existsSync(filename)) return;
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('placeholder=') || line.toLowerCase().includes('value=')) {
      console.log(`${filename}:${idx + 1}: ${line.trim()}`);
    }
  });
}

findPlaceholders('index.html');
findPlaceholders('src/main.js');
findPlaceholders('server/index.cjs');
findPlaceholders('server/seed.cjs');
