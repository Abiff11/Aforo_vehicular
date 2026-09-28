# Diseño: Excel ejecutivo, estudios aislados y renovación UI/UX

**Fecha:** 2026-09-28  
**Repositorio:** `Abiff11/Aforo_vehicular`  
**Rama de trabajo:** `feat/executive-ui-study-isolation`

## 1. Objetivo

Mejorar la presentación y la experiencia operativa del sistema sin alterar la lógica de cálculo ya estabilizada. El cambio debe producir cuatro resultados:

1. El archivo Excel generado debe tener una presentación ejecutiva, legible y profesional.
2. Cada estudio nuevo debe iniciar con una configuración propia y limpia; no debe heredar configuraciones de estudios anteriores.
3. Debe retirarse del encabezado el indicador visual "Guardado automáticamente", conservando la persistencia automática existente.
4. La interfaz completa debe adoptar una identidad visual sobria basada en azul marino, gris y blanco, con mejor jerarquía, contraste, legibilidad y adaptación a diferentes resoluciones.

## 2. Principios de diseño

- Mantener `StudySummary` como única fuente de resultados calculados.
- No modificar reglas de aforo, FHP, TDPA, capacidad, validación semafórica ni interpretación de `0`, `null`, `N/A` y `N/D`.
- No introducir una librería UI nueva.
- No introducir una dependencia nueva para Excel salvo que el formato ejecutivo resulte técnicamente imposible con la librería actual; si eso ocurriera, debe detenerse el bloque y solicitar aprobación antes de añadirla.
- Conservar compatibilidad con estados almacenados existentes.
- Los estudios existentes deben conservar su propia `configurationSnapshot` al reabrirse.
- Un estudio nuevo nunca debe tomar `lastConfiguration` ni otra configuración global previa.
- Los colores semánticos de éxito, advertencia y error se reservarán para estados; el color principal de navegación y acción será azul marino.

## 3. Alcance funcional

### 3.1 Configuración independiente por estudio

Actualmente `buildStudyForIntersection()` puede usar `state.lastConfiguration` como respaldo y marcarla con `inherited: true`. Ese comportamiento debe desaparecer.

Reglas nuevas:

- Si la intersección ya tiene un estudio guardado, se reabre ese estudio con su propia configuración.
- Si la intersección no tiene estudio, se crea uno mediante `createDefaultStudy(intersection.id, studyTemplate)` y su configuración inicia con los valores predeterminados del sistema.
- Una configuración guardada para una intersección concreta solo puede aplicarse a esa misma intersección si forma parte explícita de su estudio existente; no debe convertirse en plantilla para otro estudio.
- `lastConfiguration` deja de participar en la creación de nuevos estudios. Si permanece en el modelo por compatibilidad de almacenamiento, se considera campo legado y no debe ser consumido por el flujo nuevo.
- El flujo de importación TDPA debe mantener su comportamiento propio y no adquirir configuración de otro estudio.

Criterios de aceptación:

- Crear una primera intersección, modificar accesos/programas y guardar.
- Crear una segunda intersección.
- La segunda debe mostrar configuración por defecto, no la de la primera.
- Volver a la primera debe restaurar exactamente su configuración previamente guardada.

### 3.2 Retiro del indicador de guardado automático

El elemento visual del encabezado que actualmente muestra `Guardado automáticamente` debe eliminarse.

- La función `persist()` y el almacenamiento automático continúan sin cambios funcionales.
- No se reemplazará por otro indicador visual en este alcance.
- El encabezado debe ganar espacio y simplificar su jerarquía.

### 3.3 Sistema visual renovado

La identidad visual será institucional/neutra, sin logotipos:

- **Primario:** azul marino.
- **Superficies:** blanco y grises muy claros.
- **Texto:** gris grafito / azul muy oscuro.
- **Bordes:** grises neutros.
- **Estados:** verde, ámbar y rojo usados solo para éxito, advertencia y error.

Objetivos UX:

- Mejor jerarquía entre título, paso actual, contenido principal y acciones.
- Stepper más compacto y legible.
- Inputs con foco visible y estados consistentes.
- Botones primarios/secundarios/destructivos claramente diferenciados.
- Tarjetas y paneles con bordes, sombras suaves y espaciado uniforme.
- Tablas con encabezados más claros, mejor contraste y scroll estable.
- Mejor densidad visual en captura sin reducir legibilidad.
- Dashboard con KPIs y gráficas visualmente jerarquizados.
- Mapa integrado visualmente con el resto de la aplicación.
- Modal de ayuda consistente con el nuevo sistema visual.
- Mejor comportamiento responsive en ventanas estrechas y resoluciones de escritorio medias.

No se usarán fondos decorativos, gradientes llamativos ni ilustraciones. La aplicación debe conservar apariencia de herramienta técnica/ingenieril.

### 3.4 Excel con presentación ejecutiva

Se mantienen las siete hojas actuales y la semántica de datos existente:

1. `01_FICHA_TECNICA`
2. `02_DASHBOARD`
3. `03_AFORO_DETALLADO`
4. `04_PROGRAMACION`
5. `05_COLAS_OPERACION`
6. `06_INDICADORES`
7. `07_INSTRUCTIVO`

El formato ejecutivo debe mejorar:

- títulos y subtítulos;
- jerarquía de secciones;
- ancho de columnas;
- formatos numéricos;
- alineación y legibilidad;
- congelación de encabezados cuando la librería lo permita;
- combinaciones de celdas donde mejoren la lectura;
- advertencias visibles para estudio incompleto, legado y TDPA;
- presentación diferenciada de Capturado / Calculado / Estimado;
- configuración de impresión si la librería actual lo soporta sin degradar compatibilidad.

La paleta del libro seguirá el mismo lenguaje visual: azul marino, gris y blanco, reservando colores de advertencia/error para estados.

Restricciones:

- No introducir fórmulas Excel paralelas al motor de cálculo.
- No alterar valores existentes.
- No convertir `N/D` en `0`.
- No presentar datos parciales como definitivos.
- No introducir capacidad agregada de intersección ni LOS/HCM automático.

## 4. Arquitectura y archivos previstos

### Bloque A — Aislamiento de configuración

Archivos previstos:

- `src/components/WizardApp.tsx`
- `src/components/WizardApp.test.tsx`
- `src/lib/storage.ts` solo si es necesario retirar consumo legado
- `src/lib/storage.test.ts` si cambia comportamiento de persistencia/migración

Responsabilidad: eliminar herencia funcional sin afectar reapertura de estudios existentes.

### Bloque B — Encabezado y sistema visual base

Archivos previstos:

- `src/components/WizardApp.tsx`
- `src/components/WizardApp.test.tsx` si cambia estructura accesible
- `src/styles.css`

Responsabilidad: retirar indicador de guardado y establecer tokens/estilos globales.

### Bloque C — UI/UX de mapa y resultados

Archivos previstos:

- `src/components/ResultsDashboard.tsx`
- `src/components/ResultsDashboard.test.tsx` si cambia estructura semántica
- `src/components/IntersectionMap.tsx`
- `src/styles.css`

Responsabilidad: aplicar el sistema visual a dashboard, mapa, KPIs y paneles sin alterar cálculos.

### Bloque D — Excel ejecutivo

Archivos previstos:

- `src/lib/exportExcel.ts`
- `src/lib/exportExcel.test.ts`

Responsabilidad: presentación ejecutiva del libro preservando datos y semántica.

### Bloque E — Regresión final

Sin cambios productivos salvo una regresión comprobada.

Verificaciones:

- `npm test`
- `npm run lint`
- `npm run build`
- inspección programática del workbook serializado/reabierto
- revisión visual manual de todos los pasos y del Excel generado

## 5. Estrategia de pruebas

### Configuración independiente

Agregar cobertura que demuestre:

- un estudio nuevo no hereda accesos, programas ni asignaciones del anterior;
- un estudio existente sí conserva su propia configuración;
- cambiar entre intersecciones no contamina configuraciones;
- estados persistidos previos siguen cargando.

### UI

Mantener pruebas centradas en comportamiento y accesibilidad, evitando tests frágiles de colores exactos.

Verificar:

- desaparición del texto `Guardado automáticamente`;
- navegación de pasos intacta;
- controles accesibles y foco visible por CSS;
- layout no depende del indicador eliminado.

### Excel

Además de las pruebas actuales:

- verificar merges/anchos/formatos que formen parte de la presentación ejecutiva;
- serializar y reabrir el libro;
- confirmar que nombres de hojas, valores y estados permanecen idénticos en significado;
- confirmar que `0`, `N/D`, Capturado, Calculado y Estimado siguen diferenciados.

## 6. Compatibilidad y migración

No se eliminarán campos persistidos únicamente por limpieza de modelo durante esta fase.

Si `lastConfiguration` existe en estados antiguos:

- se puede conservar al leer/escribir por compatibilidad;
- no se utilizará para inicializar un estudio nuevo;
- no se ejecutará una migración destructiva de `localStorage`.

Esto evita pérdida de datos y reduce el riesgo de romper instalaciones existentes.

## 7. No objetivos

Quedan explícitamente fuera de este cambio:

- auditoría/remediación de las vulnerabilidades npm pendientes;
- migración de `xlsx` a otra librería;
- rediseño de la arquitectura de estado completa;
- introducción de un design system externo;
- cambios en cálculos de tránsito;
- autenticación, backend o sincronización remota;
- cambios en GitHub Actions salvo que una necesidad técnica verificable aparezca durante la implementación.

## 8. Criterios globales de aceptación

El trabajo se considera listo para revisión cuando:

- cada estudio nuevo inicia con configuración limpia;
- estudios existentes conservan su configuración propia;
- no aparece `Guardado automáticamente` en la UI;
- la aplicación utiliza coherentemente azul marino, gris y blanco con estados semánticos reservados;
- todos los pasos del wizard, dashboard, mapa, formularios y tablas mantienen su funcionalidad;
- el Excel conserva sus siete hojas y datos, con presentación ejecutiva mejorada;
- tests, lint y build pasan;
- no se introduce una nueva dependencia sin aprobación;
- no se modifica `main` hasta aprobación explícita del usuario.
