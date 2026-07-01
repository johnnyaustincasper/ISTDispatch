import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/features/inventory/MaterialsGrid.jsx', import.meta.url), 'utf8');

const checks = [
  {
    name: 'Inventory board reads sqftPerTube from batt/tube items',
    pass: /const sqftPerTube = Number\(item\.sqftPerTube \|\| 0\)/.test(source),
  },
  {
    name: 'Inventory board displays square feet per tube',
    pass: /sf\/tube/.test(source) && /square feet per tube/.test(source),
  },
  {
    name: 'Inventory board displays total square feet on hand',
    pass: /const totalSqft = sqftPerTube > 0 \? sqftPerTube \* qty : 0/.test(source)
      && /total square feet on hand/.test(source),
  },
];

const failed = checks.filter(check => !check.pass);
if (failed.length) {
  console.error('Inventory sqft display regression failed:');
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log('inventory sqft display checks passed');
