# Pane Reader

隐私优先的本地文档阅读器扩展（Chrome / Edge / Brave）。Markdown、HTML、图片、PDF、文本、音视频都能在浏览器里直接打开阅读：零账号、零遥测、不上传任何内容。

> 不上架商店，从 GitHub Release 安装。需要手动开启一次「开发者模式」。

## 特性

- 接管 `file://` 本地 md 与 `http(s)` 上的 `.md / .markdown / .mkd / .mdx`
- 直接打开本地图片、纯文本 / 代码 / JSON、音视频时也换成阅读器界面，不用先进 md 再点文件树
- GFM：表格、任务列表、删除线、脚注、自动链接、GitHub 提示块（NOTE / TIP / IMPORTANT / WARNING / CAUTION）
- 代码高亮（18 种常用语言）+ 一键复制
- KaTeX 数学公式、Mermaid 图表，块级 / 行内
- `Cmd / Ctrl + F` 页内查找：命中高亮、计数、上一个 / 下一个
- 左侧文件目录树：同目录 Markdown 文件、子目录懒加载、当前文件高亮
- 目录树同时列出 `.html / .htm`，点击在阅读器内用 iframe 预览（不离开当前页），页面脚本和按钮照常可用，可切源码、`Esc` 关闭
- 图片 / PDF / 文本 / 音视频同样在正文区预览：图片滚轮缩放、双击复位，文本可折行，音视频带原生控制条
- 文件树支持面包屑逐级返回、上一级按钮、文件名筛选
- 右侧大纲：多级标题、滚动高亮、点击跳转
- 左右两栏都能折叠：栏内 × 收起，折叠后边缘出现展开手柄，状态跨页面记住
- 收起左侧文件树后正文自动占满腾出的左栏；右侧目录收起了也照样读
- 亮色 / 暗色 / 跟随系统，字号 13–22px 可调
- Raw 源码视图一键切换
- 图片灯箱、相对路径解析、外链新窗口
- 打印样式：直接 Cmd+P 得到干净排版
- Shadow DOM 隔离，样式不污染宿主页面，也不被宿主页面污染

## 安装

### 方式一：Release zip（推荐）

1. 从 [Releases](../../releases/latest) 下载 `pane-reader-v*.zip` 并解压
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
- 本地图片 / 文本 / 音视频同样直接双击打开即可；PDF 仍交给浏览器内置阅读器
- 在线：直接打开以 `.md` 结尾的链接
- 右上角悬浮工具栏：文件树 / 大纲 / 主题 / 字号 / 源码（鼠标移上去才完全显示）
- 文件树只在当前目录可列出时有内容：`file://` 目录和开启了 autoindex 的站点；点击目录展开，点击文件名切换
- 点文件树里的 `.md` 在原页面就地换正文（不整页刷新），地址栏、侧栏、主题和字号都保持不变；`Cmd / Ctrl / Shift` 或中键点击仍按浏览器默认在新标签页打开
- 文件树里的 `.html / .htm` 点击后在正文区以 iframe 预览，地址栏保持原 Markdown 不变；预览条上可「新标签打开」，页面里的按钮和脚本可以正常操作，`Esc` 或 × 关闭
- 图片 / PDF / 文本 / 音视频点击后也在正文区预览；预览条上带文件名、尺寸 / 行数 / 时长等元信息
- `Cmd / Ctrl + F` 打开页内查找，`Enter` / `Shift + Enter` 上下跳，`Esc` 关闭
- 面包屑和 `↑` 可向上浏览父目录，筛选框只过滤已加载的条目
- 点扩展图标可设置默认主题、字号、是否显示目录和是否列出非 Markdown 文件；两栏折叠状态各自记忆

## 开发

```bash
npm run dev        # 监听构建 content script
npm run build      # 构建到 dist/
npm run typecheck  # 类型检查
npm run test       # Playwright 冒烟测试（需先 build）
npm run package    # 打 release/*.zip
```

冒烟测试使用 Playwright 的 Chrome for Testing，覆盖在线 md、本地 `file://`、代码高亮、KaTeX、Mermaid、目录与大纲、Raw 切换、文件树与子目录懒加载、HTML / 图片 / PDF / 文本 / 音视频预览与沙箱边界、页内查找、两栏折叠与窄屏抽屉。默认路径为 `~/Library/Caches/ms-playwright/chromium-1248`，其他平台用 `CHROME_PATH` 覆盖。

## 目录结构

```
public/
  manifest.json        MV3 清单（版本由 package.json 同步）
  icons/               图标
src/
  content.ts           入口：识别 md 页面 → 读取源码 → 挂载
  background.ts        service worker：解析目录索引页（file:// 与 autoindex）、读取文本源码
  mermaid.ts           向 Mermaid 渲染页转发代码
  mermaid-frame.ts     扩展页 iframe 里的 Mermaid 渲染器
  renderer/
    markdown.ts        markdown-it + 插件 + 高亮
    ui.ts              Shadow DOM、工具栏、文件树、大纲、预览、查找、灯箱
    styles.ts          阅读样式（亮/暗/打印）
  popup/               设置面板
  shared/settings.ts   chrome.storage 读写
scripts/
  smoke.mjs            Playwright 冒烟测试
  shots.mjs            视觉截图（默认输出到 test-artifacts/shots）
  package.sh           打包 zip
  sync-version.mjs     同步版本号
docs/
  design-rules.md      视觉契约：色板、栅格、断点、动效
```

## 实现要点

- **识别**：URL 以 md 结尾，或 `Content-Type` 是 `text/markdown`，且页面 body 是单个 `<pre>`（浏览器原生纯文本视图）。不会碰已经渲染好的 HTML 页面。
- **隔离**：全部渲染进 Shadow DOM，宿主页 CSS 进不来，阅读样式也出不去。
- **安全**：`markdown-it` 的 `html: false` 关闭内嵌 HTML，输出再经 DOMPurify 清洗；CSP 只允许扩展自身脚本，不 eval、不加载远程代码。
- **文件树**：由 service worker 读取当前目录的索引页。`file://` 走 Chrome 内置目录列表（`addRow(...)` 格式），在线站点按 `<a href>` 解析；没有索引页就静默隐藏，不报错。文本类（`.md`）与页面类（`.html`）一起列出，后者带 `kind: 'html'` 标记。
- **HTML 预览**：沙箱 iframe 指向目标文件并允许脚本，按钮能点、图片与外链 CSS 照常加载。`file://` 预览额外给 `allow-same-origin`（不给的话 Chrome 会拦掉同目录资源）；在线预览不给 `allow-same-origin`，被预览页面拿不到站点 cookie 和父页面 DOM。被嵌入的页面里 content script 通过 `window.top !== window.self` 直接跳过，避免嵌套接管；源码视图由 background 用 host 权限读取文本（上限 5 MB）。
- **Mermaid**：图表在 `mermaid-frame.html`（`web_accessible_resources` 里的扩展页 iframe）渲染，content script 只通过 `postMessage` 传代码和主题，图表样式不外泄；渲染器按图类型拆成多个 chunk 按需加载，不进 `content.js`。
- **查找**：`Cmd / Ctrl + F` 在 Shadow DOM 内用 CSS Custom Highlight API 打命中标记并统计数量，不修改正文 DOM；浏览器不支持该 API 时只保留计数与滚动定位。
- **体积**：content script 单文件约 2.0 MB（KaTeX 字体全部内联为 data URI），background 约 3 KB，Mermaid 运行时按需分块。只在 md 页面注入，不影响普通网页。

## 已知限制

| 限制 | 说明 |
|---|---|
| 服务器返回 `Content-Type: text/markdown` 时 | Chrome 可能直接下载而不是展示，扩展无法接管。可改从「打开本地文件」进入 |
| 无扩展名的在线 md | 依赖 Content-Type 判断，部分站点无法识别 |
| 本地文件权限 | 必须在 `chrome://extensions` 手动开启，扩展无法自动打开 |
| 自动更新 | 手动加载的扩展不自动更新，升级需重新下载 zip 并在扩展页点刷新 |
| Firefox | 未适配。临时加载重启即失效，永久安装需要 AMO 签名 |
| 在线文件树 | 需要服务器开启目录索引（autoindex）。GitHub、语雀等不暴露目录的站点只显示正文 |
| 深层目录 | 子目录按需加载，一次最多列 500 项 |
| 页内查找 | 只覆盖 Markdown 正文，HTML 预览里交给浏览器原生查找 |
| PDF 预览 | 依赖浏览器内置 PDF 阅读器，该 iframe 不加沙箱，否则阅读器拿不到插件通道 |
| HTML 预览 | 预览不改变地址栏，刷新会回到原 Markdown；目标页带头 `X-Frame-Options` / `frame-ancestors` 时 iframe 会被浏览器拦下，改用「新标签打开」 |
| 预览里的脚本 | 沙箱允许脚本，HTML 预览里的按钮和交互可用；在线页面拿不到站点 cookie 和父页面 DOM，本地 `file://` 预览为了加载同目录资源保留了 `allow-same-origin`，只该打开自己信任的本地页面 |

## 隐私

不收集任何数据，不加载远程代码，所有解析在本地完成。网络请求只有两类，都是你自己打开的内容本身：读取当前文件所在目录的索引页（生成文件树），以及 HTML / 图片 / 音视频预览加载目标文件自带的资源（图床、CDN 等，和直接用浏览器打开该文件一样）。任何内容都不会发往第三方。

权限：`storage`（保存主题/字号）、`file:///*` 与 `http(s)` 主机权限（读取页面和同目录索引）。

## License

MIT
