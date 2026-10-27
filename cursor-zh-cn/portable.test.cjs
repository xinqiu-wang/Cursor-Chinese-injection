'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const roots=[];
const payload=path.resolve(__dirname,'../dist/Cursor中文注入工具/payload');
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
  const result=cp.spawnSync(process.execPath,[runner,request],{encoding:'utf8',windowsHide:true,timeout:30000});
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
test('failure never emits completed progress and leaves vendor resources intact',()=>{
  const f=fixture();const metadata=JSON.parse(fs.readFileSync(path.join(f.root,'product.json'),'utf8'));
  metadata.checksums['vs/workbench/workbench.desktop.main.js']='unexpected';fs.writeFileSync(path.join(f.root,'product.json'),JSON.stringify(metadata));
  const failed=run(f,'apply',false);assert.equal(failed.lines.some(line=>line.type==='progress'&&line.percent===100),false);verifyOriginal(f);
});
test.after(()=>{const prefix=path.resolve(os.tmpdir())+path.sep+'cursor-zh-portable-test-';for(const root of roots){assert.ok(path.resolve(root).startsWith(prefix));fs.rmSync(root,{recursive:true,force:true});}});
