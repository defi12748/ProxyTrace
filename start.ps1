$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendPort = 8000
$FrontendPort = 5173
$BackendUrl = "http://127.0.0.1:$BackendPort"
$FrontendUrl = "http://127.0.0.1:$FrontendPort"

function ConvertTo-PowerShellLiteral {
    param([string]$Value)

    return "'" + ($Value -replace "'", "''") + "'"
}

function Stop-PortListener {
    param([int]$Port)

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        $processId = $listener.OwningProcess
        if ($processId -and $processId -ne $PID) {
            Write-Host "Stopping process $processId on port $Port"
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
}

function Wait-HttpReady {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -lt 500) {
                return $true
            }
        } catch {
            Start-Sleep -Milliseconds 750
        }
    }

    return $false
}

Stop-PortListener -Port $BackendPort
Stop-PortListener -Port $FrontendPort

$frontendRoot = Join-Path $Root "frontend"
$rootLiteral = ConvertTo-PowerShellLiteral $Root
$frontendLiteral = ConvertTo-PowerShellLiteral $frontendRoot

$backendCommand = "Set-Location $rootLiteral; if (Test-Path .\.venv\Scripts\Activate.ps1) { . .\.venv\Scripts\Activate.ps1 }; python -m uvicorn proxytrace.proxy.main:app --host 127.0.0.1 --port $BackendPort"
$frontendCommand = "Set-Location $frontendLiteral; if (!(Test-Path node_modules)) { npm install }; npm run dev"

$wt = Get-Command wt.exe -ErrorAction SilentlyContinue
if ($wt) {
    Start-Process wt.exe -ArgumentList @(
        "new-tab", "--title", "ProxyTrace API", "powershell.exe", "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $backendCommand,
        ";",
        "new-tab", "--title", "ProxyTrace Frontend", "powershell.exe", "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $frontendCommand
    )
} else {
    Start-Process powershell.exe -WorkingDirectory $Root -ArgumentList @(
        "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $backendCommand
    )
    Start-Process powershell.exe -WorkingDirectory $frontendRoot -ArgumentList @(
        "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $frontendCommand
    )
}

Wait-HttpReady -Url $FrontendUrl | Out-Null
Start-Process $FrontendUrl

Write-Host "ProxyTrace backend:  $BackendUrl"
Write-Host "ProxyTrace frontend: $FrontendUrl"
