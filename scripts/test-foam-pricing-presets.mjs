import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

const checks = [
  {
    name: 'Direct manufacturer preset is defined',
    pass: /direct:\s*\{\s*label:\s*"Direct"/.test(source),
  },
  {
    name: 'Direct open-cell set cost is $1,628',
    pass: /direct:\s*\{[^}]*openCellCost:\s*"1628"/.test(source),
  },
  {
    name: 'Direct open-cell yield is 19,000 BF',
    pass: /direct:\s*\{[^}]*openCellYield:\s*"19000"/.test(source),
  },
  {
    name: 'Direct appears in manufacturer preset dropdown',
    pass: /<option value="direct">Direct<\/option>/.test(source),
  },
  {
    name: 'Preset application preserves missing closed-cell values instead of overwriting with undefined',
    pass: /preset\?\.closedCellCost \? \{ closedCellCost: preset\.closedCellCost \} : \{\}/.test(source)
      && /preset\?\.closedCellYield \? \{ closedCellYield: preset\.closedCellYield \} : \{\}/.test(source),
  },
  {
    name: 'Preset cards hide closed-cell line when a preset is open-cell only',
    pass: /preset\.closedCellCost && preset\.closedCellYield/.test(source),
  },
];

const failed = checks.filter(check => !check.pass);
if (failed.length) {
  console.error('Foam pricing preset regression failed:');
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log('foam pricing preset checks passed');
