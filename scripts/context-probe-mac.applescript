-- RadialFlow - sonda de contexto para macOS.
-- Uso: osascript context-probe-mac.applescript <x> <y>
-- Saída: kind<TAB>app<TAB>caminhos separados por quebra de linha
on run argv
	set px to (item 1 of argv) as integer
	set py to (item 2 of argv) as integer
	set kind to "unknown"
	set appName to ""
	set paths to ""
	tell application "System Events"
		set fp to first application process whose frontmost is true
		set appName to name of fp
		try
			set w to front window of fp
			set {wx, wy} to position of w
			set {ww, wh} to size of w
			if px >= wx and px < wx + ww and py >= wy and py < wy + 28 then set kind to "titlebar"
		end try
		if kind is "unknown" then
			try
				set r to value of attribute "AXRole" of (value of attribute "AXFocusedUIElement" of fp)
				if r is in {"AXTextField", "AXTextArea", "AXComboBox", "AXSearchField"} then set kind to "text"
			end try
		end if
	end tell
	if kind is "unknown" and appName is "Finder" then
		tell application "Finder"
			set sel to selection as alias list
			repeat with f in sel
				set paths to paths & (POSIX path of f) & linefeed
			end repeat
		end tell
		if paths is not "" then set kind to "file"
	end if
	return kind & tab & appName & tab & paths
end run
