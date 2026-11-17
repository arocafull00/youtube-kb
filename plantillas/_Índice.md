---
tipo: indice
---

# Índice de vídeos de YouTube

Necesita el plugin **Dataview** para mostrar las tablas.

## Canales

```dataview
LIST FROM "YouTube/Canales"
```

## Vídeos

```dataview
TABLE canal, fecha, duracion
FROM "YouTube/Fuentes"
SORT canal ASC, fecha DESC
```
