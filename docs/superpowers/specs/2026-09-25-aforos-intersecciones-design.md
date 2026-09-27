# Especificacion - Aforos Intersecciones

Aplicacion de escritorio para Windows 11 x64 construida con Electron, React, Vite, localStorage y exportacion XLSX.

## Alcance

- Catalogo precargado de 47 intersecciones `INT-001` a `INT-047`.
- Asistente: Interseccion, Configuracion, Semaforo, Estudio, Aforo, Validar, Resultados, Exportar.
- Una sola tabla maestra de captura por estudio.
- Intervalos configurables en minutos, con 15 como predeterminado.
- Persistencia local con autoguardado y recuperacion de estudio activo.
- Dashboard calculado desde la misma fuente de verdad que Excel.
- Exportacion XLSX con hojas: `01_FICHA_TECNICA`, `02_DASHBOARD`, `03_AFORO_DETALLADO`, `04_PROGRAMACION`, `05_COLAS_OPERACION`, `06_INDICADORES`, `07_INSTRUCTIVO`.
- Entrega final: ejecutable portable `.exe` y `.zip` con ejecutable y codigo fuente.

## Reglas

- `0` significa dato observado en cero; campo vacio significa pendiente.
- Movimientos no habilitados se muestran como `N/A` y no aceptan captura.
- `Pesados + Motos` no puede superar el total motorizado.
- La hora pico se calcula como ventana movil de 60 minutos cuando el intervalo divide exactamente 60.
- FHP tradicional se etiqueta como `FHP` para 15 minutos; para otros intervalos se etiqueta como factor de uniformidad.
- Estudios menores de una hora no inventan hora pico.
- Capacidad y `v/c` solo aparecen cuando existan datos tecnicos suficientes; si no, `N/D`.

## Catalogo

El KML disponible documenta 47 puntos con numero y coordenadas. No documenta nombres de vialidades para la mayoria, por lo que la app conserva coordenadas reales y permite editar el nombre/configuracion de cada interseccion.
