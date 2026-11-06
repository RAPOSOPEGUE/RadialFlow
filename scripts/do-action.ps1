# RadialFlow - executa uma ação. Uso:
#   powershell -File do-action.ps1 <acao> <caminhos...>
# Caminhos chegam como argumentos separados (nunca interpolados em comando).
param([string]$Action, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Paths)

$ErrorActionPreference = 'Stop'
function Convert-Images([string]$fmt, [string[]]$files) {
  Add-Type -AssemblyName System.Drawing
  $ext = if ($fmt -eq 'Jpeg') { '.jpg' } else { '.png' }
  foreach ($f in $files) {
    $img = [System.Drawing.Image]::FromFile($f)
    try {
      $out = [IO.Path]::ChangeExtension($f, $ext)
      if ($out -ne $f) { $img.Save($out, [System.Drawing.Imaging.ImageFormat]::$fmt) }
    } finally { $img.Dispose() }
  }
}

switch ($Action) {
  'zip' {
    if ($Paths.Count -eq 1) { $dst = [IO.Path]::ChangeExtension($Paths[0], '.zip') }
    else { $dst = Join-Path (Split-Path $Paths[0]) 'Arquivos.zip' }
    Compress-Archive -LiteralPath $Paths -DestinationPath $dst -Force
  }
  'unzip' {
    foreach ($f in $Paths) {
      $dst = Join-Path (Split-Path $f) ([IO.Path]::GetFileNameWithoutExtension($f))
      Expand-Archive -LiteralPath $f -DestinationPath $dst -Force
    }
  }
  'toPng' { Convert-Images 'Png' $Paths }
  'toJpg' { Convert-Images 'Jpeg' $Paths }
  default { throw "Ação desconhecida: $Action" }
}
