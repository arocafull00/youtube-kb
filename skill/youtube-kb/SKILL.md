---
name: youtube-kb
description: Responde preguntas sobre negocio, marca personal, captación de clientes, contenido, ofertas y ventas basándose en las transcripciones de vídeos de YouTube (p. ej. Alex Hormozi) guardadas en el vault de Obsidian. Úsala cuando el usuario pregunte qué dice Hormozi (u otro canal de la base) sobre un tema, o pida estrategias, ideas o propuestas basadas en ese contenido.
---

# youtube-kb — consultar la base de vídeos

Esta skill **solo lee**. No ejecutes los scripts del repo, no descargues vídeos y no edites notas del vault.

## 1. Localizar la base

1. Este archivo está en `<repo>/skill/youtube-kb/SKILL.md` (puede estar enlazado desde `~/.claude/skills` o `~/.codex/skills`; resuelve la ruta real). El repo está dos carpetas por encima.
2. Lee `<repo>/config.json`: la base (`KB`) es `vault` + `carpeta_vault`.
3. Estructura de `KB`:
   - `_contexto.md` — a qué se dedica el usuario, su cliente ideal y objetivos.
   - `Fuentes/<Canal>/AAAA-MM-DD Título.md` — una nota por vídeo: frontmatter (`titulo`, `url`, `fecha`, `duracion`, `idioma`) + `## Transcripción` en párrafos que empiezan con un enlace al minuto exacto: `[mm:ss](url&t=Ns) texto…`.
   - `Canales/` e `_Índice.md` — metadatos; no contienen conocimiento.

## 2. Buscar

1. Lee `KB/_contexto.md` para adaptar la respuesta.
2. Lista los títulos de `KB/Fuentes/**` para ver qué vídeos hay y cuáles encajan con la pregunta.
3. Las transcripciones están en el **idioma del vídeo** (normalmente inglés). Traduce la pregunta a varios términos de búsqueda en ese idioma con sinónimos (p. ej. "captar clientes" → `customers|clients|leads|outreach|referral`) y busca con grep en `KB/Fuentes` sin distinguir mayúsculas.
4. Lee los párrafos con coincidencias y su contexto (párrafo anterior y siguiente). Si un vídeo es claramente central para la pregunta, léelo entero.
5. Si la pregunta es amplia ("¿cómo construyo marca personal?"), combina varios vídeos y señala dónde coinciden o se contradicen.

## 3. Responder

Responde en español con esta estructura (adáptala si la pregunta es breve):

1. **Respuesta directa** — 2–4 frases.
2. **Qué dice el autor** — principios, pasos o frameworks tal como los explica, cada uno con su cita:
   `[Título corto, mm:ss](url&t=Ns)` copiando el enlace del párrafo de la transcripción.
   Citas literales breves (menos de 25 palabras) en el idioma original, entre comillas.
3. **Aplicación a tu caso** — cómo aplicarlo según `_contexto.md`. Deja claro que esta parte es interpretación tuya, no del autor.
4. **Fuentes** — lista de vídeos usados con su enlace.

## Reglas

- **No inventes.** Atribuye al autor solo lo que aparece en las transcripciones. Si algo viene de tu conocimiento general, dilo explícitamente.
- Si la base no cubre la pregunta, dilo, responde con lo que sí haya y sugiere qué tipo de vídeo convendría añadir.
- Los subtítulos son automáticos: puede haber errores de transcripción (nombres, cifras). Si una cifra es clave, avisa de que conviene comprobarla en el vídeo.
- No copies fragmentos largos de transcripción en la respuesta: resume y cita con el enlace al minuto.
