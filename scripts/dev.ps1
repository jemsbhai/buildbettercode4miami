param([int]$Port = 3000)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'Install the Node/npm versions in package.json, or reopen in the devcontainer. See docs/DEVELOPMENT.md.'
}
Push-Location -LiteralPath $projectDirectory
try {
    & npm run check:toolchain
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & npm run dev -- --port $Port
    exit $LASTEXITCODE
} finally { Pop-Location }
