# Plan de Implementacion - Aforos Intersecciones

## Modo

Native con TDD para la logica de negocio.

## Tareas

1. Configurar proyecto Electron + React + Vite + TypeScript.
2. Escribir pruebas de catalogo, intervalos, calculos, validacion, persistencia y Excel.
3. Implementar catalogo de 47 intersecciones desde el KML disponible.
4. Implementar modelos, generacion de intervalos y validaciones.
5. Implementar calculos de totales, hora pico, FHP, movimientos, colas y calidad de datos.
6. Implementar persistencia versionada en localStorage.
7. Implementar exportacion XLSX con 7 hojas.
8. Implementar UI del asistente, tabla maestra, dashboard y exportacion.
9. Compilar renderer y proceso Electron.
10. Empaquetar portable Windows x64.
11. Crear ZIP final con `.exe`, codigo fuente y README.

## Verificacion

- `npm test`
- `npm run lint`
- `npm run build`
- `npm run package`
- `npm run dist:zip`
