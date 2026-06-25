Set WinScriptHost = CreateObject("WScript.Shell")
' Get the path to the Electron executable in node_modules
electronPath = "C:\Users\user\Downloads\study-tracker\desktop-app\node_modules\electron\dist\electron.exe"
' Get the path to the desktop-app folder
appPath = "C:\Users\user\Downloads\study-tracker\desktop-app"

' Run Electron with the app folder
WinScriptHost.Run Chr(34) & electronPath & Chr(34) & " " & Chr(34) & appPath & Chr(34), 0
Set WinScriptHost = Nothing
