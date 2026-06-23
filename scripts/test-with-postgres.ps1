$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ComposeFile = Join-Path $Root "docker-compose.test.yml"
$DatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:54329/proxytrace"

function Invoke-InVenv {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    $activate = Join-Path $Root ".venv\Scripts\Activate.ps1"
    if (Test-Path $activate) {
        powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "& { Set-Location '$Root'; . '$activate'; $env:DATABASE_URL = '$DatabaseUrl'; $Command }"
        return
    }

    powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "& { Set-Location '$Root'; $env:DATABASE_URL = '$DatabaseUrl'; $Command }"
}

Write-Host "Starting disposable Postgres test database..."
docker compose -f $ComposeFile up -d postgres | Out-Host

try {
    Write-Host "Waiting for Postgres healthcheck..."
    docker compose -f $ComposeFile up -d --wait postgres | Out-Host

    Write-Host "Applying migrations..."
    Invoke-InVenv "python -m alembic upgrade head"

    Write-Host "Running test suite..."
    Invoke-InVenv "python -m pytest -q"
}
finally {
    Write-Host "Stopping disposable Postgres test database..."
    docker compose -f $ComposeFile down -v | Out-Host
}
