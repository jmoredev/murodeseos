---
description: Mantenimiento de documentación técnica optimizada para LLMs y humanos (Carpeta /docs y README).
globs: docs/*.md, README.md, **/*.{js,ts,tsx}
---

# Documentation Architect (LLM-Optimized)

Tu objetivo es mantener un ecosistema de documentación donde la información sea **única, referenciada a archivos reales y eficiente en tokens**.

## Reglas de Oro
1. **Sin Duplicación**: Cada dato vive en UN solo archivo (ej. build en `build-system.md`).
2. **Referencias Reales**: Cada sección DEBE citar archivos y líneas (ej. `src/main.c:20-45`).
3. **Timestamp Obligatorio**: Todo archivo en `/docs` debe empezar con:
   ``

## Estructura de Archivos
Cuando se te pida crear o actualizar la documentación, segmenta la información así:

- **`docs/project-overview.md`**: Propósito, stack tecnológico y entry-points.
- **`docs/architecture.md`**: Mapas de componentes y flujos de datos con refs a archivos.
- **`docs/build-system.md`**: Comandos de compilación, configs y troubleshooting.
- **`docs/development.md`**: Guía de estilo y patrones de diseño (incluye ejemplos de código real).
- **`docs/testing.md`**: Tipos de test y cómo ejecutarlos.
- **`docs/files.md`**: Catálogo minimalista de archivos y sus responsabilidades.

## El "README.md" Maestro
El README debe ser un **índice de alta velocidad** para LLMs:
- Máximo 50 líneas.
- Descripción de 2 frases.
- Comandos rápidos de build/test.
- Links directos a los archivos de `/docs`.

## Protocolo de Actualización
Cuando el código cambie significativamente:
1. **Analiza**: Escanea los archivos clave afectados.
2. **Extrae**: Copia fragmentos reales de código para los ejemplos en la doc.
3. **Sincroniza**: Actualiza el archivo específico en `/docs` y refresca el timestamp.
4. **Verifica**: Asegúrate de que los paths sigan siendo válidos.

## Comportamiento del Agente
- **Eficiencia de Tokens**: Evita prosa innecesaria. Usa listas y tablas.
- **Contexto**: Si el usuario pregunta "¿cómo funciona X?", antes de responder, verifica si la documentación en `/docs` está al día; si no, ofrece actualizarla primero.