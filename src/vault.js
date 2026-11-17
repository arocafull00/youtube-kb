// Crea la estructura de carpetas en el vault y copia las plantillas que falten (no sobrescribe).
// Uso: node src/vault.js
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, config, vaultDir } from './lib.js';
import { asegurarNotaCanal } from './convertir.js';

const cfg = config();
if (!fs.existsSync(cfg.vault)) {
  console.error(`No existe el vault: ${cfg.vault}\nRevisa "vault" en config.json.`);
  process.exit(1);
}
const base = vaultDir(cfg);
for (const d of ['Canales', 'Fuentes']) fs.mkdirSync(path.join(base, d), { recursive: true });

const plantillas = path.join(ROOT, 'plantillas');
for (const f of fs.readdirSync(plantillas)) {
  const destino = path.join(base, f);
  if (fs.existsSync(destino)) {
    console.log(`= ${f} (ya existe)`);
    continue;
  }
  let txt = fs.readFileSync(path.join(plantillas, f), 'utf8');
  txt = txt.replaceAll('"YouTube/', `"${cfg.carpeta_vault}/`);
  fs.writeFileSync(destino, txt, 'utf8');
  console.log(`+ ${f}`);
}
for (const c of cfg.canales) asegurarNotaCanal(cfg, c);
console.log(`Vault listo en ${base}`);
