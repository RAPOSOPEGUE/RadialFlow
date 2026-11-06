# RadialFlow - executa uma ação. Uso:
#   powershell -File do-action.ps1 <acao> [hwnd] [caminhos...]
# Caminhos chegam como argumentos separados (nunca interpolados em comando).
param([string]$Action, [string]$Hwnd = '0', [Parameter(ValueFromRemainingArguments = $true)][string[]]$Paths)

$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class RfKeys {
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  public static void Combo(params byte[] vks) {
    foreach (byte k in vks) keybd_event(k, 0, 0, UIntPtr.Zero);
    for (int i = vks.Length - 1; i >= 0; i--) keybd_event(vks[i], 0, 2, UIntPtr.Zero);
  }
}
"@
$WIN = 0x5B; $CTRL = 0x11; $SHIFT = 0x10; $ALT = 0x12
function Focus-Target { if ($Hwnd -ne '0') { [RfKeys]::SetForegroundWindow([IntPtr][int64]$Hwnd) | Out-Null; Start-Sleep -Milliseconds 80 } }

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
  'snapLeft'   { Focus-Target; [RfKeys]::Combo($WIN, 0x25) }
  'snapRight'  { Focus-Target; [RfKeys]::Combo($WIN, 0x27) }
  'maximize'   { [RfKeys]::ShowWindow([IntPtr][int64]$Hwnd, 3) | Out-Null }
  'minimize'   { [RfKeys]::ShowWindow([IntPtr][int64]$Hwnd, 6) | Out-Null }
  'paste'      { [RfKeys]::Combo($CTRL, 0x56) }
  'pastePlain' {
    Add-Type -AssemblyName System.Windows.Forms
    $t = [System.Windows.Forms.Clipboard]::GetText()
    [System.Windows.Forms.Clipboard]::SetText($t)
    [RfKeys]::Combo($CTRL, 0x56)
  }
  'selectAll'  { [RfKeys]::Combo($CTRL, 0x41) }
  'copySel'    { [RfKeys]::Combo($CTRL, 0x43) }
  'screenshot' { [RfKeys]::Combo($WIN, $SHIFT, 0x53) }
  'showDesktop'{ [RfKeys]::Combo($WIN, 0x44) }
  'taskView'   { [RfKeys]::Combo($WIN, 0x09) }
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
