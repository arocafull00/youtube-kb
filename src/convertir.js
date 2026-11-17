// Convierte los subtítulos .vtt + .info.json de data/<canal>/raw en notas Markdown del vault.
// Normalmente lo llama descargar.js. A mano: node src/convertir.js <canal> [--force]
//   --force  sobrescribe notas que ya existen (perderías lo que hayas añadido a mano)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { args, config, canal, dirCanal, vaultDir, leerEstado, guardarEstado, nombreSeguro, slugify, hms, fechaISO, compacto } from './lib.js';

// ---------- VTT → segmentos sin repeticiones ----------
function aSegundos(t) {
  const p = t.split(':').map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
}

const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

function limpiar(linea) {
  return linea
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTIDADES[m])
    .replace(/\[(music|applause|laughter|música|aplausos|risas)\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsearVTT(texto) {
  const segs = [];
  let ultima = '';
  for (const bloque of texto.replace(/\r/g, '').split(/\n\n+/)) {
    const lineas = bloque.split('\n');
    const i = lineas.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const t = aSegundos(lineas[i].split('-->')[0].trim());
    // Los subtítulos automáticos repiten la línea anterior en cada bloque: solo emitimos líneas nuevas.
    for (const l of lineas.slice(i + 1).map(limpiar)) {
      if (!l || l === ultima) continue;
      segs.push({ t, texto: l });
      ultima = l;
    }
  }
  return segs;
}

// ---------- segmentos → secciones por capítulo y párrafos con timestamp ----------
function secciones(segs, capitulos, duracion) {
  let caps = (capitulos || []).map((c) => ({ titulo: c.title, inicio: c.start_time, fin: c.end_time }));
  if (!caps.length) {
    // Sin capítulos: bloques de 5 minutos.
    const fin = duracion || (segs.at(-1)?.t ?? 0) + 1;
    for (let s = 0; s < fin; s += 300) caps.push({ titulo: null, inicio: s, fin: Math.min(s + 300, fin) });
  }
  return caps
    .map((cap, i) => {
      const ult = i === caps.length - 1;
      const dentro = segs.filter((s) => s.t >= cap.inicio && (ult || s.t < cap.fin));
      const parrafos = [];
      let actual = null;
      for (const s of dentro) {
        // Nuevo párrafo cada ~60 s
        if (!actual || s.t - actual.t >= 60) parrafos.push((actual = { t: s.t, partes: [] }));
        actual.partes.push(s.texto);
      }
      return { ...cap, parrafos: parrafos.map((p) => ({ t: p.t, texto: p.partes.join(' ').replace(/\s+/g, ' ') })) };
    })
    .filter((s) => s.parrafos.length);
}

// ---------- nota ----------
const yaml = (v) => JSON.stringify(v ?? '');

function elegirVTT(raw, id, idioma) {
  const vtts = fs.readdirSync(raw).filter((f) => f.startsWith(id + '.') && f.endsWith('.vtt'));
  // Preferencia: manual del idioma > automático original > cualquiera
  const orden = [`${id}.${idioma}.vtt`, `${id}.${idioma}-orig.vtt`];
  return orden.find((f) => vtts.includes(f)) || vtts[0];
}

export function rutaNota(cfg, c, info) {
  const fecha = fechaISO(info.upload_date) || 'sin-fecha';
  const carpeta = path.join(vaultDir(cfg), 'Fuentes', nombreSeguro(c.nombre));
  return path.join(carpeta, `${fecha} ${nombreSeguro(info.title).slice(0, 90)}.md`);
}

export function asegurarNotaCanal(cfg, c) {
  const f = path.join(vaultDir(cfg), 'Canales', `${nombreSeguro(c.nombre)}.md`);
  if (fs.existsSync(f)) return;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(
    f,
    `---
tipo: canal
canal: ${yaml(c.nombre)}
slug: ${c.slug}
url: ${c.url}
idioma: ${c.idioma || 'en'}
tags: [youtube/canal]
---

# ${c.nombre}

[Canal en YouTube](${c.url})

## Vídeos

\`\`\`dataview
TABLE fecha, duracion, vistas
FROM "${cfg.carpeta_vault}/Fuentes/${nombreSeguro(c.nombre)}"
SORT fecha DESC
\`\`\`
`,
  );
}

export function convertir(cfg, c, id, { force = false } = {}) {
  const raw = path.join(dirCanal(c.slug), 'raw');
  const info = JSON.parse(fs.readFileSync(path.join(raw, `${id}.info.json`), 'utf8'));
  const vtt = elegirVTT(raw, id, c.idioma || 'en');
  if (!vtt) throw new Error('no hay .vtt');

  const destino = rutaNota(cfg, c, info);
  if (fs.existsSync(destino) && !force) return destino; // no pisar notas existentes

  const segs = parsearVTT(fs.readFileSync(path.join(raw, vtt), 'utf8'));
  const secs = secciones(segs, info.chapters, info.duration);
  const url = `https://www.youtube.com/watch?v=${id}`;
  const enlace = (t) => `[${hms(t)}](${url}&t=${Math.floor(t)}s)`;
  const palabras = segs.reduce((n, s) => n + s.texto.split(' ').length, 0);
  // yt-dlp prioriza los subtítulos manuales si existen en ese idioma.
  const automatico = !(info.subtitles || {})[c.idioma || 'en'];

  const cuerpo = secs
    .map((s) => {
      const titulo = s.titulo ? `### ${s.titulo} (${hms(s.inicio)})` : `### ${hms(s.inicio)} – ${hms(s.fin)}`;
      return [titulo, '', ...s.parrafos.map((p) => `${enlace(p.t)} ${p.texto}\n`)].join('\n');
    })
    .join('\n');

  const md = `---
tipo: fuente
canal: ${yaml(c.nombre)}
titulo: ${yaml(info.title)}
url: ${url}
video_id: ${id}
fecha: ${fechaISO(info.upload_date)}
duracion: ${yaml(hms(info.duration))}
vistas: ${info.view_count ?? ''}
idioma: ${c.idioma || 'en'}
subtitulos: ${automatico ? 'automaticos' : 'manuales'}
palabras: ${palabras}
tags: [youtube/fuente, canal/${slugify(c.nombre)}]
---

# ${info.title}

> [!info] [Ver en YouTube](${url}) · [[Canales/${nombreSeguro(c.nombre)}|${c.nombre}]] · ${fechaISO(info.upload_date)} · ${hms(info.duration)} · ${compacto(info.view_count)} vistas

## Transcripción

${cuerpo}`;

  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, md, 'utf8');
  asegurarNotaCanal(cfg, c);
  return destino;
}

// ---------- CLI ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { pos, flags } = args();
  const cfg = config();
  const c = canal(cfg, pos[0]);
  const raw = path.join(dirCanal(c.slug), 'raw');
  const estado = leerEstado(c.slug);
  const ids = fs.existsSync(raw) ? fs.readdirSync(raw).filter((f) => f.endsWith('.info.json')).map((f) => f.split('.')[0]) : [];
  for (const id of ids) {
    try {
      const nota = convertir(cfg, c, id, { force: !!flags.force });
      estado[id] = { ...(estado[id] || {}), estado: 'descargado', nota };
      console.log(`ok ${id} → ${path.basename(nota)}`);
    } catch (e) {
      console.log(`error ${id}: ${e.message}`);
    }
  }
  guardarEstado(c.slug, estado);
}
