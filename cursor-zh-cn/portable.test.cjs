'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const roots=[];
const payload=process.env.CURSOR_ZH_TEST_PAYLOAD || path.resolve(__dirname,'../dist/Cursor中文注入工具/payload');
const checksum=value=>crypto.createHash('sha256').update(value).digest('base64').replace(/=+$/,'');
function fixture(version='3.28.1',desktopOnly=false){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'cursor-zh-portable-test-'));roots.push(base);
  const root=path.join(base,'另一台电脑 空格','cursor','resources','app');
  const state=path.join(base,'本机数据 备份');
  const original={'workbench.desktop.main.js':"const id='workbench.parts.editor';function boot(){}export{boot as main};\n"};
  if(!desktopOnly)original['workbench.glass.main.js']="const id='glass-sidebar';function boot(){}export{boot as main};\n";
  const checksums={};fs.mkdirSync(path.join(root,'out/vs/workbench'),{recursive:true});
  for(const[name,source]of Object.entries(original)){fs.writeFileSync(path.join(root,'out/vs/workbench',name),source);checksums['vs/workbench/'+name]=checksum(source);}
  fs.writeFileSync(path.join(root,'product.json'),JSON.stringify({applicationName:'cursor',nameLong:'Cursor',version,commit:'portable-fixture',checksums}));
  return{base,root,state,original};
}
function run(f,action,success=true,runner=path.join(payload,'portable-runner.cjs')){
  const request=path.join(f.base,'任务 请求.json');fs.writeFileSync(request,JSON.stringify({action,appRoot:f.root,stateDir:f.state}));
  const result=cp.spawnSync(process.execPath,[runner,request],{env:{...process.env,...f.env},encoding:'utf8',windowsHide:true,timeout:30000});
  if(success)assert.equal(result.status,0,result.stderr||result.stdout);else assert.notEqual(result.status,0);
  const lines=result.stdout.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
  return{...result,lines,result:lines.findLast(line=>line.type==='result')};
}
function verifyOriginal(f){for(const[name,source]of Object.entries(f.original))assert.equal(fs.readFileSync(path.join(f.root,'out/vs/workbench',name),'utf8'),source);}
test('portable apply and restore work in Chinese paths with real phase progress',()=>{
  const f=fixture();const apply=run(f,'apply');assert.equal(apply.result.state,'applied');
  const progress=apply.lines.filter(line=>line.type==='progress').map(line=>line.percent);
  assert.ok(progress.length>=8);assert.equal(progress.at(-1),100);assert.deepEqual(progress,[...progress].sort((a,b)=>a-b));
  assert.equal(run(f,'status').result.state,'applied');run(f,'restore');verifyOriginal(f);
});
test('copying the script package to a different folder needs no original computer path',()=>{
  const f=fixture();const copied=path.join(f.base,'U盘 工具副本','payload');fs.mkdirSync(copied,{recursive:true});
  for(const file of fs.readdirSync(payload))fs.copyFileSync(path.join(payload,file),path.join(copied,file));
  const result=run(f,'apply',true,path.join(copied,'portable-runner.cjs'));assert.equal(result.result.state,'applied');
  const metadata=JSON.parse(fs.readFileSync(path.join(f.state,'manifest.json'),'utf8'));
  for(const row of metadata.targets){assert.ok(row.target.startsWith(f.root));assert.ok(row.backup.startsWith(f.state));}
});
test('a foreign computer or installation manifest cannot overwrite that installation',()=>{
  const a=fixture(),b=fixture();run(a,'apply');
  fs.mkdirSync(b.state,{recursive:true});fs.copyFileSync(path.join(a.state,'manifest.json'),path.join(b.state,'manifest.json'));
  const failed=run(b,'restore',false);assert.match(failed.stdout,/另一个安装目录/);verifyOriginal(b);
});
test('current validated maintenance backups can be adopted into local portable state',()=>{
  const f=fixture();const exeDirectory=path.resolve(f.root,'../..');const legacy=path.join(path.dirname(exeDirectory),'CursorZhCN');
  const seeded=cp.spawnSync(process.execPath,[path.join(payload,'patch.cjs'),'apply'],{env:{...process.env,CURSOR_ZH_APP_ROOT:f.root,CURSOR_ZH_STATE_DIR:legacy},encoding:'utf8',windowsHide:true});
  assert.equal(seeded.status,0,seeded.stderr);assert.equal(run(f,'status').result.state,'managed-elsewhere');
  run(f,'apply');const manifest=JSON.parse(fs.readFileSync(path.join(f.state,'manifest.json'),'utf8'));
  assert.ok(manifest.targets.every(row=>row.backup.startsWith(f.state)));run(f,'restore');verifyOriginal(f);
});
test('unknown patched files without valid backups are preserved',()=>{
  const f=fixture();const file=path.join(f.root,'out/vs/workbench/workbench.glass.main.js');
  const changed=fs.readFileSync(file,'utf8')+'\n/* cursor-zh-cn-local:start */';fs.writeFileSync(file,changed);
  run(f,'apply',false);assert.equal(fs.readFileSync(file,'utf8'),changed);
});
test('classic desktop-only install is supported without fabricating an Agents file',()=>{
  const f=fixture('2.5.0',true);run(f,'apply');const result=run(f,'status');assert.equal(result.result.targets.length,2);run(f,'restore');verifyOriginal(f);
});
test('cleanup preview does not delete; cleanup removes old generations and keeps current restore usable',()=>{
  const f=fixture();run(f,'apply');
  const old=JSON.parse(fs.readFileSync(path.join(f.state,'manifest.json'),'utf8'));
  for(const[name,source]of Object.entries(f.original))fs.writeFileSync(path.join(f.root,'out/vs/workbench',name),source);
  const product=JSON.parse(fs.readFileSync(old.targets.find(row=>row.target.endsWith('product.json')).backup,'utf8'));
  product.version='4.0.0';product.commit='new-generation';fs.writeFileSync(path.join(f.root,'product.json'),JSON.stringify(product));
  run(f,'apply');
  const current=JSON.parse(fs.readFileSync(path.join(f.state,'manifest.json'),'utf8'));
  const preview=run(f,'cleanup-preview').result;
  assert.equal(preview.removableCount,1);assert.equal(preview.retainedCount,1);assert.ok(preview.removableBytes>0);
  assert.ok(old.targets.every(row=>fs.existsSync(row.backup)),'Preview must not delete');
  const cleaned=run(f,'cleanup').result;assert.equal(cleaned.deletedCount,1);assert.equal(cleaned.retainedCount,1);
  assert.ok(old.targets.every(row=>!fs.existsSync(row.backup)));
  assert.ok(current.targets.every(row=>fs.existsSync(row.backup)));
  assert.equal(run(f,'cleanup-preview').result.removableCount,0);
  run(f,'restore');verifyOriginal(f);
});

test('cleanup without a manifest preserves untracked backups',()=>{
  const f=fixture();const backup=path.join(f.state,'backups','3.26.0-history','original.js');
  fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,'keep');
  const failed=run(f,'cleanup',false);assert.match(failed.stdout,/没有有效的当前备份清单/);assert.equal(fs.readFileSync(backup,'utf8'),'keep');
});

test('cleanup refuses linked directories and never follows them outside the backup root',()=>{
  const f=fixture();run(f,'apply');
  const outside=path.join(f.base,'unrelated-data');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'keep.txt'),'keep');
  const history=path.join(f.state,'backups','3.26.0-history');fs.mkdirSync(history);
  fs.symlinkSync(outside,path.join(history,'escape'),process.platform==='win32'?'junction':'dir');
  const failed=run(f,'cleanup',false);assert.match(failed.stdout,/链接/);
  assert.equal(fs.readFileSync(path.join(outside,'keep.txt'),'utf8'),'keep');assert.ok(fs.existsSync(history));
});

test('cleanup rejects backup records belonging to a different installation',()=>{
  const a=fixture(),b=fixture();run(a,'apply');
  fs.mkdirSync(b.state,{recursive:true});fs.copyFileSync(path.join(a.state,'manifest.json'),path.join(b.state,'manifest.json'));
  assert.match(run(b,'cleanup',false).stdout,/另一个安装目录/);verifyOriginal(b);
});

test('backup folder opener creates Unicode and spaced paths and passes an unquoted folder to the shell', {skip:process.platform!=='win32'},()=>{
  const f=fixture();const folder=path.join(f.base,'查看备份 中文 空格','new-folder');
  const script=path.join(__dirname,'portable','CursorZhCN.ps1');
  const command=`$ErrorActionPreference='Stop'; $tokens=$null; $errors=$null
$tree=[Management.Automation.Language.Parser]::ParseFile($env:CURSOR_ZH_TEST_SCRIPT,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
foreach($name in @('Resolve-PhysicalDirectoryPath','Show-BackupDirectory')){
  $function=$tree.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
  Invoke-Expression $function.Extent.Text
}
$script:opened=$null
function Start-Process { param([string]$FilePath,[string]$ErrorAction) $script:opened=$FilePath }
$result=Show-BackupDirectory $env:CURSOR_ZH_TEST_FOLDER
if(-not [IO.Directory]::Exists($result)){throw 'Directory was not created'}
if($script:opened -cne $result){throw 'Shell received a different path'}
if([IO.Path]::GetFileName($result.TrimEnd([char]92)) -ne 'new-folder'){throw 'Shell received the wrong folder'}
if($script:opened.Contains([char]34)){throw 'Shell path contains quotes'}
`;
  const result=cp.spawnSync('powershell.exe',['-NoProfile','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{env:{...process.env,CURSOR_ZH_TEST_SCRIPT:script,CURSOR_ZH_TEST_FOLDER:folder+path.sep},encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(result.status,0,result.stderr||result.stdout);
});

test('status migrates verified current backups from redirected legacy storage to independent user data',()=>{
  const f=fixture();const local=path.join(f.base,'AppData','Local');
  const identity=crypto.createHash('sha256').update(path.resolve(f.root,'../..','Cursor.exe').toLowerCase()).digest('hex').slice(0,20);
  const oldState=path.join(local,'Packages','Sample.Packaged.App','LocalCache','Local','CursorZhCNPortable',identity);
  const seeded=cp.spawnSync(process.execPath,[path.join(payload,'patch.cjs'),'apply'],{env:{...process.env,CURSOR_ZH_APP_ROOT:f.root,CURSOR_ZH_STATE_DIR:oldState},encoding:'utf8',windowsHide:true});
  assert.equal(seeded.status,0,seeded.stderr);
  const oldManifest=JSON.parse(fs.readFileSync(path.join(oldState,'manifest.json'),'utf8'));
  // The old manifest can record the virtual path that Explorer could not access.
  for(const row of oldManifest.targets)row.backup=path.join(local,'CursorZhCNPortable',identity,path.relative(oldState,row.backup));
  fs.writeFileSync(path.join(oldState,'manifest.json'),JSON.stringify(oldManifest));
  f.env={LOCALAPPDATA:local};const result=run(f,'status');assert.equal(result.result.state,'applied');
  assert.match(result.stdout,/迁移到用户目录/);
  const migrated=JSON.parse(fs.readFileSync(path.join(f.state,'manifest.json'),'utf8'));
  assert.ok(migrated.targets.every(row=>row.backup.startsWith(f.state)&&fs.existsSync(row.backup)));
  run(f,'restore');verifyOriginal(f);
});

test('default backup path is directly under the user profile and contains no application cache levels', {skip:process.platform!=='win32'},()=>{
  const script=path.join(__dirname,'portable','CursorZhCN.ps1');
  const command=`$ErrorActionPreference='Stop';$tokens=$null;$errors=$null
$tree=[Management.Automation.Language.Parser]::ParseFile($env:CURSOR_ZH_TEST_SCRIPT,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
$function=$tree.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-InstallStateDirectory'},$true)
Invoke-Expression $function.Extent.Text
$StateDirectory=$null
$directory=Get-InstallStateDirectory 'C:\\Apps\\Cursor\\Cursor.exe'
$expected=Join-Path ([Environment]::GetFolderPath('UserProfile')) 'CursorZhCNPortable'
if([IO.Path]::GetDirectoryName($directory) -ne $expected){throw 'Backup path is not directly under user profile'}
if($directory -match 'OpenAI|ChatGPT|LocalCache|Packages'){throw 'Backup path contains unwanted app hierarchy'}
`;
  const result=cp.spawnSync('powershell.exe',['-NoProfile','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{env:{...process.env,CURSOR_ZH_TEST_SCRIPT:script},encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(result.status,0,result.stderr||result.stdout);
});

test('failure never emits completed progress and leaves vendor resources intact',()=>{
  const f=fixture();const metadata=JSON.parse(fs.readFileSync(path.join(f.root,'product.json'),'utf8'));
  metadata.checksums['vs/workbench/workbench.desktop.main.js']='unexpected';fs.writeFileSync(path.join(f.root,'product.json'),JSON.stringify(metadata));
  const failed=run(f,'apply',false);assert.equal(failed.lines.some(line=>line.type==='progress'&&line.percent===100),false);verifyOriginal(f);
});
test.after(()=>{const prefix=path.resolve(os.tmpdir())+path.sep+'cursor-zh-portable-test-';for(const root of roots){assert.ok(path.resolve(root).startsWith(prefix));fs.rmSync(root,{recursive:true,force:true});}});
