'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const readline = require('node:readline');
const {validateProduct}=require('./compatibility.cjs');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const emit=data=>console.log(JSON.stringify(data));
function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch{return null;}}
const normal=file=>path.resolve(file).toLowerCase();
function inspectManifest(file,root,product){
  const manifest=readJson(file);
  if(!manifest || manifest.version!==product.version || (manifest.productCommit && manifest.productCommit!==product.commit))return null;
  const records=manifest.targets || (manifest.target?[manifest]:[]);
  const expected=['out/vs/workbench/workbench.glass.main.js','out/vs/workbench/workbench.desktop.main.js','product.json'].map(name=>normal(path.join(root,name)));
  if(!records.length || !records.every(record=>expected.includes(normal(record.target))))return null;
  const seen=new Set();
  for(const record of records){
    if(seen.has(normal(record.target)))return null;seen.add(normal(record.target));
    try{
      const actual=hash(fs.readFileSync(record.target));
      if(actual!==record.originalSha256 && actual!==record.patchedSha256)return null;
      if(hash(fs.readFileSync(record.backup))!==record.originalSha256)return null;
    }catch{return null;}
  }
  return {...manifest,targets:records};
}
async function main(){
  const request=readJson(process.argv[2]);
  if(!request || !['status','apply','restore'].includes(request.action) || !request.appRoot || !request.stateDir)throw new Error('操作请求不完整。');
  const root=path.resolve(request.appRoot),state=path.resolve(request.stateDir);
  const product=readJson(path.join(root,'product.json'));
  if(!product)throw new Error('该目录不是有效的 Cursor 安装。请重新选择 Cursor.exe。');
  validateProduct(product);
  fs.mkdirSync(state,{recursive:true});
  const lockPath=path.join(state,'portable.lock');let locked=false;
  try{
    try{const fd=fs.openSync(lockPath,'wx');fs.writeFileSync(fd,JSON.stringify({pid:process.pid}));fs.closeSync(fd);locked=true;}
    catch(error){
      if(error.code!=='EEXIST')throw error;
      const owner=readJson(lockPath);let alive=false;
      if(owner?.pid){try{process.kill(owner.pid,0);alive=true;}catch{}}
      if(alive || (!owner && Date.now()-fs.statSync(lockPath).mtimeMs<10000))throw new Error('另一个注入任务正在运行，请等待完成。');
      fs.unlinkSync(lockPath);const fd=fs.openSync(lockPath,'wx');fs.writeFileSync(fd,JSON.stringify({pid:process.pid}));fs.closeSync(fd);locked=true;
    }
    const manifestPath=path.join(state,'manifest.json');
    const currentManifest=readJson(manifestPath);
    if(currentManifest){
      const records=currentManifest.targets || (currentManifest.target?[currentManifest]:[]);
      const expected=['out/vs/workbench/workbench.glass.main.js','out/vs/workbench/workbench.desktop.main.js','product.json'].map(name=>normal(path.join(root,name)));
      if(!records.every(record=>expected.includes(normal(record.target))))throw new Error('本机备份记录属于另一个安装目录，已停止。');
    }
    let adoptable=null,adoptSource=null;
    if(!currentManifest){
      const exeDirectory=path.resolve(root,'..','..');
      const candidates=[path.join(path.dirname(exeDirectory),'CursorZhCN','manifest.json'),path.join(process.env.LOCALAPPDATA||state,'CursorZhCN','manifest.json')];
      for(const file of candidates){const checked=inspectManifest(file,root,product);if(checked){adoptable=checked;adoptSource=file;break;}}
    }
    if(adoptable && request.action==='status'){
      emit({type:'result',installedVersion:product.version,state:'managed-elsewhere',message:'已注入；检测到可验证的原始备份，可直接接管',backupDir:path.dirname(adoptSource)});return;
    }
    if(adoptable){
      emit({type:'progress',percent:1,message:'接管已验证的本机原始备份'});
      const backupFolder=path.join(state,'backups','adopted-'+product.version+'-'+Date.now());
      fs.mkdirSync(backupFolder,{recursive:true});
      const migrated={...adoptable,targets:adoptable.targets.map(record=>({...record}))};
      for(const record of migrated.targets){
        const destination=path.join(backupFolder,path.basename(record.target));fs.copyFileSync(record.backup,destination,fs.constants.COPYFILE_EXCL);
        if(hash(fs.readFileSync(destination))!==record.originalSha256)throw new Error('复制已有备份时校验失败。');
        record.backup=destination;
      }
      const stage=manifestPath+'.adopting';fs.writeFileSync(stage,JSON.stringify(migrated,null,2)+'\n');fs.renameSync(stage,manifestPath);
      emit({type:'progress',percent:4,message:'本机备份已接管，开始检查补丁'});
    }
    const child=cp.spawn(process.execPath,[path.join(__dirname,'patch.cjs'),request.action],{env:{...process.env,CURSOR_ZH_APP_ROOT:root,CURSOR_ZH_STATE_DIR:state,CURSOR_ZH_PROGRESS:'1'},windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});
    let result=null,stderr='';
    readline.createInterface({input:child.stdout}).on('line',line=>{
      try{const item=JSON.parse(line);if(item.type==='result')result=item;else if(item.type==='progress')emit(item);}catch{}
    });
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-4000);});
    const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
    if(code!==0){
      if(/EACCES|EPERM|access is denied/i.test(stderr))throw new Error('当前安装目录需要管理员权限。请关闭工具，右键“启动工具.cmd”选择“以管理员身份运行”。');
      if(/Untracked patch|混合版本|未登记/i.test(stderr))throw new Error('检测到未登记的旧补丁，但没有可验证的原始备份。请先修复或重装官方 Cursor，再注入。');
      const errorLine=stderr.split(/\r?\n/).find(line=>/^(Error|TypeError|SyntaxError):/.test(line.trim()));
      throw new Error(errorLine || stderr.slice(-1800) || '注入任务未完成。');
    }
    const rows=result?.targets||[];
    const stateName=result?.state || (rows.length && rows.every(row=>row.state==='applied')?'applied':rows.some(row=>row.state==='changed-since-patch')?'changed-since-patch':'not-applied');
    emit({type:'result',state:stateName,installedVersion:product.version,unchanged:result?.unchanged||false,backupDir:state,targets:request.action==='status'?rows:undefined});
  }finally{if(locked && readJson(lockPath)?.pid===process.pid)fs.unlinkSync(lockPath);}
}
main().catch(error=>{emit({type:'error',message:error.message});process.exitCode=1;});
