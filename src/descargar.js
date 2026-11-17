// Descarga subtítulos + metadatos (sin vídeo) de los vídeos marcados y los convierte a notas.
// Uso:
//   node src/descargar.js <canal>                 → los marcados con [x] en candidatos.md
//   node src/descargar.js <canal> --ids a,b,c      → ids concretos
//   node src/descargar.js <canal> --max 5          → como mucho N vídeos en esta tanda
//   node src/descargar.js <canal> --reintentar     → vuelve a intentar los que fallaron
import fs from 'node:fs';
import path from 'node:path';
import { args, config, canal, dirCanal, ytdlp, leerEstado, guardarEstado, dormir, salir } from './lib.js';
import { convertir } from './convertir.js';

const { pos, flags } = args();
const cfg = config();
const c = canal(cfg, pos[0]);
const dir = dirCanal(c.slug);
const raw = path.join(dir, 'raw');
fs.mkdirSync(raw, { recursive: true });

let ids;
if (flags.ids) ids = String(flags.ids).split(',').map((s) => s.trim()).filter(Boolean);
else {
  const cand = path.join(dir, 'candidatos.md');
  if (!fs.existsSync(cand)) salir(`No existe ${cand}. Ejecuta antes: node src/catalogo.js ${c.slug}`);
  ids = [...fs.readFileSync(cand, 'utf8').matchAll(/^- \[[xX]\].*?id:(\S+)/gm)].map((m) => m[1]);
}

const estado = leerEstado(c.slug);
const pendientes = ids.filter((id) => {
  const e = estado[id]?.estado;
  return !e || (flags.reintentar && e !== 'descargado');
});
const tanda = flags.max ? pendientes.slice(0, Number(flags.max)) : pendientes;

if (!tanda.length) {
  console.log('Nada pendiente. Marca vídeos con [x] en candidatos.md o usa --reintentar.');
  process.exit(0);
}
console.log(`${tanda.length} vídeo(s) a descargar (${ids.length - pendientes.length} ya hechos).`);

const idioma = c.idioma || 'en';
const pausa = (cfg.pausa_segundos ?? 8) * 1000;

for (const [i, id] of tanda.entries()) {
  process.stdout.write(`[${i + 1}/${tanda.length}] ${id} … `);
  const r = ytdlp([
    '--skip-download',
    '--write-subs',
    '--write-auto-subs',
    '--sub-langs', `${idioma},${idioma}-orig`,
    '--sub-format', 'vtt',
    '--write-info-json',
    '--no-write-playlist-metafiles',
    '--ignore-errors',
    '-o', path.join(raw, '%(id)s.%(ext)s'),
    `https://www.youtube.com/watch?v=${id}`,
  ]);

  const vtts = fs.readdirSync(raw).filter((f) => f.startsWith(id + '.') && f.endsWith('.vtt'));
  const info = path.join(raw, `${id}.info.json`);
  const ahora = new Date().toISOString();

  if (vtts.length && fs.existsSync(info)) {
    try {
      const nota = convertir(cfg, c, id);
      estado[id] = { estado: 'descargado', fecha: ahora, nota };
      console.log(`ok → ${path.basename(nota)}`);
    } catch (e) {
      estado[id] = { estado: 'error', fecha: ahora, error: `conversión: ${e.message}` };
      console.log(`error al convertir: ${e.message}`);
    }
  } else {
    const err = (r.stderr || '').split(/\r?\n/).filter((l) => /ERROR|WARNING/.test(l)).slice(-2).join(' | ');
    const tipo = fs.existsSync(info) ? 'sin_subtitulos' : 'error';
    estado[id] = { estado: tipo, fecha: ahora, error: err || undefined };
    console.log(tipo === 'sin_subtitulos' ? 'sin subtítulos (pendiente de Whisper)' : `error: ${err}`);
    if (/Sign in to confirm|429|Too Many Requests/i.test(err)) {
      guardarEstado(c.slug, estado);
      salir('\nYouTube está limitando las peticiones. Espera 30–60 min o sube "pausa_segundos" en config.json.');
    }
  }
  guardarEstado(c.slug, estado);
  if (i < tanda.length - 1) await dormir(pausa);
}

const n = Object.values(estado).filter((e) => e.estado === 'descargado').length;
console.log(`\nListo. ${n} vídeo(s) de ${c.nombre} en el vault.`);
