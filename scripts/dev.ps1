param([int]$Port = 3000)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$nodeCandidate = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($nodeCandidate) {
    $nodeMajor = [int]((& $nodeCandidate -p 'process.versions.node.split(".")[0]').Trim())
} else { $nodeMajor = 0 }
if ($nodeMajor -lt 22) {
    $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $bundledNode) { $nodeCandidate = $bundledNode }
    else { throw 'Install Node.js 22 or newer, then run npm ci and npm run dev.' }
}
if ([int]((& $nodeCandidate -p 'process.versions.node.split(".")[0]').Trim()) -lt 22) { throw 'Node.js 22 or newer is required.' }
Push-Location -LiteralPath $projectDirectory
try {
    & $nodeCandidate 'node_modules/next/dist/bin/next' dev --hostname 127.0.0.1 --port $Port
} finally { Pop-Location }
