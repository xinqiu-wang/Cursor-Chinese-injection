# Cursor 中文注入工具 · Windows 便携版

补充 Cursor 简体中文语言包尚未覆盖的界面文案。解压后打开窗口，点击「一键注入中文」，即可查看注入状态、阶段进度和操作日志；支持备份和还原。

适用于 Windows 10 / 11。目标电脑需要先安装官方 Cursor，使用便携包无需另外安装 Node.js 或 Python，也无需联网下载运行环境。

目前实机验证版本为 **Cursor 3.27.14**。其他版本会先检查资源结构与校验值；未来版本兼容性需要随实际更新验证，不能保证所有版本均可使用。

## 下载

- [下载 Windows 便携版 ZIP](dist/Cursor中文注入工具-Windows-便携版.zip)
- [SHA256 校验文件](dist/Cursor中文注入工具-Windows-便携版.zip.sha256.txt)
- [Gitee 仓库](https://gitee.com/soliton/cursor-chinese-injection)
- [GitHub 仓库](https://github.com/xinqiu-wang/Cursor-Chinese-injection)

请下载上方的便携版 ZIP。仓库的「下载源码 / Download ZIP」包含源码，需自行构建后才能获得窗口程序。

## 快速使用

1. 将便携版 ZIP 复制到目标电脑，**完整解压**到任意目录，也可放在 U 盘上。
2. 双击 **`CursorZhCNTool.exe`**；也可以使用「启动工具.cmd」或「启动工具.vbs」。
3. 工具会自动查找 Cursor。没有找到时，点击「选择程序」，选中实际安装目录里的 `Cursor.exe`。
4. 点击 **「一键注入中文」**，等待状态和进度显示完成。
5. 保存正在进行的工作，完全退出 Cursor 后重新打开，使中文界面生效。

工具不会强制结束正在运行的 Cursor。切勿只复制 EXE：同目录的脚本和 `payload` 文件夹都需要保留。

建议同时安装官方扩展 **Chinese (Simplified) Language Pack for Visual Studio Code**，并通过命令面板的 `Configure Display Language` 选择 `zh-cn`。本工具补充界面翻译，不负责安装语言包或设置显示语言。

## 窗口功能

| 功能 | 作用 |
| --- | --- |
| 选择程序 | 手动指定 `Cursor.exe`，支持非默认安装路径 |
| 一键注入中文 | 检查兼容性、备份原文件、注入翻译并校验结果 |
| 检查状态 | 查看所选 Cursor 的版本和当前注入状态 |
| 还原原版 | 使用当前安装、当前版本的有效备份恢复原文件 |
| 打开 Cursor | 启动当前选中的 Cursor |
| 查看备份 | 打开本机备份、清单和日志目录 |
| 删除备份 | 统计并确认后删除历史备份，保留当前版本还原所需的备份 |

进度对应实际检查、备份、语法检查、写入和校验阶段；失败时会显示错误，不会显示为注入完成。

## Cursor 更新后

便携版需要在 Cursor 更新后再次打开工具，点击「检查状态」或「一键注入中文」。**便携版本身不安装后台监控或开机任务，也不会在每次启动 Cursor 时自动注入。**

- 资源结构仍兼容：先备份新版本原文件，再重新注入已有翻译。
- 入口结构、校验方式改变，或发现未知修改：停止操作并显示原因，需要适配后再注入。
- 新版本增加的英文文案可能尚未收录，需要更新本工具的词典。

检测通过只代表通过当前兼容性检查，不等于该版本所有界面都已实机验证。

## 换电脑与备份

换电脑时只需复制便携版 ZIP 并完整解压，不需要复制原电脑的安装路径或备份数据。

备份和日志保存在目标电脑的：

```text
%USERPROFILE%\CursorZhCNPortable\<安装路径标识>\
```

每个 Cursor 安装路径使用独立的数据目录，备份按版本保存。移动便携工具文件夹不会移动或删除这些备份。工具包不包含作者电脑的日志、备份、账户信息或 Cursor 原始程序资源。

请保留本机备份，直到确定不再需要还原。还原会核对安装目录、版本和文件哈希，拒绝用另一台电脑或旧版本的记录覆盖当前安装。

点击「查看备份」会直接打开所选 Cursor 的本机数据目录；目录不存在时自动创建。尚未注入时可能只有日志，原文件备份会在注入时生成于 `backups` 子目录。

例如 `C:\Users\你的用户名\CursorZhCNPortable\<安装路径标识>\`。默认路径直接位于用户目录，不经过其他应用的缓存层级。

新版首次检查状态时，会尝试从旧版数据目录中迁移可验证的当前版本备份，并重写新清单中的备份路径。原有文件作为迁移来源保留；此后的备份、日志和清理均使用新目录。无法验证的记录不会迁移。

点击「删除备份」会先统计历史备份的数量和大小，再弹出确认框。取消不会删除任何文件。确认后仅清理未被当前备份清单引用的历史备份目录，保留当前还原所需的备份、日志和清单；如果只有当前备份，会提示没有可删除的历史备份。目录链接、未知清单或跨安装记录会停止清理，其他 Cursor 安装的数据不受影响。

## 常见问题

### 仍有英文

先确认工具显示「已注入中文」，再完全退出并重新打开 Cursor。官方语言包与本工具的补充词典覆盖范围不同，新增界面、第三方扩展、远程网页和部分动态文案仍可能显示英文；模型名称和技术标识也可能保留原文。

### 没有识别到 Cursor

点击「选择程序」，选择 `Cursor.exe`。工具会检查其相邻的 `resources/app/product.json`，不要选择快捷方式、安装包或其他程序。

### 提示拒绝访问

如果 Cursor 安装在受保护的目录，关闭工具后，右键「启动工具.cmd」，选择「以管理员身份运行」，再执行注入。普通用户可写的安装目录通常无需提升权限。

### 提示资源变化、缺少有效备份或需要适配

保留错误日志和当前文件。只有旧补丁而没有有效原文件备份时，先通过官方安装包修复或重装 Cursor，再重新注入。不要手工把旧版本的资源复制到新版本。

### 想恢复原来的界面

打开工具，选择同一个 Cursor，点击「还原原版」，完成后重启 Cursor。还原的是本工具修改的资源；如果官方语言包仍启用，编辑器仍可能显示中文，可另外调整显示语言。

## 技术说明

工具通过显示层词典翻译文字节点及提示属性，包含 Agents 首页、导航菜单、输入占位提示和部分设置页。它避免修改代码区域、聊天消息、输入框值和模型标识，不修改账户或网络配置。

注入目标为安装目录中的：

```text
resources/app/out/vs/workbench/workbench.desktop.main.js
resources/app/out/vs/workbench/workbench.glass.main.js  （存在时）
resources/app/product.json
```

注入前验证应用身份、资源入口、原文件校验值和备份哈希，并检查完整 JavaScript 语法；写入后验证结果。`product.json` 中对应资源的校验值会同步更新，工具不关闭应用完整性校验。写入出错时会尝试回滚并报告结果。

窗口使用 Windows PowerShell、WinForms 和 .NET Framework，补丁后端使用 Cursor 自带的运行环境。没有外部 npm 或 pip 依赖。

## 从源码构建

在 Windows PowerShell 中，于仓库根目录执行：

构建前请关闭输出目录里的工具窗口，避免正在运行的 EXE 被占用；也可通过 `-OutputDirectory` 指定新的输出目录。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\cursor-zh-cn\build-portable.ps1
```

构建使用系统 .NET Framework C# 编译器和 Windows PowerShell 程序集。输出为：

```text
dist/
  Cursor中文注入工具/                         解压版
    CursorZhCNTool.exe
    CursorZhCN.ps1
    启动工具.cmd
    启动工具.vbs
    使用说明.txt
    THIRD-PARTY-NOTICES.txt
    payload/
  Cursor中文注入工具-Windows-便携版.zip       分发包
  Cursor中文注入工具-Windows-便携版.zip.sha256.txt
```

ZIP 按文件白名单打包，不会将目录内额外的备份和日志自动带入分发包。

### 验证

开发测试需要 Node.js 20 或更新版本。先完成构建，再执行：

```powershell
node .\cursor-zh-cn\overlay.test.cjs
node --test .\cursor-zh-cn\portable.test.cjs
```

测试覆盖受保护内容、界面翻译回归、中文及空格路径、复制工具目录、备份还原、跨安装记录拒绝、兼容性失败和进度事件。测试使用临时模拟安装，不会修改实际 Cursor。模拟测试不替代真实的新版本或第二台电脑实机验证。

解压版同时支持无窗口命令行操作，路径请换成目标电脑的实际路径：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\dist\Cursor中文注入工具\CursorZhCN.ps1" -Headless -Action status -CursorPath "C:\Apps\Cursor\Cursor.exe"
```

`-Action` 可选 `status`、`apply`、`restore`、`cleanup-preview`、`cleanup`；省略 `-StateDirectory` 时使用正常的本机数据目录。命令行的 `cleanup` 会直接执行历史备份清理，不弹出窗口确认，建议先用 `cleanup-preview` 查看统计。

### 主要源码

| 文件 | 用途 |
| --- | --- |
| `cursor-zh-cn/portable/Launcher.cs` | 无控制台窗口入口 |
| `cursor-zh-cn/portable/CursorZhCN.ps1` | 安装检测、窗口、状态、进度和日志 |
| `cursor-zh-cn/portable-runner.cjs` | 操作协议、并发锁和备份归属检查 |
| `cursor-zh-cn/patch.cjs` | 备份、注入、校验和还原 |
| `cursor-zh-cn/compatibility.cjs` | 应用身份与资源结构检查 |
| `cursor-zh-cn/backup-cleanup.cjs` | 历史备份统计、当前备份保留与删除路径检查 |
| `cursor-zh-cn/agents-overlay.js` | 显示层翻译与受保护内容过滤 |
| `cursor-zh-cn/translations-extra.json` | 补充界面词典 |
| `cursor-zh-cn/translations-languagepack.json` | 从官方语言包提取的翻译词典 |

## 第三方声明

这是独立的本地界面补丁项目，与 Cursor 官方无隶属关系。

部分词典来自 Microsoft 的 `MS-CEINTL.vscode-language-pack-zh-hans` 1.128.0 / [vscode-loc](https://github.com/Microsoft/vscode-loc)。版权与 MIT 许可全文见 [THIRD-PARTY-NOTICES.txt](cursor-zh-cn/portable/THIRD-PARTY-NOTICES.txt)，便携包内也附有相同声明。
