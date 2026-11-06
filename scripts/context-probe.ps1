# RadialFlow - sonda de contexto (processo PowerShell persistente).
# Lê do stdin linhas "x y" e responde uma linha JSON por pedido:
#   { kind: "file"|"titlebar"|"text"|"unknown", hwnd, paths[] }

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class RfNative {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
}
"@

[RfNative]::SetProcessDPIAware() | Out-Null
$shell = New-Object -ComObject Shell.Application
$CT = [System.Windows.Automation.ControlType]

function Get-ExplorerSelection([IntPtr]$rootHwnd) {
  foreach ($w in $shell.Windows()) {
    try {
      if ([IntPtr]$w.HWND -eq $rootHwnd) {
        return @($w.Document.SelectedItems() | ForEach-Object { $_.Path })
      }
    } catch { }
  }
  return @()
}

function Probe([int]$x, [int]$y) {
  $pt = New-Object RfNative+POINT
  $pt.X = $x; $pt.Y = $y
  $hwnd = [RfNative]::WindowFromPoint($pt)
  $root = [RfNative]::GetAncestor($hwnd, 2)
  $res = @{ kind = 'unknown'; hwnd = [int64]$root; paths = @() }

  # Barra de título: WM_NCHITTEST (0x84) retorna HTCAPTION (2).
  $lParam = [IntPtr](($y -shl 16) -bor ($x -band 0xFFFF))
  $hit = [RfNative]::SendMessage($root, 0x0084, [IntPtr]::Zero, $lParam)
  if ([int]$hit -eq 2) { $res.kind = 'titlebar'; return $res }

  $el = [System.Windows.Automation.AutomationElement]::FromPoint((New-Object System.Windows.Point($x, $y)))
  if ($null -eq $el) { return $res }
  $type = $el.Current.ControlType

  if ($type -eq $CT::TitleBar) { $res.kind = 'titlebar'; return $res }
  if ($type -eq $CT::Edit -or $type -eq $CT::Document) { $res.kind = 'text'; return $res }

  if ($type -eq $CT::ListItem -or $type -eq $CT::Text -or $type -eq $CT::DataItem) {
    $paths = Get-ExplorerSelection $root
    if ($paths.Count -gt 0) { $res.kind = 'file'; $res.paths = $paths }
  }
  return $res
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  try {
    $p = $line.Trim() -split '\s+'
    $out = Probe ([int]$p[0]) ([int]$p[1])
  } catch {
    $out = @{ kind = 'unknown'; error = $_.Exception.Message }
  }
  [Console]::Out.WriteLine(($out | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
}
