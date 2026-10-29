# Markdown Reader

隐私优先的 Markdown 阅读器扩展（Chrome / Edge / Brave）。本地和在线 `.md` 直接渲染成可读页面：零账号、零遥测、不发起任何网络请求。

> 不上架商店，从 GitHub Release 安装。需要手动开启一次「开发者模式」。

## 特性

- 接管 `file://` 本地 md 与 `http(s)` 上的 `.md / .markdown / .mkd / .mdx`
- GFM：表格、任务列表、删除线、脚注、自动链接
- 代码高亮（18 种常用语言）+ 一键复制
- KaTeX 数学公式、块级 / 行内
- 左侧文件目录树：同目录 Markdown 文件、子目录懒加载、当前文件高亮
- 文件树支持面包屑逐级返回、上一级按钮、文件名筛选
- 右侧大纲：多级标题、滚动高亮、点击跳转
- 亮色 / 暗色 / 跟随系统，字号 13–22px 可调
- Raw 源码视图一键切换
- 图片灯箱、相对路径解析、外链新窗口
- 打印样式：直接 Cmd+P 得到干净排版
- Shadow DOM 隔离，样式不污染宿主页面，也不被宿主页面污染

## 安装

### 方式一：Release zip（推荐）

1. 从 [Releases](../../releases/latest) 下载 `markdown-reader-v*.zip` 并解压
2. 打开 `chrome://extensions`（Edge 是 `edge://extensions`），打开右上角「开发者模式」
3. 点「加载已解压的扩展程序」，选择**解压后直接包含 `manifest.json` 的那层目录**
4. 点扩展的「详情」，把「允许访问文件网址」打开，否则打不开本地 md

### 方式二：从源码构建

```bash
npm install
npm run build
# 然后按上面第 2–4 步加载 dist/ 目录
```

## 使用

- 本地：双击或拖拽 `.md` 文件到浏览器，或在地址栏输入 `file:///path/to/file.md`
- 在线：直接打开以 `.md` 结尾的链接
- 右上角悬浮工具栏：文件树 / 大纲 / 主题 / 字号 / 源码（鼠标移上去才完全显示）
- 文件树只在当前目录可列出时有内容：`file://` 目录和开启了 autoindex 的站点；点击目录展开，点击文件名切换
- 面包屑和 `↑` 可向上浏览父目录，筛选框只过滤已加载的条目
- 点扩展图标可设置默认主题、字号和是否显示目录

## 开发

```bash
npm run dev        # 监听构建 content script
npm run build      # 构建到 dist/
npm run typecheck  # 类型检查
npm run test       # Playwright 冒烟测试（需先 build）
npm run package    # 打 release/*.zip
```

冒烟测试使用 Playwright 的 Chrome for Testing，验证在线 md、本地 file://、代码高亮、KaTeX、目录、Raw 切换、文件树与子目录懒加载。默认路径为 `~/Library/Caches/ms-playwright/chromium-1248`，其他平台用 `CHROME_PATH` 覆盖。

## 目录结构

```
public/
  manifest.json        MV3 清单（版本由 package.json 同步）
  icons/               图标
src/
  content.ts           入口：识别 md 页面 → 读取源码 → 挂载
  background.ts        service worker：解析目录索引页（file:// 与 autoindex）
  renderer/
    markdown.ts        markdown-it + 插件 + 高亮
    ui.ts              Shadow DOM、工具栏、目录、灯箱
    styles.ts          阅读样式（亮/暗/打印）
  popup/               设置面板
  shared/settings.ts   chrome.storage 读写
scripts/
  smoke.mjs            Playwright 冒烟测试
  package.sh           打包 zip
  sync-version.mjs     同步版本号
```

## 实现要点

- **识别**：URL 以 md 结尾，或 `Content-Type` 是 `text/markdown`，且页面 body 是单个 `<pre>`（浏览器原生纯文本视图）。不会碰已经渲染好的 HTML 页面。
- **隔离**：全部渲染进 Shadow DOM，宿主页 CSS 进不来，阅读样式也出不去。
- **安全**：`markdown-it` 的 `html: false` 关闭内嵌 HTML，输出再经 DOMPurify 清洗；CSP 只允许扩展自身脚本，不 eval、不加载远程代码。
- **文件树**：由 service worker 读取当前目录的索引页。`file://` 走 Chrome 内置目录列表（`addRow(...)` 格式），在线站点按 `<a href>` 解析；没有索引页就静默隐藏，不报错。
- **体积**：content script 单文件约 1.9 MB（KaTeX 字体全部内联为 data URI），background 约 1.4 KB。只在 md 页面注入，不影响普通网页。

## 已知限制

| 限制 | 说明 |
|---|---|
| 服务器返回 `Content-Type: text/markdown` 时 | Chrome 可能直接下载而不是展示，扩展无法接管。可改从「打开本地文件」进入 |
| 无扩展名的在线 md | 依赖 Content-Type 判断，部分站点无法识别 |
| 本地文件权限 | 必须在 `chrome://extensions` 手动开启，扩展无法自动打开 |
| 自动更新 | 手动加载的扩展不自动更新，升级需重新下载 zip 并在扩展页点刷新 |
| Firefox | 未适配。临时加载重启即失效，永久安装需要 AMO 签名 |
| Mermaid | 暂未内置，代码块会按普通代码高亮显示 |
| 在线文件树 | 需要服务器开启目录索引（autoindex）。GitHub、语雀等不暴露目录的站点只显示正文 |
| 深层目录 | 子目录按需加载，一次最多列 500 项 |

## 隐私

不收集任何数据，不加载远程代码，所有解析在本地完成。唯一的网络请求是读取当前文件所在目录的索引页，用于生成文件树，不会把任何内容发往第三方。

权限：`storage`（保存主题/字号）、`file:///*` 与 `http(s)` 主机权限（读取页面和同目录索引）。

## License

MIT
