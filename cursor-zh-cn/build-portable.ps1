param([string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'dist' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$packageRoot = Join-Path $OutputDirectory 'Cursor中文注入工具'
[void][IO.Directory]::CreateDirectory((Join-Path $packageRoot 'payload'))
$files = New-Object 'System.Collections.Generic.List[string]'
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
if (-not (Test-Path -LiteralPath (Join-Path $framework 'csc.exe'))) { $framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319' }
$automationAssembly = Get-ChildItem -LiteralPath (Join-Path $env:WINDIR 'Microsoft.NET\assembly\GAC_MSIL\System.Management.Automation') -Filter System.Management.Automation.dll -Recurse | Select-Object -First 1 -ExpandProperty FullName
if (-not $automationAssembly) { throw 'Windows PowerShell 运行环境不存在。' }
$launcherExe = Join-Path $packageRoot 'CursorZhCNTool.exe'
& (Join-Path $framework 'csc.exe') '/nologo' '/target:winexe' '/platform:anycpu' '/optimize+' ('/out:'+$launcherExe) '/reference:System.Windows.Forms.dll' '/reference:System.Drawing.dll' ('/reference:'+$automationAssembly) (Join-Path (Join-Path $PSScriptRoot 'portable') 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw '窗口启动入口编译失败。' }
$files.Add('CursorZhCNTool.exe')
foreach ($name in @('CursorZhCN.ps1','启动工具.vbs','启动工具.cmd','使用说明.txt','THIRD-PARTY-NOTICES.txt')) {
  $source = Join-Path (Join-Path $PSScriptRoot 'portable') $name
  $destination = Join-Path $packageRoot $name
  if ($name.EndsWith('.ps1')) { [IO.File]::WriteAllText($destination,[IO.File]::ReadAllText($source),[Text.UTF8Encoding]::new($true)) }
  else { Copy-Item -LiteralPath $source -Destination $destination -Force }
  $files.Add($name)
}
foreach ($name in @('patch.cjs','compatibility.cjs','portable-runner.cjs','agents-overlay.js','translations-extra.json','translations-languagepack.json')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path (Join-Path $packageRoot 'payload') $name) -Force
  $files.Add('payload/'+$name)
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = Join-Path $OutputDirectory 'Cursor中文注入工具-Windows-便携版.zip'
$stageZip = $zipPath + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
$archive = [IO.Compression.ZipFile]::Open($stageZip,[IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($relative in $files) {
    $source = Join-Path $packageRoot ($relative.Replace('/',[IO.Path]::DirectorySeparatorChar))
    [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$source,('Cursor中文注入工具/'+$relative),[IO.Compression.CompressionLevel]::Optimal)
  }
} finally { $archive.Dispose() }
if (Test-Path -LiteralPath $zipPath) { Move-Item -LiteralPath $zipPath -Destination ($zipPath + '.bak-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')) }
Move-Item -LiteralPath $stageZip -Destination $zipPath
$digest = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText(($zipPath+'.sha256.txt'),($digest+'  '+[IO.Path]::GetFileName($zipPath)+[Environment]::NewLine),[Text.UTF8Encoding]::new($false))
[PSCustomObject]@{Folder=$packageRoot;Zip=$zipPath;Bytes=(Get-Item -LiteralPath $zipPath).Length;Sha256=$digest;Files=$files.Count} | ConvertTo-Json
