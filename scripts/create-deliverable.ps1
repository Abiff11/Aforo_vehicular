$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$outputs = Resolve-Path (Join-Path $root "outputs")
$release = Join-Path $root "release"
$packageRoot = Join-Path $outputs "Aforos_Intersecciones"
$sourceDir = Join-Path $packageRoot "proyecto-fuente"
$zipPath = Join-Path $outputs "Aforos_Intersecciones_Windows_x64.zip"

if (-not (Test-Path -LiteralPath $release)) {
  throw "No existe la carpeta release. Ejecuta npm run package antes de crear el ZIP."
}

$exe = Get-ChildItem -LiteralPath $release -Filter "*.exe" -File | Select-Object -First 1
if (-not $exe) {
  throw "No se encontro un ejecutable .exe en release."
}

$resolvedOutputs = [System.IO.Path]::GetFullPath($outputs)
$resolvedPackage = [System.IO.Path]::GetFullPath($packageRoot)
if (-not $resolvedPackage.StartsWith($resolvedOutputs, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Ruta de paquete fuera de outputs."
}

if (Test-Path -LiteralPath $packageRoot) {
  Remove-Item -LiteralPath $packageRoot -Recurse -Force
}
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Force -Path $packageRoot, $sourceDir | Out-Null
Copy-Item -LiteralPath $exe.FullName -Destination (Join-Path $packageRoot "Aforos Intersecciones.exe") -Force

$sourceItems = @(
  "docs",
  "electron",
  "scripts",
  "src",
  "index.html",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "vite.config.ts",
  "vitest.config.ts",
  "eslint.config.js"
)

foreach ($item in $sourceItems) {
  $path = Join-Path $root $item
  if (Test-Path -LiteralPath $path) {
    Copy-Item -LiteralPath $path -Destination $sourceDir -Recurse -Force
  }
}

@"
Aforos Intersecciones

Ejecutable:
- Aforos Intersecciones.exe

Codigo fuente:
- proyecto-fuente

Validacion esperada:
- npm test
- npm run lint
- npm run build
- npm run package
"@ | Set-Content -LiteralPath (Join-Path $packageRoot "README.txt") -Encoding UTF8

Compress-Archive -LiteralPath $packageRoot -DestinationPath $zipPath -Force
Write-Host "ZIP generado: $zipPath"
