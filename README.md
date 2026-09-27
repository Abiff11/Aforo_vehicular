# Aforo vehicular

Aplicacion de escritorio para capturar, validar, analizar y exportar aforos vehiculares en intersecciones semaforizadas.

## Funciones principales

- Catalogo de 47 intersecciones con nombres y coordenadas.
- Flujo por pasos para seleccionar interseccion, configurar accesos, programar semaforo, capturar aforo, validar, revisar resultados y exportar.
- Configuracion editable de accesos, carriles y movimientos.
- Programacion semaforica editable con verde, ambar, rojo, ciclo total y ciclos por fase.
- Guardado automatico en `localStorage`.
- Exportacion a Excel.
- Ayuda tipo tutorial en cada paso.

## Requisitos

- Windows 11 x64.
- Node.js 22 o superior.
- npm.

## Instalacion

```powershell
npm install
```

## Desarrollo

```powershell
npm run electron:dev
```

## Verificacion

```powershell
npm test
npm run lint
npm run build
```

## Crear el ejecutable

```powershell
npm run package
```

El ejecutable portable se genera en:

```text
release/Aforos-Intersecciones-1.0.0-portable.exe
```

## Stack

- Electron
- React
- Vite
- TypeScript
- Vitest
- ESLint
- xlsx
