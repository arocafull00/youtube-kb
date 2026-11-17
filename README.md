# youtube-kb

Convierte vídeos de canales de YouTube en notas Markdown dentro de un vault de Obsidian y te permite **preguntarle a Claude Code o Codex** sobre ese contenido mediante una skill.

- No descarga vídeos ni transcribe audio. Usa los **subtítulos de YouTube** (manuales o automáticos) con `yt-dlp`, así que es casi instantáneo.
- Funciona con **cualquier canal** y en cualquier idioma que tenga subtítulos.
- La skill solo lee: busca en las transcripciones, responde y cita el vídeo y el minuto exacto.

## Cómo funciona

```
config.json (canales)
      │
      ▼
catalogo.js ──► data/<canal>/candidatos.md   (tú marcas [x] los vídeos que quieres)
      │
      ▼
descargar.js ──► yt-dlp: solo subtítulos .vtt + metadatos .info.json  (data/<canal>/raw)
      │
      ▼
convertir.js ──► Vault/YouTube/Fuentes/<Canal>/AAAA-MM-DD Título.md
                  · frontmatter (canal, url, fecha, duración, vistas…)
                  · transcripción limpia, por capítulos, con enlace al minuto en cada párrafo
      │
      ▼
skill youtube-kb (Claude Code / Codex)
      · lee tu _contexto.md
      · busca en las transcripciones y responde citando vídeo y minuto
```

### Estructura en el vault

```
YouTube/
  _contexto.md      a qué te dedicas y tus objetivos (la skill adapta las respuestas)
  _Índice.md        tabla de canales y vídeos (con el plugin Dataview)
  Canales/          una nota por canal
  Fuentes/<Canal>/  una nota por vídeo
```

Ejemplo de nota:

```markdown
---
tipo: fuente
canal: "Alex Hormozi"
titulo: "Watch this to get your first 5 customers"
url: https://www.youtube.com/watch?v=w7g08dVTwaE
fecha: 2023-08-02
duracion: "10:13"
...
---

## Transcripción

### 00:00 – 05:00

[00:00](https://www.youtube.com/watch?v=w7g08dVTwaE&t=0s) I'm going to show you how to get your first five customers…
```

Los `.vtt` en bruto y el estado de las descargas se quedan en `data/`, fuera del vault y fuera de git.

### Detalles

- **Sin repeticiones:** los subtítulos automáticos repiten cada línea varias veces y `convertir.js` las elimina.
- **Capítulos:** si el vídeo tiene capítulos, cada uno es una sección. Si no, se divide en bloques de 5 minutos. Cada párrafo (unos 60 s) empieza con un enlace al minuto exacto.
- **Reanudable:** `data/<canal>/estado.json` guarda qué vídeos están descargados, cuáles no tienen subtítulos y cuáles dieron error. Si la descarga se corta, vuelve a ejecutar el mismo comando.
- **Pausa entre vídeos** (`pausa_segundos`) para no saturar YouTube.
- **No sobrescribe** notas que ya existen, salvo con `convertir.js --force`.

## Instalación

Requisitos: [Node.js](https://nodejs.org) 18+ y [yt-dlp](https://github.com/yt-dlp/yt-dlp).

```bash
winget install yt-dlp.yt-dlp
```

```bash
git clone https://github.com/arocafull00/youtube-kb.git
cd youtube-kb
cp config.example.json config.json
```

Edita `config.json` y pon en `vault` la ruta de tu vault de Obsidian. Después crea la estructura:

```bash
node src/vault.js
```

Rellena `YouTube/_contexto.md` en el vault con tu negocio y tus objetivos.

### Instalar la skill

Enlaza `skill/youtube-kb` en las carpetas de skills. La skill lee `config.json` del repo para saber dónde está el vault, así que hay que enlazarla y no copiarla.

Windows (una *junction* no requiere permisos de administrador):

```powershell
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\youtube-kb" -Target "$PWD\skill\youtube-kb"
New-Item -ItemType Junction -Path "$env:USERPROFILE\.codex\skills\youtube-kb" -Target "$PWD\skill\youtube-kb"
```

macOS / Linux:

```bash
ln -s "$PWD/skill/youtube-kb" ~/.claude/skills/youtube-kb
ln -s "$PWD/skill/youtube-kb" ~/.codex/skills/youtube-kb
```

## Añadir un canal nuevo

1. **Añádelo a `config.json`**, dentro de `canales`:

   ```json
   {
     "slug": "nombre-corto",
     "nombre": "Nombre del canal",
     "url": "https://www.youtube.com/@CanalDeEjemplo",
     "idioma": "es",
     "palabras_clave": ["ventas", "clientes", "marketing"]
   }
   ```

   - `slug`: identificador corto que usarás en los comandos.
   - `url`: la del canal (`@usuario`). También vale una playlist (`...playlist?list=...`) o una pestaña concreta (`/streams`, `/shorts`).
   - `idioma`: código de los subtítulos que quieres (`en`, `es`, `pt`…).
   - `palabras_clave`: en el idioma de los títulos. Sirven para poner arriba los vídeos que más te interesan.

2. **Genera el catálogo** (no descarga nada, solo lista títulos):

   ```bash
   node src/catalogo.js nombre-corto --limite 300
   ```

   Crea `data/nombre-corto/candidatos.md` con los últimos 300 vídeos. Arriba aparecen los que coinciden con tus palabras clave, ordenados por número de coincidencias y por vistas.

3. **Elige los vídeos:** abre `candidatos.md` y cambia `- [ ]` por `- [x]` en los que quieras. Si vuelves a generar el catálogo, las marcas se conservan.

4. **Descarga.** Empieza con pocos para comprobar la calidad y luego quita `--max`:

   ```bash
   node src/descargar.js nombre-corto --max 5
   ```

   Para descargar vídeos concretos por su id:

   ```bash
   node src/descargar.js nombre-corto --ids dQw4w9WgXcQ,abc123
   ```

   Para volver a intentar los que fallaron:

   ```bash
   node src/descargar.js nombre-corto --reintentar
   ```

Las notas aparecen en `YouTube/Fuentes/<Nombre del canal>/` y la skill puede consultarlas al momento.

## Preguntar a la base

Con la skill instalada, pregunta en Claude Code o Codex:

> ¿Qué dice Hormozi sobre cómo conseguir los primeros clientes de un negocio de servicios?

> Usando youtube-kb, diseña una estrategia de marca personal en LinkedIn de 30 días para mi negocio. Cita las fuentes.

Cada respuesta incluye lo que dice el autor (con enlace al minuto), una aplicación a tu caso marcada como interpretación y la lista de fuentes.

## Comandos

| Comando | Qué hace |
|---|---|
| `node src/vault.js` | Crea la estructura en el vault (no sobrescribe) |
| `node src/catalogo.js <canal> [--limite N]` | Lista los vídeos del canal en `candidatos.md` |
| `node src/descargar.js <canal> [--max N] [--ids a,b] [--reintentar]` | Descarga los subtítulos y crea las notas |
| `node src/convertir.js <canal> [--force]` | Regenera las notas desde `data/<canal>/raw` |

## Problemas frecuentes

- **`No encuentro yt-dlp`**: instálalo y abre una terminal nueva para que se actualice el PATH.
- **429 o "Sign in to confirm you're not a bot"**: YouTube está limitando las peticiones. Espera 30–60 min o sube `pausa_segundos`, y mantén `yt-dlp` actualizado (`winget upgrade yt-dlp.yt-dlp`).
- **"sin subtítulos"**: el vídeo no tiene subtítulos en ese idioma. Queda anotado en `estado.json`.

## Uso responsable

Las transcripciones son contenido de sus autores. El proyecto está pensado para uso personal: mantén tu vault privado y, si publicas algo, comparte tus notas e interpretaciones citando la fuente, nunca las transcripciones completas.

## Licencia

MIT
