'use strict';
function validateProduct(product) {
  if (product.applicationName !== 'cursor' || !/^Cursor\b/.test(product.nameLong || product.nameShort || '')) throw new Error('目标不是已识别的官方 Cursor 安装。');
  if (!/^\d+\.\d+\.\d+(?:[-.][\w.-]+)?$/.test(product.version || '')) throw new Error('无法识别 Cursor 版本。');
  if (!product.checksums || typeof product.checksums !== 'object') throw new Error('新版本缺少资源校验记录，需要适配。');
  if (typeof product.checksums['vs/workbench/workbench.desktop.main.js'] !== 'string') throw new Error('新版本的编辑器资源校验方式已变化，需要适配。');
}
function validateEntry(source, name) {
  if (source.includes('/* cursor-zh-cn-local:start */')) throw new Error('发现未登记或混合版本的中文补丁：' + name);
  if (!/\bexport\s*(?:\{[^}]*\bmain\b|(?:async\s+)?function\s+main\b)/.test(source)) throw new Error('新版本的界面入口结构已变化：' + name);
  const contract = name.includes('.glass.') ? 'glass-sidebar' : 'workbench.parts.editor';
  if (!source.includes(contract)) throw new Error('新版本的界面结构需要重新适配：' + name);
}
module.exports = { validateProduct, validateEntry };
