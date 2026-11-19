const fs = require('fs');
const html = fs.readFileSync('docs/creatorconnect-module-d-ui.html', 'utf8');

const regex = /<span class="sc-id"[^>]*>(POP-D\d+)<\/span>\s*<span class="sc-name">(.*?)<\/span>[\s\S]*?<p class="sc-desc">([\s\S]*?)<\/p>/g;
let m;
while ((m = regex.exec(html)) !== null) {
  console.log(`${m[1]}: ${m[2].trim()} -> ${m[3].trim()}`);
}
