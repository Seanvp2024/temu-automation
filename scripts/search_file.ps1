param(
  [Parameter(Mandatory = $true)][string]$Path,
  [Parameter(Mandatory = $true)][string[]]$Patterns
)

Select-String -Path $Path -Pattern $Patterns | ForEach-Object {
  "{0}:{1}" -f $_.LineNumber, $_.Line
}
