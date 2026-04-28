const fs = require('fs');
let c = fs.readFileSync('src/pages/Inventory.jsx', 'utf8');

// Fix all corrupted hyperlink patterns first
const fixes = [
  ['[e.target](http://e.target)', 'e.target'],
  ['[categories.map](http://categories.map)', 'categories.map'],
  ['[c.name](http://c.name)', 'c.name'],
  ['[c.category_id](http://c.category_id)', 'c.category_id'],
];
for (const [from, to] of fixes) {
  while (c.includes(from)) c = c.replace(from, to);
}

// Fix search input to be wider
c = c.replace(
  `style={{ flex: 1, background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 12, outline: 'none' }} />`,
  `style={{ flex: 3, background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 12, outline: 'none', minWidth: 0 }} />`
);

// Fix select to have fixed width
c = c.replace(
  `style={{ background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, color: catFilter ? '#fff' : '#636366', padding: '8px 12px', fontSize: 12, outline: 'none' }}>`,
  `style={{ background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, color: catFilter ? '#fff' : '#636366', padding: '8px 12px', fontSize: 12, outline: 'none', flexShrink: 0, maxWidth: 160 }}>`
);

fs.writeFileSync('src/pages/Inventory.jsx', c);
console.log('Done');
