param(
  [Parameter(Mandatory = $true)][string]$Path,
  [Parameter(Mandatory = $true)][int]$Skip,
  [Parameter(Mandatory = $true)][int]$First
)

Get-Content -Path $Path | Select-Object -Skip $Skip -First $First
