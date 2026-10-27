param(
  [switch]$Headless,
  [ValidateSet('status','apply','restore')][string]$Action = 'status',
  [string]$CursorPath,
  [string]$StateDirectory
)
$ErrorActionPreference = 'Stop'
$payloadRoot = Join-Path $PSScriptRoot 'payload'

function Resolve-CursorExecutable([string]$Selection) {
  if ([string]::IsNullOrWhiteSpace($Selection)) { return $null }
  $candidate = [Environment]::ExpandEnvironmentVariables($Selection.Trim().Trim('"'))
  if (Test-Path -LiteralPath $candidate -PathType Container) { $candidate = Join-Path $candidate 'Cursor.exe' }
  if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $null }
  if ([IO.Path]::GetFileName($candidate) -ine 'Cursor.exe') { return $null }
  $candidate = [IO.Path]::GetFullPath($candidate)
  $productPath = Join-Path (Split-Path -Parent $candidate) 'resources\app\product.json'
  if (-not (Test-Path -LiteralPath $productPath)) { return $null }
  try {
    $product = [IO.File]::ReadAllText($productPath) | ConvertFrom-Json
    if ($product.applicationName -ne 'cursor') { return $null }
  } catch { return $null }
  return $candidate
}

function Find-CursorInstallations {
  $candidates = New-Object 'System.Collections.Generic.List[string]'
  foreach ($process in Get-Process Cursor -ErrorAction SilentlyContinue) {
    try { if ($process.Path) { $candidates.Add($process.Path) } } catch {}
  }
  foreach ($base in @($env:LOCALAPPDATA, $env:ProgramFiles, ${env:ProgramFiles(x86)})) {
    if ($base) {
      $candidates.Add((Join-Path $base 'Programs\cursor\Cursor.exe'))
      $candidates.Add((Join-Path $base 'Cursor\Cursor.exe'))
    }
  }
  foreach ($registryPath in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\Cursor.exe','HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\Cursor.exe')) {
    try { $value = (Get-Item -LiteralPath $registryPath -ErrorAction Stop).GetValue(''); if ($value) { $candidates.Add([string]$value) } } catch {}
  }
  foreach ($registryRoot in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')) {
    foreach ($key in Get-ChildItem -LiteralPath $registryRoot -ErrorAction SilentlyContinue) {
      try {
        $entry = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction Stop
        if ($entry.DisplayName -notmatch '^Cursor(?:\s|$)') { continue }
        if ($entry.InstallLocation) { $candidates.Add((Join-Path $entry.InstallLocation 'Cursor.exe')) }
        if ($entry.DisplayIcon) { $candidates.Add(([string]$entry.DisplayIcon -replace ',\s*-?\d+$','').Trim('"')) }
      } catch {}
    }
  }
  foreach ($menuRoot in @([Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('CommonPrograms'),[Environment]::GetFolderPath('Desktop'))) {
    try {
      $shell = New-Object -ComObject WScript.Shell
      foreach ($linkFile in Get-ChildItem -LiteralPath $menuRoot -Filter '*Cursor*.lnk' -Recurse -ErrorAction SilentlyContinue) {
        $target = $shell.CreateShortcut($linkFile.FullName).TargetPath
        if ($target -like '*Cursor.exe') { $candidates.Add($target) }
      }
    } catch {}
  }
  $seen = @{}
  foreach ($candidate in $candidates) {
    $resolved = Resolve-CursorExecutable $candidate
    if ($resolved -and -not $seen.ContainsKey($resolved.ToLowerInvariant())) { $seen[$resolved.ToLowerInvariant()] = $true; $resolved }
  }
}

function Get-InstallStateDirectory([string]$Executable) {
  if ($StateDirectory) { return [IO.Path]::GetFullPath($StateDirectory) }
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try { $digest = $algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($Executable.ToLowerInvariant())) } finally { $algorithm.Dispose() }
  $identity = [BitConverter]::ToString($digest).Replace('-','').Substring(0,20).ToLowerInvariant()
  return Join-Path (Join-Path $env:LOCALAPPDATA 'CursorZhCNPortable') $identity
}

function Quote-WindowsArgument([string]$Value) {
  # Encode one argument for CommandLineToArgvW; no shell is involved.
  $quoted = [Text.StringBuilder]::new()
  [void]$quoted.Append('"')
  $slashes = 0
  foreach ($character in $Value.ToCharArray()) {
    if ($character -eq '\') { $slashes++; continue }
    if ($character -eq '"') { [void]$quoted.Append(('\' * ($slashes * 2 + 1))); [void]$quoted.Append('"'); $slashes = 0; continue }
    if ($slashes) { [void]$quoted.Append(('\' * $slashes)); $slashes = 0 }
    [void]$quoted.Append($character)
  }
  if ($slashes) { [void]$quoted.Append(('\' * ($slashes * 2))) }
  [void]$quoted.Append('"')
  return $quoted.ToString()
}

function New-BackendProcess([string]$Executable,[string]$Operation) {
  $state = Get-InstallStateDirectory $Executable
  [void][IO.Directory]::CreateDirectory($state)
  $requestPath = Join-Path $state ('request-' + [Guid]::NewGuid().ToString('N') + '.json')
  $root = Join-Path (Split-Path -Parent $Executable) 'resources\app'
  $request = @{action=$Operation;appRoot=$root;stateDir=$state}
  [IO.File]::WriteAllText($requestPath, ($request | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
  $start = [Diagnostics.ProcessStartInfo]::new()
  $start.FileName = $Executable
  $start.Arguments = (Quote-WindowsArgument (Join-Path $payloadRoot 'portable-runner.cjs')) + ' ' + (Quote-WindowsArgument $requestPath)
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $start.StandardOutputEncoding = [Text.Encoding]::UTF8
  $start.StandardErrorEncoding = [Text.Encoding]::UTF8
  $start.EnvironmentVariables['ELECTRON_RUN_AS_NODE'] = '1'
  $start.EnvironmentVariables['VSCODE_DEV'] = ''
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $start
  try { [void]$process.Start() } catch { [IO.File]::Delete($requestPath); throw }
  return [PSCustomObject]@{Process=$process;StateDir=$state;RequestPath=$requestPath;Executable=$Executable;Action=$Operation}
}

if ($Headless) {
  $selected = Resolve-CursorExecutable $CursorPath
  if (-not $selected) { $selected = @(Find-CursorInstallations) | Select-Object -First 1 }
  if (-not $selected) { Write-Error '未找到 Cursor。请用 -CursorPath 指定 Cursor.exe。'; exit 1 }
  $backend = New-BackendProcess $selected $Action
  $stdoutTask = $backend.Process.StandardOutput.ReadToEndAsync()
  $stderrTask = $backend.Process.StandardError.ReadToEndAsync()
  $backend.Process.WaitForExit()
  $stdout = $stdoutTask.GetAwaiter().GetResult()
  $stderr = $stderrTask.GetAwaiter().GetResult()
  if ($stdout) { [Console]::Out.Write($stdout) }
  if ($stderr) { [Console]::Error.Write($stderr) }
  $exitCode = $backend.Process.ExitCode
  $backend.Process.Dispose()
  [IO.File]::Delete($backend.RequestPath)
  exit $exitCode
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$script:active = $null
$script:lastStateDirectory = $null
$script:lastResult = $null
$script:closing = $false
$colors = @{Background=[Drawing.ColorTranslator]::FromHtml('#0b1220');Panel=[Drawing.ColorTranslator]::FromHtml('#131e31');Text=[Drawing.ColorTranslator]::FromHtml('#e5edf7');Muted=[Drawing.ColorTranslator]::FromHtml('#91a3ba');Blue=[Drawing.ColorTranslator]::FromHtml('#3b82f6');Green=[Drawing.ColorTranslator]::FromHtml('#34d399');Amber=[Drawing.ColorTranslator]::FromHtml('#fbbf24');Red=[Drawing.ColorTranslator]::FromHtml('#fb7185')}
$form = [Windows.Forms.Form]::new()
$form.Text = 'Cursor 中文注入工具 · 便携版'
$form.ClientSize = [Drawing.Size]::new(920,660)
$form.MinimumSize = [Drawing.Size]::new(920,690)
$form.StartPosition = 'CenterScreen'
$form.AutoScaleMode = 'None'
$form.BackColor = $colors.Background
$form.ForeColor = $colors.Text
$form.Font = [Drawing.Font]::new('Microsoft YaHei UI',9)

function New-UiLabel([Windows.Forms.Control]$Parent,[string]$Text,[int]$X,[int]$Y,[int]$Width,[int]$Height,[single]$Size=9) {
  $control = [Windows.Forms.Label]::new(); $control.Text=$Text; $control.Location=[Drawing.Point]::new($X,$Y);$control.Size=[Drawing.Size]::new($Width,$Height);$control.Font=[Drawing.Font]::new('Microsoft YaHei UI',$Size);$control.ForeColor=$colors.Text;$Parent.Controls.Add($control);return $control
}
function New-UiButton([Windows.Forms.Control]$Parent,[string]$Text,[int]$X,[int]$Y,[int]$Width,[int]$Height,[bool]$Primary=$false) {
  $control=[Windows.Forms.Button]::new();$control.Text=$Text;$control.Location=[Drawing.Point]::new($X,$Y);$control.Size=[Drawing.Size]::new($Width,$Height);$control.FlatStyle='Flat';$control.FlatAppearance.BorderSize=0;$control.BackColor=$colors.Panel;$control.ForeColor=$colors.Text;$control.Cursor=[Windows.Forms.Cursors]::Hand;if($Primary){$control.BackColor=$colors.Blue};$Parent.Controls.Add($control);return $control
}
$title=New-UiLabel $form 'Cursor 中文注入工具' 24 18 650 36 21
$subtitle=New-UiLabel $form '复制到另一台 Windows 电脑，解压后直接运行。使用 Cursor 自带运行环境。' 26 61 860 22 9
$subtitle.ForeColor=$colors.Muted
$pathPanel=[Windows.Forms.Panel]::new();$pathPanel.Location=[Drawing.Point]::new(24,98);$pathPanel.Size=[Drawing.Size]::new(872,104);$pathPanel.Anchor='Top,Left,Right';$pathPanel.BackColor=$colors.Panel;$form.Controls.Add($pathPanel)
[void](New-UiLabel $pathPanel 'Cursor 程序位置' 14 10 720 22 9)
$pathBox=[Windows.Forms.ComboBox]::new();$pathBox.Location=[Drawing.Point]::new(14,37);$pathBox.Size=[Drawing.Size]::new(626,28);$pathBox.Anchor='Top,Left,Right';$pathBox.FlatStyle='Flat';$pathBox.BackColor=$colors.Background;$pathBox.ForeColor=$colors.Text;$pathPanel.Controls.Add($pathBox)
$browseButton=New-UiButton $pathPanel '选择程序' 650 35 94 30
$browseButton.Anchor='Top,Right'
$detectButton=New-UiButton $pathPanel '自动检测' 754 35 104 30
$detectButton.Anchor='Top,Right'
$versionLabel=New-UiLabel $pathPanel '尚未选择 Cursor' 14 76 830 22 9
$versionLabel.ForeColor=$colors.Muted
$statusPanel=[Windows.Forms.Panel]::new();$statusPanel.Location=[Drawing.Point]::new(24,216);$statusPanel.Size=[Drawing.Size]::new(872,72);$statusPanel.Anchor='Top,Left,Right';$statusPanel.BackColor=$colors.Panel;$form.Controls.Add($statusPanel)
$statusLabel=New-UiLabel $statusPanel '等待检测' 16 10 830 25 13
$statusLabel.ForeColor=$colors.Blue
$detailLabel=New-UiLabel $statusPanel '选择 Cursor 后，可检查中文注入状态。' 16 42 830 24 9
$detailLabel.ForeColor=$colors.Muted
$progressTitle=New-UiLabel $form '阶段进度' 24 304 860 23 10
$progressBar=[Windows.Forms.ProgressBar]::new();$progressBar.Location=[Drawing.Point]::new(24,334);$progressBar.Size=[Drawing.Size]::new(872,17);$progressBar.Anchor='Top,Left,Right';$progressBar.Minimum=0;$progressBar.Maximum=100;$form.Controls.Add($progressBar)
$phaseLabel=New-UiLabel $form '就绪' 24 361 870 24 9
$phaseLabel.ForeColor=$colors.Muted
$applyButton=New-UiButton $form '一键注入中文' 24 397 190 38 $true
$restoreButton=New-UiButton $form '还原原版' 226 397 150 38
$checkButton=New-UiButton $form '检查状态' 388 397 150 38
$openButton=New-UiButton $form '打开 Cursor' 550 397 166 38
$backupButton=New-UiButton $form '查看备份' 728 397 168 38
$logBox=[Windows.Forms.TextBox]::new();$logBox.Location=[Drawing.Point]::new(24,452);$logBox.Size=[Drawing.Size]::new(872,143);$logBox.Anchor='Top,Bottom,Left,Right';$logBox.Multiline=$true;$logBox.ReadOnly=$true;$logBox.ScrollBars='Vertical';$logBox.BorderStyle='FixedSingle';$logBox.BackColor=$colors.Panel;$logBox.ForeColor=$colors.Text;$logBox.Font=[Drawing.Font]::new('Microsoft YaHei UI',8.5);$form.Controls.Add($logBox)
$footer=New-UiLabel $form '备份和日志保存在本机。注入或还原完成后，重新打开 Cursor 生效。' 24 613 872 24 9
$footer.Anchor='Bottom,Left,Right';$footer.ForeColor=$colors.Muted
$controlsToLock=@($pathBox,$browseButton,$detectButton,$applyButton,$restoreButton,$checkButton,$openButton,$backupButton)

function Add-UiLog([string]$Message) {
  $line='['+(Get-Date -Format 'HH:mm:ss')+'] '+$Message
  $logBox.AppendText($line+[Environment]::NewLine)
  if($script:lastStateDirectory){try{[IO.File]::AppendAllText((Join-Path $script:lastStateDirectory 'portable.log'),$line+[Environment]::NewLine,[Text.Encoding]::UTF8)}catch{}}
}
function Update-QuickVersion {
  $exe=Resolve-CursorExecutable $pathBox.Text
  if($exe){$metadata=[IO.File]::ReadAllText((Join-Path (Split-Path -Parent $exe) 'resources\app\product.json'))|ConvertFrom-Json;$versionLabel.Text='版本 '+$metadata.version+'  ·  '+$exe;$script:lastStateDirectory=Get-InstallStateDirectory $exe}
  else{$versionLabel.Text='请选择安装目录中的 Cursor.exe'}
}
function Set-UiBusy([bool]$Busy){foreach($control in $controlsToLock){$control.Enabled=-not $Busy}}
function Start-UiOperation([string]$Operation){
  if($script:active){return}
  $exe=Resolve-CursorExecutable $pathBox.Text
  if(-not $exe){$statusLabel.Text='未找到有效的 Cursor';$statusLabel.ForeColor=$colors.Amber;$detailLabel.Text='点击“选择程序”，找到安装目录中的 Cursor.exe。';return}
  try{
    $backend=New-BackendProcess $exe $Operation
    $script:lastStateDirectory=$backend.StateDir
    $script:active=@{Backend=$backend;OutputTask=$backend.Process.StandardOutput.ReadLineAsync();ErrorTask=$backend.Process.StandardError.ReadLineAsync();OutputEnded=$false;ErrorEnded=$false;Errors=[Collections.Generic.List[string]]::new();Result=$null;Failure=$null}
    Set-UiBusy $true;$progressBar.Value=0;$statusLabel.ForeColor=$colors.Blue;$statusLabel.Text=@{status='正在检查状态';apply='正在注入中文';restore='正在还原原版'}[$Operation];$detailLabel.Text='正在检查安装位置和本机备份，请等待操作完成。';$phaseLabel.Text='0% · 任务已启动';Add-UiLog $statusLabel.Text
  }catch{$statusLabel.Text='无法开始操作';$statusLabel.ForeColor=$colors.Red;$detailLabel.Text=$_.Exception.Message;Add-UiLog $_.Exception.Message;Set-UiBusy $false}
}
function Handle-BackendLine([string]$Line){
  if([string]::IsNullOrWhiteSpace($Line)){return}
  try{$item=$Line|ConvertFrom-Json}catch{Add-UiLog $Line;return}
  if($item.type -eq 'progress'){$percent=[Math]::Max($progressBar.Value,[Math]::Min(100,[int]$item.percent));$progressBar.Value=$percent;$phaseLabel.Text=[string]$percent+'% · '+$item.message;Add-UiLog $item.message}
  elseif($item.type -eq 'error'){$script:active.Failure=[string]$item.message;Add-UiLog $item.message}
  elseif($item.type -eq 'result'){$script:active.Result=$item}
}
function Finish-UiOperation {
  $active=$script:active;$process=$active.Backend.Process;$exitCode=$process.ExitCode;$operation=$active.Backend.Action
  $process.Dispose();try{[IO.File]::Delete($active.Backend.RequestPath)}catch{}
  $script:active=$null;Set-UiBusy $false
  if($exitCode -ne 0 -or $active.Failure -or -not $active.Result){
    $message=$active.Failure
    if(-not $message){$message=$active.Errors -join ' ';if(-not $message){$message='未收到有效的运行结果。此 Cursor 版本可能不支持所需运行环境。'}}
    $statusLabel.Text='操作未完成';$statusLabel.ForeColor=$colors.Red;$detailLabel.Text='请查看下方日志；原文件未通过校验时不会继续注入。';$phaseLabel.Text='已停止 · '+$message;Add-UiLog $message;return
  }
  $script:lastResult=$active.Result;$progressBar.Value=100
  $versionLabel.Text='版本 '+$active.Result.installedVersion+'  ·  '+$active.Backend.Executable
  if($operation -eq 'restore'){$statusLabel.Text='已还原原版';$detailLabel.Text='原始资源校验通过。重新打开 Cursor 生效。';$statusLabel.ForeColor=$colors.Green}
  elseif($operation -eq 'apply'){$statusLabel.Text=$(if($active.Result.unchanged){'已注入，无需重复操作'}else{'中文注入成功'});$detailLabel.Text='资源与备份校验通过。重新打开 Cursor 生效。';$statusLabel.ForeColor=$colors.Green}
  else{
    switch($active.Result.state){
      'applied'{$statusLabel.Text='已注入中文';$detailLabel.Text='当前资源与本机注入记录一致，可重新注入或还原。';$statusLabel.ForeColor=$colors.Green}
      'managed-elsewhere'{$statusLabel.Text='已注入 · 可接管';$detailLabel.Text='检测到可验证的原始备份，点击注入或还原即可接管。';$statusLabel.ForeColor=$colors.Green}
      'changed-since-patch'{$statusLabel.Text='资源有变化，需要检查';$detailLabel.Text='检测到注入后的文件被修改。为保护现有修改，工具将停止覆盖。';$statusLabel.ForeColor=$colors.Amber}
      default{$statusLabel.Text='尚未注入中文';$detailLabel.Text='点击“一键注入中文”，工具会先验证并备份当前版本。';$statusLabel.ForeColor=$colors.Blue}
    }
  }
  $phaseLabel.Text='100% · '+$statusLabel.Text;Add-UiLog $statusLabel.Text;Add-UiLog ('本机备份与日志：'+$active.Backend.StateDir)
}

$timer=[Windows.Forms.Timer]::new();$timer.Interval=100
$timer.Add_Tick({
  if(-not $script:active){return}
  try{
    $active=$script:active
    while(-not $active.OutputEnded -and $active.OutputTask.IsCompleted){$line=$active.OutputTask.GetAwaiter().GetResult();if($null -eq $line){$active.OutputEnded=$true;break};Handle-BackendLine $line;$active.OutputTask=$active.Backend.Process.StandardOutput.ReadLineAsync()}
    while(-not $active.ErrorEnded -and $active.ErrorTask.IsCompleted){$line=$active.ErrorTask.GetAwaiter().GetResult();if($null -eq $line){$active.ErrorEnded=$true;break};$active.Errors.Add($line);$active.ErrorTask=$active.Backend.Process.StandardError.ReadLineAsync()}
    if($active.Backend.Process.HasExited -and $active.OutputEnded -and $active.ErrorEnded){Finish-UiOperation}
  }catch{$message=$_.Exception.Message;Add-UiLog $message;$statusLabel.Text='读取运行状态失败';$statusLabel.ForeColor=$colors.Red;$phaseLabel.Text=$message}
})
$timer.Start()
$applyButton.Add_Click({Start-UiOperation 'apply'})
$restoreButton.Add_Click({Start-UiOperation 'restore'})
$checkButton.Add_Click({Start-UiOperation 'status'})
$browseButton.Add_Click({$dialog=[Windows.Forms.OpenFileDialog]::new();$dialog.Title='选择 Cursor 安装目录中的 Cursor.exe';$dialog.Filter='Cursor 程序 (Cursor.exe)|Cursor.exe';if($dialog.ShowDialog($form) -eq 'OK'){$pathBox.Text=$dialog.FileName;Update-QuickVersion;Start-UiOperation 'status'};$dialog.Dispose()})
$detectButton.Add_Click({$found=@(Find-CursorInstallations);$pathBox.Items.Clear();foreach($item in $found){[void]$pathBox.Items.Add($item)};if($found.Count){$pathBox.SelectedIndex=0;Update-QuickVersion;Start-UiOperation 'status'}else{$statusLabel.Text='未自动找到 Cursor';$statusLabel.ForeColor=$colors.Amber;$detailLabel.Text='请点击“选择程序”，找到 Cursor.exe。';Add-UiLog '自动检测未找到安装，可手动选择。'}})
$pathBox.Add_SelectionChangeCommitted({Update-QuickVersion;Start-UiOperation 'status'})
$pathBox.Add_Leave({if(-not $script:active){Update-QuickVersion}})
$openButton.Add_Click({$exe=Resolve-CursorExecutable $pathBox.Text;if($exe){Start-Process -FilePath $exe;Add-UiLog '已打开 Cursor；若当前已运行，请退出后再打开以加载新资源。'}})
$backupButton.Add_Click({if($script:lastStateDirectory){[void][IO.Directory]::CreateDirectory($script:lastStateDirectory);Start-Process -FilePath 'explorer.exe' -ArgumentList (Quote-WindowsArgument $script:lastStateDirectory)}})
$form.Add_FormClosing({param($sender,$eventArgs)if($script:active){$eventArgs.Cancel=$true;[void][Windows.Forms.MessageBox]::Show($form,'操作正在进行，请等待完成后再关闭。','Cursor 中文注入工具',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Information)}})
$form.Add_Shown({Add-UiLog '工具已启动。所有处理均在本机完成。';if($CursorPath){$pathBox.Text=$CursorPath;Update-QuickVersion;Start-UiOperation 'status'}else{$detectButton.PerformClick()}})
try{[void]$form.ShowDialog()}finally{$timer.Stop();$timer.Dispose();$form.Dispose()}
