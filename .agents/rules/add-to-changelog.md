---
description: Gestión automática del archivo CHANGELOG.md siguiendo el estándar Keep a Changelog.
globs: CHANGELOG.md
---

# Changelog Manager Role

Actúa como un experto en mantenimiento de software. Tu objetivo es mantener el archivo `CHANGELOG.md` siempre actualizado, estructurado y profesional.

## Disparadores (Triggers)
- Cuando el usuario diga "actualiza el changelog", "añade al log" o use el comando sugerido `/add-to-changelog`.
- Al finalizar una tarea importante o corrección de errores, sugiere al usuario si desea documentarlo en el changelog.

## Instrucciones de Ejecución
1. **Verificación de Archivo**: Si `CHANGELOG.md` no existe en la raíz, créalo usando la plantilla oficial de [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
2. **Localización de Versión**: 
   - Busca la sección de la versión indicada.
   - Si la versión es nueva, añádela al principio (debajo de `[Unreleased]`) con la fecha actual en formato `YYYY-MM-DD`.
3. **Clasificación de Cambios**: Debes agrupar la entrada estrictamente en una de estas categorías:
   - `Added`: para nuevas funciones.
   - `Changed`: para cambios en funciones existentes.
   - `Deprecated`: para funciones que se eliminarán pronto.
   - `Removed`: para funciones eliminadas.
   - `Fixed`: para cualquier corrección de errores.
   - `Security`: en caso de vulnerabilidades.
4. **Formato de Entrada**:
   - Usa listas con viñetas (`-`).
   - Mantén un lenguaje conciso y técnico pero comprensible.
   - Enlaza los números de versión si existe una sección de referencias al final del documento.

## Comando Simulado: `/add-to-changelog`
Aunque Cursor no registra comandos `/` reales desde reglas, si el usuario escribe esto, procesa los argumentos en este orden: `<versión> <tipo> <mensaje>`.

### Ejemplo de comportamiento esperado:
**Usuario:** `/add-to-changelog 1.2.0 added "Autenticación con Google"`
**Tú (Cursor):** 1. Lees el archivo `CHANGELOG.md`.
2. Buscas o creas la sección `## [1.2.0] - 202X-XX-XX`.
3. Añades `### Added` si no existe.
4. Insertas `- Autenticación con Google`.
5. Guardas el archivo y confirmas la acción.

## Restricciones
- NO inventes versiones si el usuario no las proporciona (pregunta primero).
- NO rompas el formato Markdown existente.
- Asegúrate de que solo haya un H1 en el documento.