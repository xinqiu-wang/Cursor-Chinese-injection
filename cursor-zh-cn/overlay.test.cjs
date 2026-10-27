const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const extra = JSON.parse(fs.readFileSync(path.join(__dirname, 'translations-extra.json'), 'utf8'));
const official = JSON.parse(fs.readFileSync(path.join(__dirname, 'translations-languagepack.json'), 'utf8'));
const source = fs.readFileSync(path.join(__dirname, 'agents-overlay.js'), 'utf8')
  .replace('/* EXTRA_DICTIONARY */{}', () => JSON.stringify(extra))
  .replace('/* LANGUAGEPACK_DICTIONARY */{}', () => JSON.stringify(official))
  .replace('  const pending = new Set();', '  globalThis.testHooks = {translate,translateText,translateAttributes,translateEditablePlaceholders,scan,translations}; const pending = new Set();');
const context = { document: { readyState: 'loading', addEventListener() {} }, Map, Set, Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 } };
vm.runInNewContext(source, context);
const hooks = context.testHooks;
assert.equal(hooks.translate('Chat Width'), '对话宽度');
assert.equal(hooks.translate('Plan New Idea ⇧Tab'), '规划新想法 ⇧Tab');
assert.equal(hooks.translate('Usage limits reset on 11月1日 (5 days left)'), '用量限额于 11月1日 重置（剩余 5 天）');
assert.equal(hooks.translate('Claude Opus 4.6'), 'Claude Opus 4.6');
assert.equal(hooks.translate('Cursor'), 'Cursor');
assert.equal(hooks.translate('Origin'), 'Origin');
for (const [english, chinese] of Object.entries(extra)) assert.equal(hooks.translations.get(english), chinese);
let protectedCount = 0;
for (const label of ['pre','code','textarea','input','[contenteditable="true"]','.monaco-editor','.xterm','.composer-human-message','.composer-ai-message']) {
  const text = { nodeValue: 'New Chat', parentElement: { closest(selector) { return selector.includes(label) ? {} : null; } } };
  hooks.translateText(text);
  assert.equal(text.nodeValue, 'New Chat', label + ' must remain unchanged');
  protectedCount++;
}
const normalText = { nodeValue: 'New Chat', parentElement: { closest() { return null; } } };
hooks.translateText(normalText);
assert.equal(normalText.nodeValue, '新建对话');
const attributes = new Map([['placeholder','New Chat']]);
const input = { value: 'New Chat', matches() { return false; }, closest() { return null; }, hasAttribute(name) { return attributes.has(name); }, getAttribute(name) { return attributes.get(name); }, setAttribute(name,value) { attributes.set(name,value); } };
hooks.translateAttributes(input);
assert.equal(attributes.get('placeholder'), '新建对话');
assert.equal(input.value, 'New Chat');
// Reproduce the CSS placeholder inside an excluded contenteditable ancestor.
const placeholderText = 'Plan, Build, / for skills, @ for context';
const placeholderAttrs = new Map([['data-placeholder', placeholderText], ['aria-placeholder', placeholderText]]);
const paragraph = { matches() { return false; }, closest() { return null; }, hasAttribute(name) { return placeholderAttrs.has(name); }, getAttribute(name) { return placeholderAttrs.get(name); }, setAttribute(name, value) { placeholderAttrs.set(name, value); } };
const editor = { nodeType: 1, textContent: 'New Chat', value: 'New Chat', matches(selector) { return selector.includes('[contenteditable="true"]'); }, closest() { return null; }, hasAttribute() { return false; }, querySelectorAll() { return [paragraph]; } };
hooks.scan(editor);
assert.equal(placeholderAttrs.get('data-placeholder'), '规划、构建，输入 / 使用技能，输入 @ 添加上下文');
assert.equal(placeholderAttrs.get('aria-placeholder'), '规划、构建，输入 / 使用技能，输入 @ 添加上下文');
assert.equal(editor.textContent, 'New Chat');
assert.equal(editor.value, 'New Chat');
const screenshotCases = [
  ['Changes', '更改'], ['Browser', '浏览器'],
  [' let you control and extend the agent loop - use ', ' 可用于控制和扩展智能体工作流程，使用 '],
  [' to get started', ' 即可开始'],
  ['Browser Automation', '浏览器自动化'], ['Browser automation disabled', '浏览器自动化已关闭'],
  ['Browser Protection', '浏览器操作保护'],
  ['Prevent Agent from automatically running Browser tools', '防止智能体自动运行浏览器工具'],
  ['Open Local Links in Cursor Browser', '在 Cursor 浏览器中打开本地链接'],
  ['Open Web Links in Cursor Browser', '在 Cursor 浏览器中打开网页链接'],
  ['Accept the next word of a suggestion via Ctrl+RightArrow', '使用 Ctrl+RightArrow 接受建议中的下一个词'],
  ['Automatically import necessary modules for TypeScript', '自动为 TypeScript 导入所需模块']
];
for (const [english, chinese] of screenshotCases) assert.equal(hooks.translate(english), chinese);
console.log(JSON.stringify({ translationEntriesVerified: Object.keys(extra).length, protectedContentCases: protectedCount, screenshotTextCases: screenshotCases.length, nestedEditablePlaceholder: 'passed', promptTextAndValuePreserved: 'passed', dynamicLabels: 'passed', modelNamePreserved: 'passed' }, null, 2));
