param(
  [Parameter(Mandatory = $true)][string]$Action,
  [string]$JsonData = "{}",
  [int]$Port = 19280
)

$payload = @{
  action = $Action
  data = if ([string]::IsNullOrWhiteSpace($JsonData)) { @{} } else { $JsonData | ConvertFrom-Json }
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -UseBasicParsing -Method Post -ContentType "application/json" -Body $payload -Uri ("http://127.0.0.1:{0}" -f $Port) | Select-Object -ExpandProperty Content
