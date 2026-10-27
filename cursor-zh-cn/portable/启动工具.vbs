Option Explicit
Dim shell, files, root, powershell, script, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
If files.FileExists(files.BuildPath(root, "CursorZhCNTool.exe")) Then
  shell.Run Chr(34) & files.BuildPath(root, "CursorZhCNTool.exe") & Chr(34), 1, False
  WScript.Quit
End If
powershell = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
script = files.BuildPath(root, "CursorZhCN.ps1")
command = Chr(34) & powershell & Chr(34) & " -NoLogo -NoProfile -ExecutionPolicy Bypass -STA -File " & Chr(34) & script & Chr(34)
shell.Run command, 0, False
