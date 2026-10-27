'use strict';
const fs=require('node:fs');
const path=require('node:path');
const normal=value=>path.resolve(value).toLowerCase();
function planCleanup(state,manifest){
  const backupRoot=path.resolve(state,'backups');
  if(!fs.existsSync(backupRoot))return{directories:[],retainedCount:0,bytes:0};
  if(fs.lstatSync(backupRoot).isSymbolicLink())throw new Error('备份目录是链接，已停止清理。');
  const realState=fs.realpathSync(state),realRoot=fs.realpathSync(backupRoot);
  if(normal(realRoot)!==normal(path.join(realState,'backups')))throw new Error('备份目录超出本机数据目录，已停止清理。');
  const records=manifest?.targets || (manifest?.target?[manifest]:[]);
  if(!records.length)throw new Error('没有有效的当前备份清单，已保留所有备份。');
  const protectedDirectories=new Set();
  for(const record of records){
    if(typeof record.backup!=='string')throw new Error('备份清单缺少原文件位置，已停止清理。');
    const relative=path.relative(backupRoot,path.resolve(record.backup));
    if(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative)||!relative.includes(path.sep))throw new Error('备份清单指向其他目录，已停止清理。');
    protectedDirectories.add(normal(path.join(backupRoot,relative.split(path.sep)[0])));
  }
  function inspect(directory){
    const stat=fs.lstatSync(directory);
    if(stat.isSymbolicLink())throw new Error('历史备份包含目录链接，已停止清理。');
    const relative=path.relative(realRoot,fs.realpathSync(directory));
    if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('删除目标超出备份目录，已停止清理。');
    if(stat.isDirectory())return fs.readdirSync(directory).reduce((sum,name)=>sum+inspect(path.join(directory,name)),0);
    if(!stat.isFile())throw new Error('历史备份含未知文件类型，已停止清理。');
    return stat.size;
  }
  const directories=[];let retainedCount=0,bytes=0;
  for(const entry of fs.readdirSync(backupRoot,{withFileTypes:true})){
    const target=path.join(backupRoot,entry.name);
    if(protectedDirectories.has(normal(target))){retainedCount++;continue;}
    if(entry.isSymbolicLink())throw new Error('历史备份包含目录链接，已停止清理。');
    if(!entry.isDirectory()||!/^\d+\.\d+\.\d+[-.]|^adopted-\d+\.\d+\.\d+-/.test(entry.name))continue;
    const size=inspect(target);directories.push({path:target,bytes:size});bytes+=size;
  }
  return{directories,retainedCount,bytes};
}
function cleanupBackups(state,manifest,onProgress=()=>{}){
  const plan=planCleanup(state,manifest);let deletedCount=0,deletedBytes=0;
  for(const entry of plan.directories){
    // Revalidate all absolute targets and reject links immediately before removal.
    const checked=planCleanup(state,manifest);
    if(!checked.directories.some(row=>normal(row.path)===normal(entry.path)))throw new Error('备份目录在清理期间发生变化，已停止。');
    fs.rmSync(entry.path,{recursive:true,force:false});deletedCount++;deletedBytes+=entry.bytes;
    onProgress(Math.round(10+deletedCount/plan.directories.length*85),'已删除历史备份 '+deletedCount+' / '+plan.directories.length);
  }
  return{deletedCount,deletedBytes,retainedCount:plan.retainedCount};
}
module.exports={planCleanup,cleanupBackups};
