' Creates (or repairs) the "CGI Project Hub" shortcut on your desktop and in the Start menu.
Option Explicit
Dim sh, fso, app, target, places, p, lnk
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
app = fso.GetParentFolderName(WScript.ScriptFullName)
target = app & "\CGI Project Hub.vbs"
places = Array(sh.SpecialFolders("Desktop"), sh.SpecialFolders("Programs"))
For Each p In places
  Set lnk = sh.CreateShortcut(p & "\CGI Project Hub.lnk")
  lnk.TargetPath = sh.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\wscript.exe"
  lnk.Arguments = """" & target & """"
  lnk.WorkingDirectory = app
  lnk.IconLocation = app & "\cgi.ico,0"
  lnk.Description = "CGI Project Hub - project management dashboard"
  lnk.Save
Next
fso.CreateTextFile(app & "\.shortcut_created", True).WriteLine "Desktop shortcut created."
MsgBox "Shortcut created on your desktop and in the Start menu:" & vbCrLf & vbCrLf & "CGI Project Hub", vbInformation, "CGI Project Hub"
