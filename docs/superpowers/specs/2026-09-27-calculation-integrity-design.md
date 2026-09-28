# Integridad de Cálculo y Resultados — Especificación de Diseño

**Fecha:** 2026-09-27  
**Proyecto:** Aforos de Intersecciones Semaforizadas  
**Rama de trabajo:** `feat/calculation-integrity`

## 1. Objetivo

Corregir la lógica del estudio para que la aplicación distinga estrictamente entre datos observados, datos no capturados, datos no aplicables y estimaciones derivadas de TDPA; impedir que resultados parciales o supuestos se presenten como resultados técnicos definitivos; y asegurar que el dashboard y el Excel consuman una única fuente de verdad con fórmulas reproducibles.

El sistema debe conservar como resultados observados válidos los conteos, agregaciones, hora de máxima demanda, FHP, distribución por movimientos, clasificación vehicular, peatones, bicicletas y colas cuando la captura esté completa. Los indicadores semafóricos de capacidad y v/c sólo podrán mostrarse cuando existan los insumos técnicos suficientes para el movimiento/grupo de carriles analizado.

## 2. Principios de integridad del dato

1. `0` significa que el dato fue observado y el valor real fue cero.
2. `null`/vacío significa que el dato no fue capturado o todavía está pendiente.
3. `N/A` significa que el movimiento o campo no aplica por configuración.
4. Ningún vacío se convertirá automáticamente en cero para declarar un resultado definitivo.
5. Un estudio incompleto podrá conservarse y exportarse como borrador, pero sus resultados se etiquetarán como parciales.
6. Un resultado derivado de TDPA se etiquetará siempre como estimación y nunca como aforo observado.
7. Dashboard y Excel utilizarán el mismo objeto de resultados del motor de cálculos.

## 3. Captura inicial y completitud

### 3.1 Filas nuevas

Las filas de aforo nuevas iniciarán así:

- movimientos habilitados: `null`;
- movimientos deshabilitados: `null` representado visualmente como `N/A`;
- pesados: `null`;
- motos: `null`;
- bicicletas: `null`;
- peatones: `null`;
- colas y observaciones operativas: `null`/vacío según corresponda.

El usuario debe capturar explícitamente `0` cuando observó que no hubo unidades.

### 3.2 Estado por fila

Cada fila tendrá un estado derivado:

- `complete`: todos los conteos obligatorios aplicables fueron capturados y son válidos;
- `incomplete`: faltan campos obligatorios;
- `error`: existe al menos una inconsistencia de valor.

La calidad del estudio mostrará:

- filas completas / filas totales;
- porcentaje de completitud;
- número de filas incompletas;
- número de filas con error.

La cuenta de filas completas se calculará fila por fila; nunca por cantidad de mensajes de error únicos.

## 4. Agregaciones observadas

### 4.1 Total motorizado por fila

```text
TotalFila = Izquierda + Frente + Derecha + Retorno
```

Sólo participan movimientos habilitados y capturados.

Si un movimiento habilitado está vacío, el total de esa fila se considera parcial. Puede mostrarse un subtotal capturado para asistencia, pero no podrá alimentar un resultado definitivo sin una marca de parcialidad.

### 4.2 Total por intervalo

```text
TotalIntervalo = suma de TotalFila de todos los accesos del intervalo
```

Un intervalo es completo sólo cuando todas sus filas obligatorias son completas.

### 4.3 Volumen del estudio

- Si todos los intervalos son completos: `Volumen total observado`.
- Si existe cualquier intervalo incompleto: `Volumen registrado parcial`.

## 5. Hora de máxima demanda y FHP

### 5.1 Hora de máxima demanda

Se utilizará una ventana móvil real de 60 minutos.

```text
n = 60 / intervalMinutes
Vhora = suma de n intervalos consecutivos
```

Sólo se evaluarán ventanas cuyos intervalos sean completos y consecutivos.

Si `60 % intervalMinutes !== 0`, la hora de máxima demanda será `N/D`.

En empate se conservará la primera ventana y se registrará una advertencia de empate.

### 5.2 FHP

Para intervalos de 15 minutos:

```text
FHP = VhoraPico / (4 × V15MaxDentroDeHoraPico)
```

Para otros intervalos que dividen 60:

```text
n = 60 / intervalMinutes
Factor = VhoraPico / (n × VintervaloMaxDentroDeHoraPico)
```

No se calculará FHP/factor para una ventana incompleta.

## 6. Colas

- `0` participa en promedios.
- `null` no participa.
- Cola máxima: máximo observado por acceso.
- Longitud máxima: máximo observado por acceso.
- Cola promedio: promedio de observaciones capturadas cuando cada valor representa una observación comparable.

Cuando se disponga de número de ciclos observados por intervalo, el sistema podrá evolucionar a promedio ponderado; esta versión no inventará ponderaciones que no existan en la captura.

## 7. Ciclos programados y observados

Para cada acceso/programa, cuando existan observaciones, se calculará:

- ciclo observado promedio;
- ciclo observado mínimo;
- ciclo observado máximo;
- ciclo programado aplicable;
- diferencia promedio observado - programado.

El sistema resolverá qué programa es aplicable a cada intervalo por horario.

Si un cambio de programa ocurre exactamente en el límite de un intervalo, cada intervalo se asocia al programa correspondiente.

Si el cambio de programa ocurre dentro de un intervalo, el intervalo se marcará con advertencia y no se asignará artificialmente por completo a un único programa para cálculos semafóricos formales.

## 8. Verde mostrado, verde efectivo y g/C

Se distinguirán explícitamente:

- `displayedGreenSeconds`: verde mostrado/programado;
- `effectiveGreenSeconds`: verde efectivo observado o técnicamente determinado.

El sistema no copiará automáticamente el verde mostrado al verde efectivo.

```text
g/C = effectiveGreenSeconds / cycleSeconds
```

`g/C` será `N/D` cuando falte ciclo o verde efectivo válido.

## 9. Capacidad y v/c

### 9.1 Regla de no invención

Se elimina el cálculo agregado actual:

```text
saturación × total de carriles de toda la intersección × g/C único
```

No se presentará como capacidad formal de la intersección.

### 9.2 Unidad de análisis

La capacidad se calcula por movimiento/grupo de carriles (`lane group`). Para esta versión, cada registro de análisis semafórico deberá vincular:

- acceso;
- movimiento;
- número de carriles aplicables;
- fase/programa;
- flujo de saturación aplicable por carril;
- ciclo;
- verde efectivo;
- volumen de hora pico del movimiento.

### 9.3 Fórmulas

```text
c_i = s_i × N_i × (g_i / C)
X_i = v_i / c_i
```

Donde:

- `c_i`: capacidad del grupo de carriles, veh/h;
- `s_i`: flujo de saturación observado/aplicable por carril, veh/h/carril;
- `N_i`: carriles del grupo;
- `g_i`: verde efectivo aplicable al movimiento;
- `C`: ciclo;
- `v_i`: demanda horaria del movimiento/grupo;
- `X_i`: relación volumen/capacidad.

Si falta cualquier insumo o la correspondencia movimiento-fase no es válida:

```text
Capacidad: N/D
v/c: N/D
```

El dashboard no emitirá automáticamente nivel de servicio, demora o diagnóstico de operación.

## 10. Modelo de configuración semafórica

Se extenderá el modelo actual para permitir que cada fase indique qué movimientos de qué accesos atiende y, cuando corresponda, verde efectivo y saturación del grupo.

Una representación mínima podrá incluir:

```text
SignalMovementAssignment
- accessId
- movement
- phaseId
- lanes
- saturationFlowPerLane
- effectiveGreenSeconds
```

Los nombres definitivos de tipos pueden ajustarse a la arquitectura existente, pero la correspondencia explícita acceso + movimiento + fase es obligatoria.

## 11. TDPA / Datos Viales

### 11.1 Lo que sí puede estimarse

Para un registro válido de Datos Viales:

```text
VolumenHoraDiseño = TDPA × K'
DirecciónPrincipal = VolumenHoraDiseño × D
DirecciónOpuesta = VolumenHoraDiseño - DirecciónPrincipal
```

Los porcentajes de motos/autobuses/camiones pueden utilizarse para composición estimada de esa hora.

### 11.2 Lo que no se inventará

El importador TDPA no asignará automáticamente:

- giros izquierda/derecha/retorno;
- peatones;
- bicicletas;
- flujo de calles transversales;
- variación de 15 minutos;
- FHP observado.

Los campos no provistos por el CSV quedarán `null/N/D`, no `0`.

### 11.3 Modo de estudio

Se distinguirá explícitamente:

- `observed`: aforo de campo;
- `estimated_tdpa`: estimación derivada de Datos Viales.

Un estudio `estimated_tdpa` mostrará una banda/leyenda permanente:

> ESTIMACIÓN TDPA — NO SUSTITUYE UN AFORO DE INTERSECCIÓN EN CAMPO.

El volumen hora de diseño y la distribución direccional podrán mostrarse como estimaciones independientes, sin fabricar filas de aforo de 15 minutos.

## 12. Valores predeterminados

Una nueva intersección no deberá parecer técnicamente medida por defecto.

- carriles: la UI podrá sugerir plantilla, pero deberá marcarla como heredada/no validada;
- ciclo, verde, rojo, fases y saturación: `null` hasta captura/configuración explícita;
- no se generará g/C, capacidad ni v/c a partir de valores de demostración.

Los valores de demostración quedarán sólo en fixtures/tests.

## 13. Protección ante cambios destructivos

Cambiar después de capturar datos:

- hora inicial;
- hora final;
- duración de intervalo;
- accesos;
- movimientos habilitados;

no podrá borrar filas silenciosamente.

Si el cambio requiere regenerar la tabla, la UI pedirá confirmación y explicará el impacto.

Cuando sea posible, se preservarán las filas compatibles por `intervalId + accessId`.

## 14. Validación y estados del estudio

Estados funcionales:

- `draft`;
- `incomplete`;
- `validated`;
- `exported`.

`validated` sólo se alcanza cuando no existen errores obligatorios y la captura observada está completa.

La exportación de un estudio incompleto está permitida únicamente como borrador y el Excel debe incluir una advertencia visible:

```text
ESTUDIO INCOMPLETO — RESULTADOS PARCIALES — NO UTILIZAR COMO RESULTADO DEFINITIVO
```

Exportar no convierte por sí mismo un estudio incompleto en validado.

## 15. Cruce de medianoche

`generateIntervals()` admitirá periodos donde `endTime <= startTime` interpretando el final como día siguiente.

Ejemplo:

```text
23:30 → 01:00
```

produce:

```text
23:30-23:45
23:45-00:00
00:00-00:15
00:15-00:30
00:30-00:45
00:45-01:00
```

La resolución de programas seguirá la misma continuidad temporal.

## 16. Dashboard

El dashboard separará visualmente:

### 16.1 Resultados observados

- volumen total observado / parcial;
- intervalo máximo válido;
- hora de máxima demanda válida;
- FHP/factor;
- distribución por acceso y movimiento;
- clasificación vehicular;
- peatones/bicicletas;
- colas;
- ciclos observados.

### 16.2 Indicadores semafóricos formales

Tabla por movimiento/grupo de carriles con:

- acceso;
- movimiento;
- fase;
- volumen hora pico;
- saturación;
- carriles;
- verde efectivo;
- g/C;
- capacidad;
- v/c.

Campos sin insumos suficientes muestran `N/D`.

### 16.3 Estimaciones TDPA

Panel independiente, claramente etiquetado, con:

- TDPA;
- K';
- D;
- volumen hora de diseño estimado;
- dirección principal;
- dirección opuesta;
- composición estimada.

No se mezclará con las gráficas de aforo observado.

## 17. Excel

El exportador seguirá usando el mismo `StudySummary`/resultado del motor.

Cambios obligatorios:

1. indicar estado del estudio y fuente (`observed` / `estimated_tdpa`);
2. advertencia visible para borradores/incompletos;
3. no mostrar capacidad/v/c cuando falten datos por movimiento-fase;
4. incluir tabla de ciclos observados;
5. incluir tabla de capacidad/v/c por grupo cuando sea válida;
6. TDPA en sección separada de estimaciones;
7. ningún campo desconocido se exporta como cero.

## 18. Migración de datos existentes

La migración será no destructiva:

- estudios existentes conservan sus valores;
- los valores `0` históricos no pueden distinguirse retrospectivamente entre cero observado y cero inicial; se marcarán como `legacyUnverified` hasta que el usuario revise/valide la captura;
- configuraciones semafóricas existentes conservan verde programado, pero `effectiveGreenSeconds` inicia `null`;
- capacidad/v/c anteriores dejan de considerarse resultados formales y se recalculan sólo con el nuevo modelo.

## 19. Pruebas de aceptación

Como mínimo:

1. fila nueva inicia vacía en campos observables y no pasa validación hasta captura explícita;
2. cero explícito cuenta como dato capturado;
3. N/A no participa en totales;
4. filas completas se cuentan por fila, no por mensajes únicos;
5. un intervalo incompleto no alimenta una hora pico válida;
6. FHP 15 min reproduce casos conocidos;
7. factor de otros divisores de 60 reproduce casos conocidos;
8. empate de hora pico conserva primera ventana y avisa;
9. colas incluyen cero y excluyen vacío;
10. ciclos observados calculan promedio/mín/máx/diferencia;
11. verde programado no aparece como verde efectivo;
12. g/C es N/D sin verde efectivo;
13. capacidad/v/c es N/D sin asignación movimiento-fase completa;
14. capacidad de un grupo reproduce `s × N × g/C`;
15. v/c reproduce `v/capacidad` para un grupo;
16. TDPA × K' y D reproducen un caso conocido;
17. importación TDPA no crea giros, peatones, bicicletas ni FHP observado;
18. modo TDPA queda etiquetado como estimación;
19. configuración por defecto no produce g/C/capacidad/v/c;
20. cambiar periodo/configuración con captura requiere confirmación o preserva datos compatibles;
21. estudio incompleto no puede convertirse en `validated`;
22. exportar borrador genera advertencia y no falsea `validated`;
23. 23:30–01:00 genera intervalos correctos;
24. dashboard y Excel obtienen los mismos indicadores del mismo motor;
25. migración no destruye estudios existentes y marca legado sin validar.

## 20. Fuera de alcance de esta corrección

- nivel de servicio HCM;
- demora de control;
- optimización semafórica;
- coordinación/progresión arterial;
- simulación;
- estimación automática de saturación cuando no fue observada;
- inferencia automática de giros desde TDPA.

Estas funciones requieren datos/metodologías adicionales y no se inferirán a partir de la información disponible.
