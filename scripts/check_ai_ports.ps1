$ErrorActionPreference = "Stop"

Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object {
    try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {}
  }
Get-NetTCPConnection -State Listen -LocalPort 3210 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object {
    try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {}
  }

Start-Process -FilePath "C:\Users\Administrator\temu-automation\scripts\debug_ai_runtime.cmd"
Start-Sleep -Seconds 6

try {
  $resp3000 = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:3000/api/config" -TimeoutSec 5
  Write-Output ("3000=" + $resp3000.StatusCode)
} catch {
  Write-Output ("3000=ERR:" + $_.Exception.Message)
}

try {
  $resp3210 = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:3210/api/config" -TimeoutSec 5
  Write-Output ("3210=" + $resp3210.StatusCode)
} catch {
  Write-Output ("3210=ERR:" + $_.Exception.Message)
}
