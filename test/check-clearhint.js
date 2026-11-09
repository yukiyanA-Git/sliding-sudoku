const fs = require('fs');
const code = fs.readFileSync('js/app.js', 'utf8');
const lines = code.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('clearHint')) console.log(`Found clearHint at line ${idx + 1}: ${l.trim()}`);
});
