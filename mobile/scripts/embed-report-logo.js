/**
 * Gera src/lib/report-logo.ts com a logo em base64 para o header do PDF.
 * Execute na pasta mobile: node scripts/embed-report-logo.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const logoPath = path.join(root, 'assets', 'images', 'logo.png');
const outPath = path.join(root, 'src', 'lib', 'report-logo.ts');

if (!fs.existsSync(logoPath)) {
  console.error('Arquivo não encontrado:', logoPath);
  process.exit(1);
}

const buf = fs.readFileSync(logoPath);
const base64 = buf.toString('base64');
const out = `// Gerado por scripts/embed-report-logo.js - não editar manualmente
export const REPORT_LOGO_BASE64: string = ${JSON.stringify(base64)};
`;

const libDir = path.dirname(outPath);
if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir, { recursive: true });
}
fs.writeFileSync(outPath, out);
console.log('Gerado:', outPath);
