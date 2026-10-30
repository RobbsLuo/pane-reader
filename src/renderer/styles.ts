/** Shadow DOM 内的全部样式，不污染宿主页面 */
export const readerCss = /* css */ `
:host {
  all: initial;
  scrollbar-width: thin;
}

/* 视觉基调：灰色框架 + 白色纸面。深度只靠一档色阶，静止元素不投影 */
.mr-root {
  --mr-bg: #f4f4f1; /* 框架（工具栏 / 侧栏）底色 */
  --mr-surface: #ffffff; /* 正文纸面 */
  --mr-fg: #16181a;
  --mr-muted: #5d5f60;
  --mr-border: #e6e5df;
  --mr-rule: #efeeea;
  --mr-control: #cdced1;
  --mr-accent: #1b6c80;
  --mr-tip: #1e7b4f;
  --mr-warning: #92400e;
  --mr-caution: #b42318;
  --mr-code-bg: #f6f6f3;
  --mr-inline-code-bg: #f1f1ec;
  --mr-hover-bg: #e9e9e3;
  --mr-quote-bg: transparent;
  --mr-mark-bg: color-mix(in srgb, #1b6c80 18%, transparent);
  --mr-shadow: 0 18px 40px -26px rgba(18, 20, 20, 0.42);
  --mr-files-w: 264px;
  /* 文件树类型图标：色相区分类型，明度压住不抢正文 */
  --mr-kind-dir: #a8752a;
  --mr-kind-md: #1b6c80;
  --mr-kind-html: #c2621b;
  --mr-kind-image: #2b8a5f;
  --mr-kind-pdf: #cc3d3d;
  --mr-kind-text: #6d5bd0;
  --mr-kind-media: #c2457f;
  --mr-font-size: 16px;
  --mr-bar-h: 48px;
  --mr-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;

  box-sizing: border-box;
  min-height: 100%;
  background: var(--mr-bg);
  color: var(--mr-fg);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI",
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: var(--mr-font-size);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.mr-root[data-theme='dark'] {
  --mr-bg: #121313;
  --mr-surface: #191a1a;
  --mr-fg: #ececec;
  --mr-muted: #a2a4a4;
  --mr-border: #2c2e2e;
  --mr-rule: #252727;
  --mr-control: #3c3f3f;
  --mr-accent: #6fc0d0;
  --mr-tip: #6fd39a;
  --mr-warning: #e0a34a;
  --mr-caution: #ff9b90;
  --mr-code-bg: #212323;
  --mr-inline-code-bg: #2a2c2c;
  --mr-hover-bg: #262828;
  --mr-quote-bg: transparent;
  --mr-mark-bg: color-mix(in srgb, #6fc0d0 24%, transparent);
  --mr-shadow: 0 18px 40px -26px rgba(0, 0, 0, 0.7);
  /* 暗色下整体提亮，保住同样的类型区分度 */
  --mr-kind-dir: #d9a85f;
  --mr-kind-md: #8fd0dd;
  --mr-kind-html: #f09a5c;
  --mr-kind-image: #6fd39a;
  --mr-kind-pdf: #ff8b8b;
  --mr-kind-text: #b3a4ff;
  --mr-kind-media: #f28fbb;
}

.mr-root *,
.mr-root *::before,
.mr-root *::after {
  box-sizing: border-box;
}

/* 切换文件时淡出，掩盖整页导航的重绘 */
.mr-root.is-leaving {
  opacity: 0;
  transition: opacity 90ms ease-out;
}

/* ---------- 布局 ---------- */
/* 三列：左文件树 / 白纸正文 / 右目录。正文吃掉两侧栏以外的全部宽度 */
.mr-layout {
  display: grid;
  grid-template-columns: var(--mr-files-w) minmax(0, 1fr) 192px;
  align-items: start;
  gap: 32px;
  max-width: none;
  margin: 0 auto;
  padding: calc(var(--mr-bar-h) + 16px) 20px 24px;
}

/* 正文是一张独立白纸：一档色阶 + 1px 边，无阴影 */
.mr-article {
  grid-column: 2;
  width: 100%;
  min-width: 0;
  max-width: none;
  justify-self: stretch;
  padding: 56px clamp(24px, 3.2vw, 40px) 72px;
  border: 1px solid var(--mr-border);
  border-radius: 16px;
  background: var(--mr-surface);
}

/* 正文不再限制行长，段落随纸面宽度铺满；代码、表格、图片同样吃满 */
.mr-article :is(p, ul, ol, blockquote) {
  max-width: none;
}

.mr-source {
  grid-column: 2;
  width: 100%;
  min-width: 0;
}

/* 窄屏抽屉的遮罩：默认不占位，抽屉打开时由媒体查询点亮 */
.mr-scrim {
  position: fixed;
  inset: 0;
  z-index: 9;
  display: none;
  background: rgba(16, 24, 40, 0.32);
}

/* 被省略号截断的文件名 / 目录名，悬停时补出完整文字 */
.mr-tip {
  position: fixed;
  z-index: 30;
  max-width: min(440px, calc(100vw - 32px));
  padding: 6px 9px;
  border: 1px solid var(--mr-border);
  border-radius: 7px;
  background: var(--mr-bg);
  box-shadow: var(--mr-shadow);
  color: var(--mr-fg);
  font-size: 12.5px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  pointer-events: none;
}

.mr-tip[hidden] {
  display: none;
}

/* ---------- 文件预览（HTML / PDF / 图片 / 文本 / 音视频） ---------- */
/* 占满正文列并吃掉隐藏后的目录列，高度贴着视口走 */
.mr-preview {
  grid-column: 2 / -1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: calc(100vh - var(--mr-bar-h) - 64px);
  min-height: 360px;
  border: 1px solid var(--mr-border);
  border-radius: 16px;
  background: var(--mr-surface);
  overflow: hidden;
}

.mr-preview[hidden] {
  display: none;
}

.mr-root.is-preview .mr-layout {
  padding-bottom: 28px;
}

.mr-preview-bar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;
  padding: 5px 8px 5px 12px;
  border-bottom: 1px solid var(--mr-border);
  background: var(--mr-code-bg);
  color: var(--mr-muted);
  font-size: 12px;
  line-height: 1.7;
}

.mr-preview-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--mr-fg);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.mr-preview-meta {
  flex: none;
  color: var(--mr-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.mr-preview-meta:empty {
  display: none;
}

.mr-preview-wrap {
  flex: none;
  padding: 1px 8px;
  border: 1px solid var(--mr-border);
  border-radius: 5px;
  background: transparent;
  color: var(--mr-muted);
  font: inherit;
  cursor: pointer;
}

.mr-preview-wrap[aria-pressed='true'] {
  border-color: var(--mr-accent);
  color: var(--mr-accent);
}

.mr-preview-wrap[hidden] {
  display: none;
}

.mr-preview-open {
  flex: none;
  color: var(--mr-accent);
  text-decoration: none;
}

.mr-preview-open:hover {
  text-decoration: underline;
}

/* 预览舞台：HTML / PDF / 图片 / 文本 / 音视频共用，内部绝对定位铺满 */
.mr-preview-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--mr-bg);
}

.mr-preview-stage > * {
  position: absolute;
  inset: 0;
}

.mr-preview-stage > [hidden] {
  display: none;
}

.mr-preview-frame {
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}

/* 图片：默认适应窗口，滚轮缩放、拖动平移、双击复位 */
.mr-image-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--mr-code-bg);
  cursor: zoom-in;
  touch-action: none;
}

.mr-image-wrap.is-zoomed {
  cursor: grab;
}

.mr-image-wrap.is-dragging {
  cursor: grabbing;
}

.mr-preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transform-origin: center;
  user-select: none;
  will-change: transform;
}

.mr-preview-text {
  margin: 0;
  padding: 16px 20px;
  overflow: auto;
  background: var(--mr-bg);
  color: var(--mr-fg);
  font: 13px/1.6 var(--mr-mono);
  tab-size: 2;
  white-space: pre;
}

.mr-preview-text.is-wrap {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.mr-media-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--mr-code-bg);
}

.mr-media {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
}

audio.mr-media {
  width: min(520px, 100%);
}

/* ---------- 折叠后回收空间 ---------- */
/* 只在宽屏生效：窄屏目录本身就是 display:none、文件树是抽屉，
   这些 :has 规则会凭空多出一列，把正文压成窄条 */
@media (min-width: 1001px) {
  /* 右侧目录收起后，正文吃掉腾出的右列 */
  .mr-layout:has(.mr-toc[hidden]) {
    grid-template-columns: var(--mr-files-w) minmax(0, 1fr);
  }

  /* 两侧都收起 → 单列满宽 */
  .mr-layout:has(.mr-sidebar[hidden]):has(.mr-toc[hidden]) {
    grid-template-columns: minmax(0, 1fr);
  }

  .mr-layout:has(.mr-sidebar[hidden]):has(.mr-toc[hidden]) .mr-article,
  .mr-layout:has(.mr-sidebar[hidden]):has(.mr-toc[hidden]) .mr-source {
    grid-column: 1;
  }

  /* 左侧文件树收起后，正文 / 源码 / 预览改用腾出的左列，右侧目录留在原列 */
  .mr-layout:has(.mr-sidebar[hidden]) {
    grid-template-columns: minmax(0, 1fr) 192px;
  }

  .mr-layout:has(.mr-sidebar[hidden]) .mr-article {
    grid-column: 1;
  }

  .mr-layout:has(.mr-sidebar[hidden]) .mr-source {
    grid-column: 1;
    max-width: none;
    justify-self: stretch;
  }

  .mr-layout:has(.mr-sidebar[hidden]) .mr-toc {
    grid-column: 2;
  }

  .mr-layout:has(.mr-sidebar[hidden]) .mr-preview {
    grid-column: 1 / -1;
  }
}

/* ---------- 工具栏（顶栏） ---------- */
/* 一条平铺的工具栏：产品名 + 当前文件 + 右侧操作，不做悬浮胶囊 */
.mr-toolbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 2px;
  height: var(--mr-bar-h);
  padding: 0 12px;
  border-bottom: 1px solid var(--mr-border);
  background: var(--mr-bg);
}

.mr-brand {
  display: grid;
  place-items: center;
  flex: none;
  width: 26px;
  height: 26px;
  margin-right: 10px;
  border: 1px solid var(--mr-control);
  border-radius: 7px;
  color: var(--mr-fg);
  font-family: var(--mr-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.mr-toolbar-name {
  flex: none;
  color: var(--mr-fg);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.mr-toolbar-doc {
  min-width: 0;
  margin-left: 10px;
  overflow: hidden;
  color: var(--mr-muted);
  font-family: var(--mr-mono);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mr-toolbar-doc::before {
  content: '/';
  margin-right: 10px;
  color: var(--mr-control);
}

.mr-toolbar-doc:empty {
  display: none;
}

.mr-toolbar-spacer {
  flex: 1;
}

.mr-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: none;
  min-width: 30px;
  height: 30px;
  padding: 0 7px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--mr-muted);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

/* 站内搜索：浮在顶栏下方，只有它允许带投影 */
.mr-find {
  position: fixed;
  top: calc(var(--mr-bar-h) + 12px);
  left: 50%;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px 5px 10px;
  border: 1px solid var(--mr-border);
  border-radius: 10px;
  background: var(--mr-surface);
  box-shadow: var(--mr-shadow);
  transform: translateX(-50%);
}

.mr-find[hidden] {
  display: none;
}

.mr-find-input {
  width: 168px;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--mr-fg);
  font: inherit;
  font-size: 13px;
}

.mr-find-count {
  min-width: 44px;
  color: var(--mr-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.mr-find button {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--mr-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.mr-find button:hover {
  background: var(--mr-inline-code-bg);
  color: var(--mr-fg);
}

::highlight(mr-find) {
  background: rgba(255, 176, 46, 0.38);
  color: inherit;
}

::highlight(mr-find-current) {
  background: #ff9f0a;
  color: #1a1a1a;
}

.mr-toolbar button:hover {
  background: var(--mr-hover-bg);
  color: var(--mr-fg);
}

.mr-toolbar button[aria-pressed='true'] {
  color: var(--mr-accent);
  background: color-mix(in srgb, var(--mr-accent) 12%, transparent);
}

.mr-toolbar button:disabled {
  opacity: 0.35;
  cursor: default;
  background: transparent;
}

.mr-toolbar svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mr-toolbar .mr-sep {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--mr-border);
}

/* 键盘焦点统一可见 */
.mr-toolbar button:focus-visible,
.mr-panel-close:focus-visible,
.mr-collapse:focus-visible,
.mr-rail:focus-visible,
.mr-up:focus-visible,
.mr-crumb:focus-visible,
.mr-node-name:focus-visible,
.mr-filter:focus-visible,
.mr-toc a:focus-visible,
.mr-find button:focus-visible,
.mr-find-input:focus-visible,
.mr-copy:focus-visible {
  outline: 2px solid var(--mr-accent);
  outline-offset: 2px;
}

/* 面板展开的入场动画 */
@keyframes mr-panel-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.mr-sidebar:not([hidden]),
.mr-toc:not([hidden]) {
  animation: mr-panel-in 0.18s ease both;
}

/* 折叠后贴边的展开手柄 */
.mr-rail {
  position: fixed;
  top: 50%;
  z-index: 4;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 64px;
  padding: 0;
  border: 1px solid var(--mr-border);
  border-radius: 999px;
  background: var(--mr-bg);
  color: var(--mr-muted);
  box-shadow: 0 2px 10px -2px color-mix(in srgb, #000 24%, transparent);
  cursor: pointer;
  opacity: 0.9;
  transform: translateY(-50%);
  transition: opacity 0.15s ease, color 0.15s ease, border-color 0.15s ease,
    box-shadow 0.15s ease, left 0.15s ease, right 0.15s ease;
}

/* 命中区比视觉大一圈，边缘也好点 */
.mr-rail::before {
  content: '';
  position: absolute;
  inset: -10px -10px;
}

.mr-rail:not([hidden]) {
  display: inline-flex;
}

.mr-rail-left {
  left: 6px;
}

.mr-rail-right {
  right: 6px;
}

.mr-rail:hover {
  border-color: var(--mr-accent);
  background: var(--mr-bg);
  color: var(--mr-accent);
  opacity: 1;
  box-shadow: 0 3px 16px -2px color-mix(in srgb, #000 32%, transparent);
}

.mr-rail-left:hover {
  left: 2px;
}

.mr-rail-right:hover {
  right: 2px;
}

.mr-rail:focus-visible {
  opacity: 1;
  outline: 2px solid var(--mr-accent);
  outline-offset: 2px;
}

.mr-rail svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 侧栏内部滚动条 */
.mr-sidebar::-webkit-scrollbar,
.mr-toc::-webkit-scrollbar {
  width: 8px;
}

.mr-sidebar::-webkit-scrollbar-thumb,
.mr-toc::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 8px;
  background: var(--mr-border);
  background-clip: content-box;
}

.mr-sidebar::-webkit-scrollbar-thumb:hover,
.mr-toc::-webkit-scrollbar-thumb:hover {
  background-color: var(--mr-muted);
}

/* ---------- 排版 ---------- */
/* 正文纸面的行高独立于 UI；行长随可用宽度铺满 */

.mr-article {
  font-size: var(--mr-font-size);
  line-height: 1.8;
}

.mr-article > :first-child {
  margin-top: 0;
}

.mr-article h1,
.mr-article h2,
.mr-article h3,
.mr-article h4,
.mr-article h5,
.mr-article h6 {
  position: relative;
  margin: 2.4em 0 0.6em;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.015em;
  text-wrap: balance;
  scroll-margin-top: calc(var(--mr-bar-h) + 24px);
}

.mr-article h1 {
  margin-top: 0;
  max-width: 26em;
  font-size: 2.1em;
  letter-spacing: -0.026em;
}

.mr-article h2 {
  margin-top: 2.6em;
  font-size: 1.42em;
  letter-spacing: -0.018em;
}

.mr-article h3 {
  margin-top: 2.1em;
  font-size: 1.16em;
}

.mr-article h4 {
  font-size: 1em;
}

.mr-article h5,
.mr-article h6 {
  color: var(--mr-muted);
  font-size: 0.94em;
}

.mr-article p,
.mr-article ul,
.mr-article ol,
.mr-article blockquote,
.mr-article pre {
  margin: 0 0 1.35em;
}

.mr-article p {
  text-wrap: pretty;
}

/* 链接靠下划线定位，颜色只做一个轻微的偏移 */
.mr-article a {
  color: var(--mr-accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, var(--mr-accent) 38%, transparent);
  text-underline-offset: 0.16em;
}

.mr-article a:hover {
  text-decoration-color: currentColor;
}

.mr-article ul,
.mr-article ol {
  padding-left: 1.5em;
}

.mr-article li + li {
  margin-top: 0.4em;
}

.mr-article li::marker {
  color: var(--mr-muted);
}

.mr-article li > ul,
.mr-article li > ol {
  margin: 0.3em 0 0;
}

.mr-article blockquote {
  margin: 1.8em 0;
  padding: 0 0 0 1.15em;
  border-left: 2px solid color-mix(in srgb, var(--mr-fg) 22%, transparent);
  background: transparent;
  color: var(--mr-muted);
}

.mr-article blockquote > :last-child {
  margin-bottom: 0;
}

/* GitHub 提示块：> [!NOTE] 之类，类型由 data-alert 决定 */
.mr-article blockquote.mr-alert {
  --mr-alert-fg: var(--mr-accent);
  margin: 1.8em 0;
  padding: 14px 16px 14px 18px;
  border: 1px solid var(--mr-border);
  border-left: 3px solid var(--mr-alert-fg);
  border-radius: 0 10px 10px 0;
  background: var(--mr-code-bg);
  color: var(--mr-fg);
}

.mr-article blockquote.mr-alert::before {
  display: block;
  margin-bottom: 0.35em;
  color: var(--mr-alert-fg);
  font-size: 0.75em;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.4;
}

.mr-article blockquote.mr-alert[data-alert='note']::before {
  content: 'NOTE';
}

.mr-article blockquote.mr-alert[data-alert='tip'] {
  --mr-alert-fg: var(--mr-tip);
}

.mr-article blockquote.mr-alert[data-alert='tip']::before {
  content: 'TIP';
}

.mr-article blockquote.mr-alert[data-alert='important'] {
  --mr-alert-fg: var(--mr-fg);
}

.mr-article blockquote.mr-alert[data-alert='important']::before {
  content: 'IMPORTANT';
}

.mr-article blockquote.mr-alert[data-alert='warning'] {
  --mr-alert-fg: var(--mr-warning);
}

.mr-article blockquote.mr-alert[data-alert='warning']::before {
  content: 'WARNING';
}

.mr-article blockquote.mr-alert[data-alert='caution'] {
  --mr-alert-fg: var(--mr-caution);
}

.mr-article blockquote.mr-alert[data-alert='caution']::before {
  content: 'CAUTION';
}

/* front matter：折起的信息卡，和正文区分开 */
.mr-meta {
  margin: 0 0 2.4em;
  border: 1px solid var(--mr-border);
  border-radius: 10px;
  background: var(--mr-code-bg);
  font-size: 0.86em;
  line-height: 1.65;
}

.mr-meta summary {
  padding: 10px 14px;
  color: var(--mr-muted);
  font-weight: 500;
  cursor: pointer;
}

.mr-meta summary:hover {
  color: var(--mr-fg);
}

.mr-meta dl {
  display: grid;
  grid-template-columns: minmax(6em, auto) 1fr;
  gap: 0.4em 1.2em;
  margin: 0;
  padding: 0 14px 14px;
}

.mr-meta dt {
  color: var(--mr-muted);
  white-space: nowrap;
}

.mr-meta dd {
  margin: 0;
  word-break: break-word;
}

.mr-article hr {
  height: 0;
  margin: 3em 0;
  border: 0;
  border-top: 1px solid var(--mr-border);
}

.mr-article mark {
  padding: 0.05em 0.2em;
  border-radius: 3px;
  background: var(--mr-mark-bg);
  color: inherit;
}

/* 行内代码 */
.mr-article :not(pre) > code {
  padding: 0.12em 0.36em;
  border-radius: 5px;
  background: var(--mr-inline-code-bg);
  font-family: var(--mr-mono);
  font-size: 0.87em;
  word-break: break-word;
}

/* 代码块 */
.mr-article pre {
  position: relative;
  overflow: auto;
  padding: 16px 18px;
  border: 1px solid var(--mr-border);
  border-radius: 8px;
  background: var(--mr-code-bg);
  font-size: 0.86em;
  line-height: 1.72;
  tab-size: 2;
}

.mr-article pre code {
  display: block;
  background: transparent;
  font-family: var(--mr-mono);
  white-space: pre;
}

.mr-mermaid {
  margin: 1.8em 0;
  padding: 16px 14px;
  border: 1px solid var(--mr-border);
  border-radius: 10px;
  background: var(--mr-surface);
  overflow-x: auto;
  text-align: center;
}

.mr-mermaid.is-loading {
  min-height: 84px;
}

.mr-mermaid.is-loading::after {
  content: '正在绘制图表…';
  color: var(--mr-muted);
  font-size: 13px;
}

.mr-mermaid svg {
  max-width: 100%;
  height: auto;
}

.mr-mermaid.is-error {
  border-color: color-mix(in srgb, var(--mr-caution) 45%, var(--mr-border));
  color: var(--mr-caution);
  font-family: var(--mr-mono);
  font-size: 13px;
  text-align: left;
}

.mr-copy {
  position: absolute;
  top: 8px;
  right: 10px;
  padding: 3px 7px;
  border: 1px solid var(--mr-border);
  border-radius: 6px;
  background: var(--mr-surface);
  color: var(--mr-muted);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
}

.mr-article pre:hover .mr-copy,
.mr-copy:focus-visible {
  opacity: 1;
}

.mr-copy:hover {
  color: var(--mr-fg);
}

/* 表格：不画格子，只留横向分隔与表头字重 */
.mr-table {
  margin: 0 0 1.6em;
  overflow-x: auto;
}

.mr-article table {
  /* 短表也铺满纸面；列多到超出时由 .mr-table 横向滚动，不压缩内容 */
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92em;
  font-variant-numeric: tabular-nums;
}

.mr-article th,
.mr-article td {
  padding: 9px 18px 9px 0;
  border: 0;
  border-bottom: 1px solid var(--mr-rule);
  text-align: left;
  vertical-align: top;
}

.mr-article th:first-child,
.mr-article td:first-child {
  padding-left: 2px;
}

.mr-article th:last-child,
.mr-article td:last-child {
  padding-right: 2px;
}

.mr-article th {
  padding-top: 0;
  border-bottom-color: var(--mr-border);
  color: var(--mr-muted);
  font-weight: 600;
  white-space: nowrap;
}

.mr-article tbody tr:last-child td {
  border-bottom: 0;
}

.mr-article tbody tr:hover td {
  background: var(--mr-code-bg);
}

/* 任务列表 */
.mr-article .task-list-item {
  list-style: none;
}

.mr-article .task-list-item input {
  display: inline-grid;
  place-content: center;
  width: 15px;
  height: 15px;
  margin: 0 0.55em 0 -1.45em;
  border: 1.5px solid var(--mr-control);
  border-radius: 4px;
  outline: none;
  background: var(--mr-surface);
  vertical-align: -2px;
  appearance: none;
  cursor: default;
}

.mr-article .task-list-item input:checked {
  border-color: var(--mr-accent);
  background: var(--mr-accent);
}

.mr-article .task-list-item input:checked::after {
  content: '';
  width: 8px;
  height: 4.5px;
  border-left: 1.8px solid #fff;
  border-bottom: 1.8px solid #fff;
  transform: rotate(-45deg) translate(0.5px, -1px);
}

/* 图片 */
.mr-article img {
  display: block;
  max-width: 100%;
  height: auto;
  border: 1px solid var(--mr-rule);
  border-radius: 6px;
  cursor: zoom-in;
}

/* 脚注 */
.mr-article .footnotes {
  margin-top: 4em;
  padding-top: 1.6em;
  border-top: 1px solid var(--mr-border);
  color: var(--mr-muted);
  font-size: 0.88em;
  line-height: 1.7;
}

/* ---------- 源码视图 ---------- */
.mr-source {
  margin: 0;
  padding: 48px clamp(24px, 3.2vw, 40px) 64px;
  border: 1px solid var(--mr-border);
  border-radius: 16px;
  background: var(--mr-surface);
  color: var(--mr-muted);
  font-family: var(--mr-mono);
  font-size: 0.82em;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  tab-size: 2;
}

.mr-source[hidden],
.mr-article[hidden] {
  display: none;
}

/* ---------- 左侧文件树 ---------- */
.mr-sidebar {
  position: sticky;
  top: calc(var(--mr-bar-h) + 16px);
  grid-column: 1;
  justify-self: start;
  align-self: start;
  width: var(--mr-files-w);
  max-height: calc(100vh - var(--mr-bar-h) - 36px);
  padding-bottom: 24px;
  overflow-x: hidden;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.5;
  scrollbar-width: thin;
}

.mr-sidebar[hidden] {
  display: none;
}

.mr-sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  padding: 0 4px;
}

.mr-up {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--mr-muted);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}

.mr-up:hover {
  background: var(--mr-hover-bg);
  color: var(--mr-fg);
}

.mr-up[hidden] {
  display: none;
}

.mr-filter {
  box-sizing: border-box;
  width: 100%;
  height: 30px;
  margin: 0 0 10px;
  padding: 0 9px;
  border: 1px solid var(--mr-border);
  border-radius: 7px;
  outline: none;
  background: var(--mr-surface);
  color: var(--mr-fg);
  font: inherit;
  font-size: 12.5px;
  appearance: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.mr-filter::placeholder {
  color: var(--mr-muted);
}

.mr-filter:focus {
  border-color: var(--mr-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--mr-accent) 14%, transparent);
}

.mr-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  margin-bottom: 8px;
  padding: 0 2px;
  color: var(--mr-muted);
  font-size: 11.5px;
}

.mr-crumb {
  max-width: 92px;
  overflow: hidden;
  padding: 1px 3px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--mr-muted);
  font: inherit;
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.mr-crumb:hover {
  background: var(--mr-hover-bg);
  color: var(--mr-fg);
}

.mr-crumb.is-current {
  color: var(--mr-fg);
  font-weight: 600;
  cursor: default;
}

.mr-crumb-sep,
.mr-crumb-gap {
  opacity: 0.5;
}

.mr-sidebar-title {
  flex: 1;
  overflow: hidden;
  color: var(--mr-fg);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mr-panel-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--mr-muted);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}

.mr-panel-close:hover {
  background: var(--mr-inline-code-bg);
  color: var(--mr-fg);
}

/* 栏头折叠按钮 */
.mr-collapse {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--mr-muted);
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease, border-color 0.14s ease;
}

.mr-collapse:hover {
  border-color: var(--mr-border);
  background: var(--mr-inline-code-bg);
  color: var(--mr-fg);
}

.mr-collapse svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.mr-tree {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mr-node {
  min-width: 0;
}

.mr-node-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px 5px 0;
  border-radius: 7px;
  cursor: default;
  transition: background 0.12s ease, color 0.12s ease;
}

.mr-node-row:hover {
  background: var(--mr-hover-bg);
}

.mr-node-name {
  flex: 1;
  overflow: hidden;
  color: var(--mr-fg);
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mr-node-row:hover .mr-node-name {
  color: var(--mr-fg);
}

.mr-node.is-current > .mr-node-row {
  background: color-mix(in srgb, var(--mr-accent) 12%, transparent);
}

.mr-node.is-current > .mr-node-row .mr-node-name {
  color: var(--mr-accent);
  font-weight: 600;
}

.mr-caret,
.mr-caret-spacer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
}

.mr-caret {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--mr-muted);
  line-height: 1;
  cursor: pointer;
  transition: transform 0.15s ease, color 0.15s ease;
}

.mr-caret svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mr-caret:hover {
  color: var(--mr-fg);
}

.mr-node.open > .mr-node-row .mr-caret {
  transform: rotate(90deg);
}

.mr-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  color: var(--mr-icon-color, var(--mr-muted));
}

.mr-icon svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 按文件类型上色：形状之外再给一层色相，扫一眼就能分开 */
.mr-node[data-type='dir'] > .mr-node-row .mr-icon {
  --mr-icon-color: var(--mr-kind-dir);
}

/* Markdown 没有 data-kind，用「无 kind 的文件」兜底 */
.mr-node[data-type='file'] > .mr-node-row .mr-icon:not([data-kind]) {
  --mr-icon-color: var(--mr-kind-md);
}

.mr-icon[data-kind='html'] {
  --mr-icon-color: var(--mr-kind-html);
}

.mr-icon[data-kind='image'] {
  --mr-icon-color: var(--mr-kind-image);
}

.mr-icon[data-kind='pdf'] {
  --mr-icon-color: var(--mr-kind-pdf);
}

.mr-icon[data-kind='text'] {
  --mr-icon-color: var(--mr-kind-text);
}

.mr-icon[data-kind='media'] {
  --mr-icon-color: var(--mr-kind-media);
}

.mr-node-empty {
  padding-top: 3px;
  padding-bottom: 3px;
  color: var(--mr-muted);
  font-size: 12px;
}

/* ---------- 目录 ---------- */
.mr-toc {
  position: sticky;
  top: calc(var(--mr-bar-h) + 16px);
  grid-column: 3;
  justify-self: end;
  align-self: start;
  width: 192px;
  max-height: calc(100vh - var(--mr-bar-h) - 36px);
  overflow-y: auto;
  padding: 0 0 24px 18px;
  border-left: 1px solid var(--mr-border);
  font-size: 13px;
  line-height: 1.5;
  scrollbar-width: thin;
}

.mr-toc[hidden] {
  display: none;
}

.mr-toc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  padding-left: 2px;
}

.mr-toc-title {
  color: var(--mr-fg);
  font-size: 12px;
  font-weight: 600;
}

.mr-toc nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mr-toc a {
  display: block;
  overflow: hidden;
  padding: 5px 8px;
  border-radius: 7px;
  color: var(--mr-muted);
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease, background 0.15s ease;
}

.mr-toc a:hover {
  color: var(--mr-fg);
  background: var(--mr-hover-bg);
}

.mr-toc a[data-level='3'] { padding-left: 18px; }
.mr-toc a[data-level='4'] { padding-left: 30px; font-size: 12px; }

.mr-toc a.is-active {
  color: var(--mr-fg);
  background: color-mix(in srgb, var(--mr-accent) 12%, transparent);
  font-weight: 600;
}

/* 窄屏收窄三栏 */
/* 三栏放不下时收起目录，正文保持可读行长 */
@media (max-width: 1180px) {
  .mr-layout {
    grid-template-columns: var(--mr-files-w) minmax(0, 1fr);
    gap: 28px;
  }

  .mr-sidebar {
    width: var(--mr-files-w);
  }

  .mr-toc {
    display: none;
  }

  .mr-article {
    grid-column: 2;
  }

  .mr-source {
    grid-column: 2;
  }

  .mr-preview {
    grid-column: 2 / -1;
  }

  /* 两列时左栏收起 → 单列 */
  .mr-layout:has(.mr-sidebar[hidden]) {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* 再窄隐藏侧栏，只剩正文 */
@media (max-width: 1000px) {
  /* 顶部留出顶栏高度，避免标题被压住 */
  .mr-layout {
    grid-template-columns: minmax(0, 1fr);
    padding: calc(var(--mr-bar-h) + 12px) 12px 12px;
  }

  .mr-article {
    padding: 32px 24px 48px;
    border-radius: 12px;
  }

  .mr-source {
    padding: 28px 24px 40px;
    border-radius: 12px;
  }

  /* 文件树不再隐藏，改成贴着左边缘的抽屉：脱离单列网格，盖上正文 */
  .mr-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 12;
    width: min(80vw, 320px);
    /* 固定定位在网格子项里不会自动撑满，显式给高 */
    height: 100vh;
    height: 100dvh;
    max-height: none;
    padding: calc(var(--mr-bar-h) + 8px) 14px 40px;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--mr-surface);
    border-right: 1px solid var(--mr-border);
    box-shadow: 0 0 48px rgba(0, 0, 0, 0.16);
  }

  /* 下划线式的搜索框更省纵向空间 */
  .mr-filter {
    background: var(--mr-bg);
  }

  /* 抽屉打开时压暗正文，点遮罩即收起 */
  .mr-root:has(.mr-sidebar:not([hidden])) .mr-scrim {
    display: block;
  }

  /* 遮罩要盖住顶栏（10），只留抽屉（12）在它上面 */
  .mr-scrim {
    z-index: 11;
  }

  /* 窄屏的展开入口都在顶栏里，贴边手柄只会压在正文上 */
  .mr-rail:not([hidden]) {
    display: none;
  }

  .mr-article,
  .mr-source {
    grid-column: 1;
  }

  .mr-preview {
    grid-column: 1;
    /* 顶栏 + 上下留白 */
    height: calc(100vh - var(--mr-bar-h) - 36px);
  }

  .mr-layout:has(.mr-sidebar[hidden]) {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* 顶栏在窄屏收掉产品名，只留标识、文件名和操作 */
@media (max-width: 720px) {
  .mr-toolbar {
    padding: 0 8px;
  }

  .mr-toolbar-name {
    display: none;
  }

  .mr-toolbar-doc {
    margin-left: 4px;
    font-size: 11px;
  }

  .mr-toolbar-doc::before {
    margin-right: 8px;
  }

  .mr-toolbar button {
    min-width: 28px;
    padding: 0 5px;
  }

  .mr-toolbar .mr-sep {
    margin: 0 2px;
  }
}

/* ---------- 图片放大 ---------- */
.mr-lightbox {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: rgba(0, 0, 0, 0.82);
  cursor: zoom-out;
}

.mr-lightbox[hidden] {
  display: none;
}

.mr-lightbox img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
}

/* ---------- 打印 ---------- */
@media (prefers-reduced-motion: reduce) {
  .mr-root *,
  .mr-root *::before,
  .mr-root *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

@media print {
  .mr-toolbar,
  .mr-sidebar,
  .mr-toc,
  .mr-copy,
  .mr-lightbox,
  .mr-preview {
    display: none !important;
  }
  .mr-layout {
    padding: 0;
    max-width: none;
    display: block;
  }
  .mr-article,
  .mr-source {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: #fff;
  }
  .mr-root {
    --mr-bg: #fff;
    --mr-fg: #000;
  }
  .mr-article pre {
    white-space: pre-wrap;
    word-break: break-word;
  }
}
`
