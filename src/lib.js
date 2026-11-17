import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = path.join(ROOT, 'data');

export function leerJSON(file, porDefecto) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (porDefecto !== undefined && e.code === 'ENOENT') return porDefecto;
    throw e;
  }
}

export function escribirJSON(file, datos) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(datos, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

export function config() {
  const f = path.join(ROOT, 'config.json');
  if (!fs.existsSync(f)) salir('Falta config.json. Cópialo desde config.example.json y pon la ruta de tu vault.');
  return leerJSON(f);
}

export function canal(cfg, slug) {
  if (!slug) salir(`Indica el canal. Disponibles: ${cfg.canales.map((c) => c.slug).join(', ')}`);
  const c = cfg.canales.find((x) => x.slug === slug);
  if (!c) salir(`Canal "${slug}" no está en config.json. Disponibles: ${cfg.canales.map((x) => x.slug).join(', ')}`);
  return c;
}

export function dirCanal(slug) {
  return path.join(DATA, slug);
}

export function vaultDir(cfg) {
  return path.join(cfg.vault, cfg.carpeta_vault);
}

// --- estado de descargas (por canal) ---
export function leerEstado(slug) {
  return leerJSON(path.join(dirCanal(slug), 'estado.json'), {});
}
export function guardarEstado(slug, estado) {
  escribirJSON(path.join(dirCanal(slug), 'estado.json'), estado);
}

// --- yt-dlp ---
export function ytdlp(args) {
  const r = spawnSync(process.env.YTDLP || 'yt-dlp', ['--encoding', 'utf-8', ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    // Sin esto, en Windows yt-dlp escribe en cp1252 y se rompen tildes y apóstrofos.
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });
  if (r.error) {
    if (r.error.code === 'ENOENT') salir('No encuentro yt-dlp. Instálalo con: winget install yt-dlp.yt-dlp (y abre una terminal nueva).');
    throw r.error;
  }
  return r;
}

// --- utilidades ---
export function args(argv = process.argv.slice(2)) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) flags[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[k] = argv[++i];
      else flags[k] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

export function salir(msg) {
  console.error(msg);
  process.exit(1);
}

export function dormir(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function slugify(s, max = 70) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

// Nombre seguro para archivos de Windows y enlaces de Obsidian ([[...]] no admite [ ] # ^ |).
export function nombreSeguro(s) {
  return s
    .replace(/[<>:"/\\|?*\x00-\x1f#^]/g, '')
    .replace(/[\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
}

export function hms(seg) {
  seg = Math.max(0, Math.floor(seg || 0));
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

export function fechaISO(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return '';
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

export function compacto(n) {
  if (n == null || n === 'NA') return '?';
  n = Number(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'K';
  return String(n);
}
