const fs = require('fs');
let c = fs.readFileSync('src/pages/Inventory.jsx', 'utf8');

// Fix all corrupted hyperlink patterns
const fixes = [
  ['[e.target](http://e.target)', 'e.target'],
  ['[categories.map](http://categories.map)', 'categories.map'],
  ['[c.name](http://c.name)', 'c.name'],
  ['[c.category_id](http://c.category_id)', 'c.category_id'],
  ['[ModuleJob.run](http://ModuleJob.run)', 'ModuleJob.run'],
];

let count = 0;
for (const [from, to] of fixes) {
  while (c.includes(from)) {
    c = c.replace(from, to);
    count++;
  }
}

fs.writeFileSync('src/pages/Inventory.jsx', c);
console.log('Fixed', count, 'occurrences');
