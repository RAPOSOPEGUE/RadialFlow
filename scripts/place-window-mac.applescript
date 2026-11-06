-- RadialFlow - posiciona a janela da frente. Uso: osascript place-window-mac.applescript x y largura altura
on run argv
	tell application "System Events"
		tell (first application process whose frontmost is true)
			set position of front window to {(item 1 of argv) as integer, (item 2 of argv) as integer}
			set size of front window to {(item 3 of argv) as integer, (item 4 of argv) as integer}
		end tell
	end tell
end run
