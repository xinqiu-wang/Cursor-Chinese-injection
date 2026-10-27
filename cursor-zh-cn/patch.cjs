'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const { validateProduct, validateEntry } = require('./compatibility.cjs');
const stateDir = process.env.CURSOR_ZH_STATE_DIR || __dirname;
fs.mkdirSync(stateDir, { recursive: true });
const manifestPath = path.join(stateDir, 'manifest.json');
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
const priorProduct = previous?.targets?.find(record => path.basename(record.target) === 'product.json');
const recordedRoot = priorProduct ? path.dirname(priorProduct.target) : previous?.target ? path.resolve(path.dirname(previous.target),'../../..') : null;
const root = process.env.CURSOR_ZH_APP_ROOT || recordedRoot;
if (!root) throw new Error('请先选择 Cursor 安装位置。');
const product = JSON.parse(fs.readFileSync(path.join(root, 'product.json'), 'utf8'));
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const action = process.argv[2] || 'status';
const progressEnabled = process.env.CURSOR_ZH_PROGRESS === '1';
function progress(percent, message) { if (progressEnabled) console.log(JSON.stringify({ type:'progress',percent,message })); }
function result(data) { console.log(JSON.stringify(progressEnabled ? {type:'result',...data} : data, null, progressEnabled ? 0 : 2)); }
const sameGeneration = previous && previous.version === product.version && (!previous.productCommit || previous.productCommit === product.commit);
const oldRecords = sameGeneration ? previous.targets || [previous] : [];
const targetPaths = ['workbench.glass.main.js', 'workbench.desktop.main.js'].map(name => path.join(root, 'out/vs/workbench', name)).filter(target => !target.endsWith('workbench.glass.main.js') || fs.existsSync(target));
targetPaths.push(path.join(root, 'product.json'));
if (sameGeneration && !oldRecords.every(record => targetPaths.some(target => path.resolve(target).toLowerCase() === path.resolve(record.target).toLowerCase()))) throw new Error('备份清单属于另一个 Cursor 安装，已停止。');
function stateFor(target) {
  const current = fs.readFileSync(target);
  const hash = sha256(current);
  const prior = oldRecords.find(record => record.target === target);
  return { target, current, hash, prior, state: !prior ? 'not-applied' : hash === prior.patchedSha256 ? 'applied' : hash === prior.originalSha256 ? 'restored' : 'changed-since-patch' };
}
if (action === 'status') {
  progress(10,'读取版本与资源状态');
  result({ installedVersion: product.version, targets: targetPaths.map(target => { const s = stateFor(target); return { target, state: s.state, sha256: s.hash }; }) });
} else if (action === 'apply') {
  progress(5,'检查 Cursor 身份与资源结构');
  validateProduct(product);
  const extra = JSON.parse(fs.readFileSync(path.join(__dirname, 'translations-extra.json'), 'utf8'));
  const languagepack = JSON.parse(fs.readFileSync(path.join(__dirname, 'translations-languagepack.json'), 'utf8'));
  const overlay = fs.readFileSync(path.join(__dirname, 'agents-overlay.js'), 'utf8').replace('/* EXTRA_DICTIONARY */{}', () => JSON.stringify(extra)).replace('/* LANGUAGEPACK_DICTIONARY */{}', () => JSON.stringify(languagepack));
  const overlayHash = sha256(Buffer.from(overlay));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const planned = [];
  try {
    for (const target of targetPaths) {
      const step = targetPaths.indexOf(target);
      progress(10+step*18,'校验并准备备份：'+path.basename(target));
      const s = stateFor(target);
      if (s.state === 'changed-since-patch') throw new Error('Resource changed; review before patching: ' + target);
      let original, backup;
      if (s.prior) {
        backup = s.prior.backup;
        original = fs.readFileSync(backup);
        if (sha256(original) !== s.prior.originalSha256) throw new Error('Backup hash mismatch: ' + backup);
      } else {
        if (!target.endsWith('product.json')) validateEntry(s.current.toString('utf8'), path.basename(target));
        original = s.current;
        const backupDir = path.join(stateDir, 'backups', product.version + '-' + stamp);
        fs.mkdirSync(backupDir, { recursive: true });
        backup = path.join(backupDir, path.basename(target));
        fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
        if (sha256(fs.readFileSync(backup)) !== s.hash) throw new Error('Backup verification failed.');
      }
      if (!target.endsWith('product.json')) validateEntry(original.toString('utf8'), path.basename(target));
      progress(16+step*18,'原文件备份已验证：'+path.basename(target));
      let patched;
      if (target.endsWith('product.json')) {
        const metadata = JSON.parse(original.toString('utf8'));
        let metadataText = original.toString('utf8');
        for (const js of planned) {
          const key = path.relative(path.join(root, 'out'), js.target).replaceAll('\\', '/');
          const expected = metadata.checksums?.[key];
          if (!expected) continue;
          const originalChecksum = Buffer.from(js.record.originalSha256, 'hex').toString('base64').replace(/=+$/, '');
          if (expected !== originalChecksum) throw new Error('Original resource does not match vendor checksum: ' + key);
          const newChecksum = Buffer.from(js.record.patchedSha256, 'hex').toString('base64').replace(/=+$/, '');
          if (metadataText.split(JSON.stringify(expected)).length !== 2) throw new Error('Checksum metadata is not unique: ' + key);
          metadataText = metadataText.replace(JSON.stringify(expected), JSON.stringify(newChecksum));
        }
        JSON.parse(metadataText);
        patched = Buffer.from(metadataText, 'utf8');
      } else patched = Buffer.concat([original, Buffer.from('\n;\n' + overlay + '\n', 'utf8')]);
      const patchedHash = sha256(patched);
      const record = { target, backup, originalSha256: sha256(original), patchedSha256: patchedHash, bytesAdded: patched.length - original.length };
      const stage = target + '.zh-cn-check-' + process.pid + '.mjs';
      const item = { ...s, patched, record, stage, installed: false, skip: s.hash === patchedHash };
      planned.push(item);
      if (item.skip) continue;
      fs.writeFileSync(stage, patched, { flag: 'wx' });
      if (!target.endsWith('product.json')) {
        progress(22+step*18,'检查完整 JavaScript 语法：'+path.basename(target));
        const check = cp.spawnSync(process.execPath, ['--check', stage], { encoding: 'utf8', shell: false, windowsHide: true });
        if (check.status !== 0) throw new Error((check.stderr || 'JavaScript syntax check failed.').slice(-1800));
      }
    }
    if (planned.every(item => item.skip) && sameGeneration && previous.productCommit === product.commit && previous.overlaySha256 === overlayHash) { progress(100,'已是当前中文补丁，无需重复注入'); result({ state: 'ready', version: product.version, unchanged: true }); return; }
    const next = { schemaVersion: 3, version: product.version, productCommit: product.commit || null, createdAt: new Date().toISOString(), overlaySha256: overlayHash, extraTranslationCount: Object.keys(extra).length, targets: planned.map(item => item.record) };
    if (previous) {
      const history = path.join(stateDir, 'history');
      fs.mkdirSync(history, { recursive: true });
      fs.writeFileSync(path.join(history, stamp + '.json'), JSON.stringify(previous, null, 2) + '\n', { flag: 'wx' });
    }
    // Persist recovery records before touching either installed resource.
    progress(72,'保存当前版本的还原清单');
    fs.writeFileSync(manifestPath, JSON.stringify(next, null, 2) + '\n');
    try {
      for (const item of planned) {
        if (item.skip) continue;
        progress(78+planned.indexOf(item)*6,'注入并校验：'+path.basename(item.target));
        if (sha256(fs.readFileSync(item.target)) !== item.hash) throw new Error('Resource changed during patch: ' + item.target);
        fs.renameSync(item.stage, item.target);
        item.installed = true;
        if (sha256(fs.readFileSync(item.target)) !== item.record.patchedSha256) throw new Error('Installed hash mismatch.');
      }
    } catch (error) {
      for (const item of planned.filter(item => item.installed)) fs.writeFileSync(item.target, item.current);
      if (previous) fs.writeFileSync(manifestPath, JSON.stringify(previous, null, 2) + '\n');
      else fs.unlinkSync(manifestPath);
      throw error;
    }
    progress(100,'注入完成，资源与备份校验通过');
    result({ state: 'applied', ...next });
  } finally {
    for (const item of planned) if (fs.existsSync(item.stage)) fs.unlinkSync(item.stage);
  }
} else if (action === 'restore') {
  progress(5,'检查当前版本与还原清单');
  if (!previous) throw new Error('No backup manifest found.');
  if (!sameGeneration) throw new Error('Cursor 已升级，不能将旧版本备份还原到新版本。');
  const plan = oldRecords.map(record => {
    progress(10+oldRecords.indexOf(record)*18,'验证原始备份：'+path.basename(record.target));
    const currentHash = sha256(fs.readFileSync(record.target));
    if (currentHash !== record.patchedSha256 && currentHash !== record.originalSha256) throw new Error('Resource changed; refusing to overwrite: ' + record.target);
    const original = fs.readFileSync(record.backup);
    if (sha256(original) !== record.originalSha256) throw new Error('Backup hash mismatch: ' + record.backup);
    return { record, original, skip: currentHash === record.originalSha256 };
  });
  for (const { record, original, skip } of plan) {
    if (skip) continue;
    progress(68+oldRecords.indexOf(record)*10,'还原并校验：'+path.basename(record.target));
    const stage = record.target + '.zh-cn-restore-' + process.pid;
    fs.writeFileSync(stage, original, { flag: 'wx' });
    fs.renameSync(stage, record.target);
    if (sha256(fs.readFileSync(record.target)) !== record.originalSha256) throw new Error('Restore hash mismatch.');
  }
  progress(100,'还原完成，原始资源校验通过');
  result({state:'restored',version:product.version});
} else throw new Error('Usage: node patch.cjs [status|apply|restore]');
