'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const readline = require('node:readline');
const {validateProduct}=require('./compatibility.cjs');
const {planCleanup,cleanupBackups}=require('./backup-cleanup.cjs');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const emit=data=>console.log(JSON.stringify(data));
function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch{return null;}}
const normal=file=>path.resolve(file).toLowerCase();
function inspectManifest(file,root,product){
  const manifest=readJson(file);
  if(!manifest || manifest.version!==product.version || (manifest.productCommit && manifest.productCommit!==product.commit))return null;
  const records=(manifest.targets || (manifest.target?[manifest]:[])).map(record=>({...record}));
  const expected=['out/vs/workbench/workbench.glass.main.js','out/vs/workbench/workbench.desktop.main.js','product.json'].map(name=>normal(path.join(root,name)));
  if(!records.length || !records.every(record=>expected.includes(normal(record.target))))return null;
  const seen=new Set();
  for(const record of records){
    if(seen.has(normal(record.target)))return null;seen.add(normal(record.target));
    try{
      const actual=hash(fs.readFileSync(record.target));
      if(actual!==record.originalSha256 && actual!==record.patchedSha256)return null;
      // Resolve backups relative to their manifest, including former AppData redirection.
      const marker=path.sep+'backups'+path.sep;
      const offset=typeof record.backup==='string'?record.backup.lastIndexOf(marker):-1;
      if(offset>=0){
        const localRoot=path.join(path.dirname(file),'backups');
        const localBackup=path.resolve(localRoot,record.backup.slice(offset+marker.length));
        const relative=path.relative(localRoot,localBackup);
        if(relative && relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)&&fs.existsSync(localBackup))record.backup=localBackup;
      }
      if(hash(fs.readFileSync(record.backup))!==record.originalSha256)return null;
    }catch{return null;}
  }
  return {...manifest,targets:records};
}
async function main(){
  const request=readJson(process.argv[2]);
  if(!request || !['status','apply','restore','cleanup-preview','cleanup'].includes(request.action) || !request.appRoot || !request.stateDir)throw new Error('操作请求不完整。');
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
    if(fs.existsSync(manifestPath)&&!currentManifest)throw new Error('本机备份清单无法读取，已停止操作。');
    if(currentManifest){
      const records=currentManifest.targets || (currentManifest.target?[currentManifest]:[]);
      const expected=['out/vs/workbench/workbench.glass.main.js','out/vs/workbench/workbench.desktop.main.js','product.json'].map(name=>normal(path.join(root,name)));
      if(!records.every(record=>expected.includes(normal(record.target))))throw new Error('本机备份记录属于另一个安装目录，已停止。');
    }
    if(request.action==='cleanup-preview'||request.action==='cleanup'){
      emit({type:'progress',percent:5,message:'检查历史备份与当前还原所需文件'});
      if(request.action==='cleanup-preview'){
        const plan=planCleanup(state,currentManifest);
        emit({type:'result',state:'cleanup-preview',installedVersion:product.version,removableCount:plan.directories.length,removableBytes:plan.bytes,retainedCount:plan.retainedCount,backupDir:state});
      }else{
        const result=cleanupBackups(state,currentManifest,(percent,message)=>emit({type:'progress',percent,message}));
        emit({type:'progress',percent:100,message:'历史备份清理完成，当前还原备份已保留'});
        emit({type:'result',state:'cleaned',installedVersion:product.version,...result,backupDir:state});
      }
      return;
    }
    let adoptable=null,adoptSource=null,migratePortable=false;
    if(!currentManifest){
      const exeDirectory=path.resolve(root,'..','..');
      const identity=hash(Buffer.from(path.join(exeDirectory,'Cursor.exe').toLowerCase())).slice(0,20);
      const localAppData=process.env.LOCALAPPDATA||state;
      const portableCandidates=[path.join(localAppData,'CursorZhCNPortable',identity,'manifest.json')];
      try{
        const packages=path.join(localAppData,'Packages');
        for(const entry of fs.readdirSync(packages,{withFileTypes:true})){
          if(entry.isDirectory()&&!entry.isSymbolicLink())portableCandidates.push(path.join(packages,entry.name,'LocalCache','Local','CursorZhCNPortable',identity,'manifest.json'));
        }
      }catch{}
      const candidates=[...portableCandidates,path.join(path.dirname(exeDirectory),'CursorZhCN','manifest.json'),path.join(localAppData,'CursorZhCN','manifest.json')];
      for(const file of candidates){
        if(normal(path.dirname(file))===normal(state))continue;
        const checked=inspectManifest(file,root,product);
        if(checked){adoptable=checked;adoptSource=file;migratePortable=portableCandidates.includes(file);break;}
      }
    }
    if(adoptable && request.action==='status' && !migratePortable){
      emit({type:'result',installedVersion:product.version,state:'managed-elsewhere',message:'已注入；检测到可验证的原始备份，可直接接管',backupDir:path.dirname(adoptSource)});return;
    }
    if(adoptable){
      emit({type:'progress',percent:1,message:migratePortable?'将已验证的当前备份迁移到用户目录':'接管已验证的本机原始备份'});
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
