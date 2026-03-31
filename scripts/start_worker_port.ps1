$Port = if ($args.Length -ge 1) { [int]$args[0] } else { 19340 }
$AppUserData = if ($args.Length -ge 2) { $args[1] } else { "C:\Users\Administrator\AppData\Roaming\temu-automation" }
$BootstrapLog = Join-Path $AppUserData "worker-bootstrap-$Port.log"
$StdOutLog = Join-Path $AppUserData "worker-$Port.out"
$StdErrLog = Join-Path $AppUserData "worker-$Port.err"

New-Item -ItemType Directory -Force -Path $AppUserData | Out-Null

$env:WORKER_PORT = [string]$Port
$env:APP_USER_DATA = $AppUserData
$env:WORKER_BOOTSTRAP_LOG = $BootstrapLog

$process = Start-Process `
  -FilePath "node" `
  -ArgumentList "automation\worker-entry.cjs" `
  -WorkingDirectory "C:\Users\Administrator\temu-automation" `
  -WindowStyle Hidden `
  -PassThru `
  -RedirectStandardOutput $StdOutLog `
  -RedirectStandardError $StdErrLog

$process.Id
