' CGI Project Hub - double-click to open your project dashboard.
' Starts the local hub without a console window (or just opens it if it is already running)
' and, the first time, puts a "CGI Project Hub" shortcut on your desktop.
Option Explicit
Dim sh, fso, app, py, desk, lnkPath, lnk, flag
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
app = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = app

' ---- desktop shortcut (created once; repaired if the app folder moved)
desk = sh.SpecialFolders("Desktop")
lnkPath = desk & "\CGI Project Hub.lnk"
flag = app & "\.shortcut_created"
On Error Resume Next
If (Not fso.FileExists(flag)) Or (fso.FileExists(lnkPath) And InStr(1, sh.CreateShortcut(lnkPath).Arguments, WScript.ScriptFullName, 1) = 0) Then
  Set lnk = sh.CreateShortcut(lnkPath)
  lnk.TargetPath = sh.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\wscript.exe"
  lnk.Arguments = """" & WScript.ScriptFullName & """"
  lnk.WorkingDirectory = app
  lnk.IconLocation = app & "\cgi.ico,0"
  lnk.Description = "CGI Project Hub - project management dashboard (data in Local Dashboard Storage)"
  lnk.Save
  fso.CreateTextFile(flag, True).WriteLine "Desktop shortcut created. Delete this file to recreate it."
End If
On Error GoTo 0

' ---- start the hub (bundled Windows Python, no install needed)
py = app & "\runtime\pythonw.exe"
If Not fso.FileExists(py) Then py = "pythonw.exe"
sh.Run """" & py & """ """ & app & "\hub.py""", 0, False
