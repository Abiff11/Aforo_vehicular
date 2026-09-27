# Study-first workflow and dashboard design

## Goal

Reorder the aforo workflow so common study metadata is captured first and reused across multiple intersections, while every intersection keeps its own configuration, signal program, aforo data, validation state and results. Add safe clearing actions and a final dashboard that mirrors the information already exported to Excel.

## Wizard order

1. Estudio
2. Interseccion
3. Configuracion
4. Semaforo
5. Aforo
6. Validar
7. Resultados
8. Exportar

The Estudio step is always accessible. Steps after Estudio that require an intersection remain blocked until a work intersection exists.

## Persistence

`StoredState` will persist:

- `studyTemplate`: the shared `StudyMetadata` values (date, start/end time, interval, surveyor, weather, observed saturation flow and general notes).
- `studiesByIntersection`: one complete `Study` per intersection id.
- `activeStudy`: remains as the currently selected study for compatibility with the existing UI and export flow.

Creating a new intersection builds its study from `studyTemplate`. Switching intersections restores that intersection's previous full study instead of rebuilding and losing captured data. Updating common metadata updates `studyTemplate` and propagates those metadata values to stored studies, rebuilding intervals/rows only when start time, end time or interval changes.

## Clearing behavior

### Limpiar campos

Displayed in the active intersection card. It affects only the selected intersection from the Interseccion step forward:

- preserve intersection id, map number and coordinates so the marker remains usable;
- clear editable identity fields (name, municipality, locality and notes), linked CSV and relations;
- remove the saved configuration and saved study for that intersection;
- recreate a fresh study for the same marker using the current `studyTemplate`;
- do not alter any other intersection;
- do not alter `studyTemplate`.

The action requires confirmation.

### Limpiar estudio

Displayed on Estudio. It is the destructive reset for the whole application:

- clear the persisted storage key;
- reset study metadata, intersections, per-intersection studies, configurations, imports and current selection;
- return the app to its initial state.

The action requires explicit confirmation.

## Results dashboard

Keep the existing calculations as the single source of truth and present them in the browser using the same sections represented by the Excel workbook:

- KPI summary: total volume, peak interval, peak hour, FHP/factor, average interval, heavy vehicles, motorcycles, bicycles, pedestrians, g/C and v/c.
- Chart: total volume by interval.
- Chart: volume by access.
- Chart: movement distribution.
- Consolidated interval table: left, through, right, U-turn, total, heavy, motorcycles, bicycles, pedestrians and notes.
- Queue/operation table: max queue, average queue, max queue length, stopped vehicles/cycle and notes by access.
- Signal indicators table: peak-hour flow, effective green, g/C, observed saturation flow, estimated capacity and v/c.

Use the existing `recharts` dependency. Do not change the calculation formulas or the Excel export formulas as part of this feature.

## Compatibility and UX

- Existing localStorage payloads without the new optional fields must load without being discarded.
- The existing intersection card layout and map behavior are preserved except for the new clear action.
- CSV TDPA remains linked to the active intersection only.
- No new runtime dependency is required.
- Automated tests must prove persistence across intersection switches, both clear actions, the new wizard order and dashboard sections.
