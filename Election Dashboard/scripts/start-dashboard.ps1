$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$serverScript = Join-Path $projectRoot 'server.js'
$stdoutLog = Join-Path $projectRoot 'server.autostart.out.log'
$stderrLog = Join-Path $projectRoot 'server.autostart.err.log'

# Avoid launching another server when something is already listening on port 3000.
$portCheck = New-Object System.Net.Sockets.TcpClient
try {
    $connection = $portCheck.ConnectAsync('127.0.0.1', 3000)
    if ($connection.Wait(1000) -and $portCheck.Connected) {
        exit 0
    }
} catch {
    # No listener is available, so continue and start the dashboard.
} finally {
    $portCheck.Dispose()
}

$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
Set-Location -LiteralPath $projectRoot

& $nodePath $serverScript 1>> $stdoutLog 2>> $stderrLog
