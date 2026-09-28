# Preparación Operativa — Diseño de Corrección

**Fecha:** 2026-09-27  
**Proyecto:** Aforos de Intersecciones Semaforizadas

## Objetivo

Convertir el flujo actual en una herramienta usable para captura de campo y entrega técnica. El sistema debe conservar la trazabilidad entre datos observados, datos pendientes, datos no aplicables y estimaciones TDPA. Ninguna pantalla, gráfica o exportación debe presentar información parcial o estimada como un resultado definitivo.

La ficha `Ficha_Aforo_Interseccion_Semaforizada.xlsx` define los campos mínimos y la intención de la entrega. Sus fórmulas que usan el volumen total del estudio como hora pico o FHP no se replicarán: el motor conservará la ventana móvil de 60 minutos ya definida en la especificación de integridad.

## Principios de aceptación

1. `0` es una observación válida; `null` significa pendiente; `N/A` significa que el movimiento no aplica.
2. Sólo intervalos completos pueden alimentar hora pico, FHP, capacidad o v/c formal.
3. TDPA se muestra y exporta exclusivamente como estimación.
4. El dashboard y el Excel consumen el mismo `StudySummary`.
5. La interfaz debe permitir encontrar y corregir cada error sin depender de una lista truncada.
6. El usuario no puede guardar un horario incompatible con la tabla de intervalos.

## 1. Estudio e integridad temporal

### Comportamiento

- Validar fecha, hora inicial, hora final e intervalo antes de actualizar el estado compartido.
- El periodo puede cruzar medianoche. La ayuda debe explicarlo sin exigir que la hora final sea posterior a la inicial.
- Si la duración no se divide exactamente por el intervalo, conservar el estado previo y mostrar un mensaje específico. No actualizar metadatos ni filas parcialmente.
- Cuando el cambio es válido y hay captura, pedir confirmación, preservar únicamente filas compatibles y mostrar el impacto.
- Mantener los intervalos configurables. La plantilla de 16 intervalos de 15 minutos es una referencia de presentación, no una limitación rígida del estudio.

### Aceptación

- `07:00–07:07` con intervalo de 15 minutos no modifica el estudio.
- `23:30–01:00` genera seis intervalos de 15 minutos y permanece usable.
- Un cambio válido conserva filas por `intervalId + accessId` cuando coinciden.

## 2. Intersecciones y catálogo

### Comportamiento

- Mostrar el catálogo existente de 47 intersecciones en el mapa desde el inicio.
- Separar cruces del catálogo de marcadores creados por el usuario, sin duplicar identificadores.
- Seleccionar una intersección del catálogo crea o recupera su estudio. Los campos de identidad siguen siendo editables y el restablecimiento continúa limitado a la intersección activa.
- El CSV TDPA sigue asociado exclusivamente a la intersección activa.

### Aceptación

- Los marcadores `INT-001` a `INT-047` son seleccionables.
- Crear un marcador nuevo no altera el catálogo ni reutiliza sus claves.

## 3. Configuración y semáforo

### Comportamiento

- Mantener accesos, movimientos, carriles y grupos movimiento–fase como fuente de geometría funcional.
- Permitir agregar y eliminar programas semafóricos. Cada programa tiene nombre, horario, ciclo y fases.
- Validar números no negativos y relaciones necesarias para análisis formal: ciclo positivo, fase válida, carriles positivos, saturación positiva y verde efectivo mayor que cero y no mayor al ciclo.
- Un programa solapado, sin horario válido o una fase incompleta se reporta como configuración inválida. No invalida el aforo observado, pero deja indicadores formales en `N/D`.
- El campo `Programa observado` se conserva como nota operativa y se etiqueta así; la asignación técnica se resuelve mediante el horario programado.

### Aceptación

- Un usuario puede crear dos programas contiguos y asignar grupos a cada uno.
- Un cambio de programa dentro de un intervalo genera advertencia y no produce capacidad/v/c.
- Un verde efectivo de cero, ciclo inválido o grupo incompleto produce `N/D` para g/C, capacidad y v/c.

## 4. Captura y validación

### Comportamiento

- En Aforo, cada fila muestra su estado: completa, pendiente o con error.
- Los campos inválidos incluyen `aria-invalid`, texto de ayuda y una referencia única al error. Los movimientos deshabilitados se muestran como `N/A` y no son editables.
- Validar muestra todos los problemas agrupados por intervalo y acceso. Cada problema lleva al campo correspondiente; no se limita a 30.
- Las métricas de calidad muestran conteo de filas completas, pendientes y con error.
- Las validaciones obligatorias siguen limitadas a movimientos habilitados y clasificaciones. Colas, ciclos y notas permanecen opcionales salvo que una función técnica los requiera.

### Aceptación

- Una fila incompleta identifica sus campos pendientes sin abandonar Aforo.
- El enlace de un problema en Validar lleva al campo afectado.
- Cero explícito pasa validación; vacío no.

## 5. Resultados

### Comportamiento

- Los KPIs y gráficas distinguen datos completos de subtotales parciales.
- Las gráficas de resultados definitivos usan sólo intervalos completos. Si se muestran datos parciales, se presentan en una sección explícita, con etiqueta persistente y sin hora pico ni FHP.
- El consolidado por intervalo mantiene `N/D` para intervalos incompletos.
- Capacidad y v/c se mantienen por grupo movimiento–fase; no se introduce capacidad agregada de intersección.
- El panel TDPA permanece separado del aforo observado.

### Aceptación

- Un intervalo incompleto no aparece como barra de volumen observado definitivo.
- Un estudio TDPA no muestra gráficas ni KPIs de aforo observado.
- Dashboard y archivo exportado coinciden en indicadores y estado del estudio.

## 6. Exportación

### Comportamiento

- Conservar las siete hojas de salida y su fuente de cálculo compartida.
- Alinear la ficha técnica con la referencia: secciones, campos, encabezados claros, diferenciación de captura y cálculo, y advertencias de borrador/TDPA.
- Los valores de resultados se exportan como resultados calculados por el motor, no como fórmulas Excel independientes, para evitar divergencia con el dashboard.
- Aplicar formato visual consistente con la ficha cuando la biblioteca existente lo soporte. Si el soporte no permite estilos fiables, mantener etiquetas explícitas de `Captura`, `Calculado`, `N/D` y estado antes de incorporar una dependencia nueva.
- El detalle conserva `EstadoFila`, `N/D` para pendientes y el estado del estudio.

### Aceptación

- Un borrador contiene advertencia visible y no cambia a validado por exportarlo.
- El Excel no convierte valores desconocidos a cero.
- La ficha contiene datos generales, semáforo, aforo, resumen, colas e indicadores por grupo.

## Fuera de alcance

- Nivel de servicio HCM, demora de control, optimización y simulación semafórica.
- Inferencia automática de giros, peatones, bicicletas o saturación desde TDPA.
- Sincronización multiusuario o almacenamiento remoto.

## Verificación

- Pruebas unitarias para los nuevos validadores y cálculos límite.
- Pruebas de componente para estados de fila, navegación de errores, catálogo y programas.
- Pruebas de exportación para estados, etiquetas y coincidencia con `StudySummary`.
- Revisión visual de cada pestaña y del Excel generado una vez exista un navegador o una superficie de captura disponible.
