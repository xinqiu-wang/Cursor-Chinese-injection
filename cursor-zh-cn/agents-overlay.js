/* cursor-zh-cn-local:start */
// Display-only translations for Cursor Agents 3.27.14. No prompt or input values are changed.
(() => {
  if (typeof document === 'undefined' || globalThis.__cursorAgentsZhCn) return;
  const translations = new Map(Object.entries({
    'File': '文件', 'Edit': '编辑', 'View': '视图', 'Help': '帮助',
    'Selection': '选择', 'Go': '转到', 'Run': '运行', 'Terminal': '终端',
    'New Chat': '新建对话', 'New Agent': '新建智能体',
    'Automations': '自动化', 'New Automation': '新建自动化',
    'Customize': '自定义', 'Projects': '项目', 'New Project': '新建项目',
    'Repositories': '代码仓库', 'All repositories': '全部代码仓库',
    'Search repositories': '搜索代码仓库', 'Search projects': '搜索项目',
    'Customize Sidebar': '自定义侧边栏', 'Open Workspace': '打开工作区',
    'Hide Sidebar': '隐藏侧边栏', 'Show Sidebar': '显示侧边栏',
    'Search': '搜索', 'Search actions...': '搜索操作…', 'Search Settings': '搜索设置',
    'Go Back': '后退', 'Go Forward': '前进', 'Back': '返回',
    'Start from scratch': '从零开始', 'Cloud': '云端', 'This PC': '本机',
    'This Computer': '本机', 'Local': '本地',
    'Plan, Build, / for skills, @ for context': '规划、构建，输入 / 使用技能，输入 @ 添加上下文',
    'Plan, search, build anything': '规划、搜索、构建任何内容',
    'Ask, learn, brainstorm': '提问、学习、头脑风暴',
    'Add a follow-up': '继续提问', 'Ask a follow-up': '继续提问',
    'Start with a plan': '先制定计划',
    'Align on implementation before writing code': '编写代码前，先明确实施方案',
    'Debug an issue': '排查问题',
    'Find root causes and fix tricky bugs': '定位根因，修复疑难问题',
    'Create a dashboard': '创建仪表盘',
    'Visualize information in a custom interface': '通过自定义界面展示信息',
    'Hide tips': '隐藏提示', 'Show tips': '显示提示',
    'Use /shell to run commands in the terminal': '输入 /shell 在终端中运行命令',
    'Messages sent while Cursor is working can steer it mid-run without interrupting - turn it on under New Messages in Agents settings': 'Cursor 工作时发送的消息可在不中断任务的情况下调整方向；可在“智能体”设置的“新消息”中开启',
    'Settings': '设置', 'Close Settings': '关闭设置',
    'General': '通用', 'Appearance': '外观', 'Plan & Usage': '套餐与用量',
    'Agents': '智能体', 'Cloud Agents': '云端智能体', 'Models': '模型',
    'Voice': '语音', 'Source Control': '源代码管理',
    'Browser & Network': '浏览器与网络', 'Code Intelligence': '代码智能',
    'Beta': '测试功能', 'Docs': '文档', 'Account': '账户',
    'Theme': '主题', 'Color Theme': '颜色主题', 'Language': '语言',
    'Rules, Skills, Subagents': '规则、技能与子智能体', 'Rules': '规则',
    'Skills': '技能', 'Subagents': '子智能体', 'Plugins': '插件',
    'Tools & MCPs': '工具与 MCP', 'Hooks': '钩子',
    'Chat actions': '对话操作', 'Show Apps': '显示应用', 'Hide Apps': '隐藏应用',
    'Select Model': '选择模型', 'Select Workspace': '选择工作区',
    'Start voice input': '开始语音输入', 'Start voice chat': '开始语音对话',
    'Add agents, context, tools': '添加智能体、上下文或工具',
    'Open project': '打开项目', 'Clone repo': '克隆仓库',
    'Connect via SSH': '通过 SSH 连接',
    'All': '全部', 'Chats': '对话', 'Files': '文件', 'Actions': '操作',
    'More': '更多', 'Recent': '最近', 'History': '历史记录',
    'New Folder': '新建文件夹', 'Open Folder': '打开文件夹',
    'Rename': '重命名', 'Delete': '删除', 'Remove': '移除',
    'Cancel': '取消', 'Save': '保存', 'Apply': '应用', 'Done': '完成',
    'Close': '关闭', 'Open': '打开', 'Add': '添加', 'Create': '创建',
    'Continue': '继续', 'Retry': '重试', 'Refresh': '刷新',
    'Copy': '复制', 'Paste': '粘贴', 'Cut': '剪切',
    'Undo': '撤销', 'Redo': '重做', 'Select All': '全选',
    'Notifications': '通知', 'Loading...': '正在加载…',
    'Open Cursor Settings': '打开 Cursor 设置',
    'Toggle Primary Side Bar': '切换主侧边栏', 'Toggle Panel': '切换面板',
    'Toggle Agents': '切换智能体面板', 'Agents Window': '智能体窗口',
    'Partial Accepts': '部分接受', 'Suggestions While Commenting': '注释中显示建议',
    'Whitespace-Only Suggestions': '仅空白字符的建议', 'Imports': '导入',
    'Ignored Files': '忽略的文件', 'Codebase': '代码库',
    'Team-Level Repository Control': '团队级代码仓库控制',
    'Index Repositories for Instant Grep': '索引代码仓库以加速搜索',
    'Ignore Files': '忽略文件', 'Enable LSPs': '启用语言服务器',
    'Enable LSPs for Worktrees': '为工作树启用语言服务器',
    'Maximum Local LSP Workspaces': '本地语言服务器工作区上限',
    'Maximum Remote LSP Workspaces': '远程语言服务器工作区上限'
  }));
  for (const [english, chinese] of Object.entries(/* EXTRA_DICTIONARY */{})) translations.set(english, chinese);
  for (const [english, chinese] of Object.entries(/* LANGUAGEPACK_DICTIONARY */{})) if (!translations.has(english)) translations.set(english, chinese);
  const excluded = 'script,style,noscript,textarea,input,pre,code,[contenteditable="true"],.monaco-editor,.xterm,.rendered-markdown,.markdown-body,.markdown-section,.composer-human-message,.composer-ai-message,[data-message-id],[data-message-role]';
  const attributes = ['placeholder', 'data-placeholder', 'aria-placeholder', 'aria-description', 'aria-label', 'title'];
  function translate(value) {
    if (!value) return value;
    const trimmed = value.trim();
    const chinese = translations.get(trimmed);
    if (chinese) return value.replace(trimmed, chinese);
    // Preserve shortcut hints and punctuation surrounding otherwise exact labels.
    const shortcut = trimmed.match(/^(.*?)\s+(\((?:Ctrl|Alt|Shift|Cmd|Control|⌘)[^)]*\))$/);
    if (shortcut && translations.has(shortcut[1])) return value.replace(shortcut[1], translations.get(shortcut[1]));
    const punctuation = trimmed.match(/^(.*?)([:：.…]+)$/);
    if (punctuation && translations.has(punctuation[1])) return value.replace(punctuation[1], translations.get(punctuation[1]));
    const symbolicShortcut = trimmed.match(/^(.*?)\s+([⇧⌘⌥⌃].+)$/);
    if (symbolicShortcut && translations.has(symbolicShortcut[1])) return value.replace(symbolicShortcut[1], translations.get(symbolicShortcut[1]));
    const resetDate = trimmed.match(/^Usage limits reset on (.+?) \((\d+) days? left\)$/);
    if (resetDate) return value.replace(trimmed, `用量限额于 ${resetDate[1]} 重置（剩余 ${resetDate[2]} 天）`);
    const resultCount = trimmed.match(/^(\d+) Results?$/);
    if (resultCount) return value.replace(trimmed, `${resultCount[1]} 项结果`);
    const submitKey = trimmed.match(/^Submit with (.+)$/);
    if (submitKey) return value.replace(trimmed, `使用 ${submitKey[1]} 提交`);
    const linkParsing = trimmed.match(/^Automatically parse links when pasted into Quick Edit \((.*?)\) input$/);
    if (linkParsing) return value.replace(trimmed, `自动解析粘贴到快速编辑（${linkParsing[1]}）输入框中的链接`);
    const partialAccept = trimmed.match(/^Accept the next word of a suggestion via (.+)$/);
    if (partialAccept) return value.replace(trimmed, `使用 ${partialAccept[1]} 接受建议中的下一个词`);
    const importLanguage = trimmed.match(/^Automatically import necessary modules for (.+)$/);
    if (importLanguage) return value.replace(trimmed, `自动为 ${importLanguage[1]} 导入所需模块`);
    const partialAcceptShortcut = trimmed.match(/^Partial Accepts keybinding: (.+)$/);
    if (partialAcceptShortcut) return value.replace(trimmed, `部分接受快捷键：${partialAcceptShortcut[1]}`);
    return value;
  }
  function translateText(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest(excluded)) return;
    const chinese = translate(node.nodeValue);
    if (chinese !== node.nodeValue) node.nodeValue = chinese;
  }
  function translateAttributes(element) {
    if (element.matches('script,style,noscript,pre,code') || element.closest('.monaco-editor,.xterm')) return;
    for (const name of attributes) {
      if (!element.hasAttribute(name)) continue;
      const value = element.getAttribute(name);
      const chinese = translate(value);
      if (chinese !== value) element.setAttribute(name, chinese);
    }
  }
  function translateEditablePlaceholders(element) {
    // ProseMirror stores its CSS placeholder on a paragraph inside contenteditable.
    // Visit presentation attributes only; never change the editor's text or value.
    if (!element.matches('[contenteditable="true"]') || element.closest('.monaco-editor,.xterm,pre,code')) return;
    for (const descendant of element.querySelectorAll('[placeholder],[data-placeholder],[aria-placeholder],[aria-description]')) translateAttributes(descendant);
  }
  function scan(node) {
    if (node.nodeType === Node.TEXT_NODE) { translateText(node); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    translateAttributes(node);
    if (node.matches(excluded)) { translateEditablePlaceholders(node); return; }
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(child) {
        if (child.nodeType === Node.ELEMENT_NODE && child.matches(excluded)) {
          translateAttributes(child);
          translateEditablePlaceholders(child);
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let child;
    while ((child = walker.nextNode())) {
      if (child.nodeType === Node.TEXT_NODE) translateText(child);
      else translateAttributes(child);
    }
  }
  const pending = new Set();
  let scheduled = false;
  function flush() {
    scheduled = false;
    const nodes = [...pending];
    pending.clear();
    // Coalesce mutation batches so updating a label does not rescan the whole app.
    for (const node of nodes) if (node.isConnected) scan(node);
  }
  function start() {
    if (!document.body) return;
    scan(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') for (const node of record.addedNodes) pending.add(node);
        else if (record.type === 'attributes') translateAttributes(record.target);
        else pending.add(record.target);
      }
      if (pending.size && !scheduled) { scheduled = true; requestAnimationFrame(flush); }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
    globalThis.__cursorAgentsZhCn = { version: '2.1.0', observer, entries: translations.size };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
/* cursor-zh-cn-local:end */
