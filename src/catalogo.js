// Lista los vídeos de un canal y genera data/<canal>/candidatos.md para elegir cuáles descargar.
// Uso: node src/catalogo.js <canal> [--limite 500]
import fs from 'node:fs';
import path from 'node:path';
import { args, config, canal, dirCanal, ytdlp, hms, compacto, salir, leerEstado } from './lib.js';

const { pos, flags } = args();
const cfg = config();
const c = canal(cfg, pos[0]);
const limite = Number(flags.limite || 500);
const dir = dirCanal(c.slug);
fs.mkdirSync(dir, { recursive: true });

console.log(`Leyendo hasta ${limite} vídeos de ${c.nombre}…`);
const base = c.url.replace(/\/+$/, '');
const url = /\/(videos|streams|shorts|playlist)/.test(base) || base.includes('list=') ? base : `${base}/videos`;
const r = ytdlp([
  '--flat-playlist',
  '--ignore-errors',
  '--playlist-end', String(limite),
  '--print', '%(id)s\t%(title)s\t%(duration)s\t%(view_count)s',
  url,
]);
if (r.status !== 0 && !r.stdout) salir(r.stderr);

const videos = r.stdout
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => {
    const [id, titulo, dur, vistas] = l.split('\t');
    return { id, titulo, duracion: Number(dur) || 0, vistas: Number(vistas) || 0 };
  });

const palabras = (c.palabras_clave || []).map((p) => p.toLowerCase());
const coincide = (t) => {
  const low = ` ${t.toLowerCase().replace(/[^a-z0-9áéíóúñü ]+/g, ' ')} `;
  return palabras.filter((p) => low.includes(` ${p} `));
};

// Conserva las marcas [x] de un candidatos.md anterior.
const archivo = path.join(dir, 'candidatos.md');
const marcados = new Set();
if (fs.existsSync(archivo)) {
  for (const m of fs.readFileSync(archivo, 'utf8').matchAll(/^- \[[xX]\].*?id:(\S+)/gm)) marcados.add(m[1]);
}
const estado = leerEstado(c.slug);

const linea = (v) => {
  const hecho = estado[v.id]?.estado === 'descargado' ? ' ✅' : '';
  const kw = v.kw.length ? ` · _${v.kw.join(', ')}_` : '';
  return `- [${marcados.has(v.id) ? 'x' : ' '}] ${v.titulo} — ${hms(v.duracion)} · ${compacto(v.vistas)} vistas${kw} · id:${v.id}${hecho}`;
};

for (const v of videos) v.kw = coincide(v.titulo);
const si = videos.filter((v) => v.kw.length).sort((a, b) => b.kw.length - a.kw.length || b.vistas - a.vistas);
const no = videos.filter((v) => !v.kw.length);

fs.writeFileSync(path.join(dir, 'catalogo.json'), JSON.stringify(videos, null, 2));
fs.writeFileSync(
  archivo,
  [
    `# Candidatos — ${c.nombre}`,
    '',
    'Marca con `[x]` los vídeos que quieras descargar y ejecuta:',
    '',
    '```bash',
    `node src/descargar.js ${c.slug}`,
    '```',
    '',
    `## Coinciden con palabras clave (${si.length})`,
    '',
    ...si.map(linea),
    '',
    `## Resto (${no.length})`,
    '',
    ...no.map(linea),
    '',
  ].join('\n'),
);

console.log(`${videos.length} vídeos · ${si.length} coinciden con palabras clave`);
console.log(`Elige en: ${archivo}`);
