/** Shadow DOM 内的全部样式，不污染宿主页面 */
export const readerCss = /* css */ `
:host {
  all: initial;
}

.mr-root {
  --mr-bg: #ffffff;
  --mr-fg: #1f2328;
  --mr-muted: #656d76;
  --mr-border: #d8dee4;
  --mr-accent: #0969da;
  --mr-code-bg: #f6f8fa;
  --mr-inline-code-bg: rgba(175, 184, 193, 0.2);
  --mr-mark-bg: #fff8c5;
  --mr-font-size: 16px;
  --mr-content-width: 720px;

  box-sizing: border-box;
  min-height: 100%;
  background: var(--mr-bg);
  color: var(--mr-fg);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI",
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: var(--mr-font-size);
  line-height: 1.75;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.mr-root[data-theme='dark'] {
  --mr-bg: #0d1117;
  --mr-fg: #e6edf3;
  --mr-muted: #8d96a0;
  --mr-border: #30363d;
  --mr-accent: #4493f8;
  --mr-code-bg: #161b22;
  --mr-inline-code-bg: rgba(110, 118, 129, 0.4);
  --mr-mark-bg: #4b3f00;
}

.mr-root *,
.mr-root *::before,
.mr-root *::after {
  box-sizing: border-box;
}

/* ---------- 布局 ---------- */
.mr-layout {
  display: flex;
  justify-content: center;
  gap: 40px;
  padding: 72px 32px 160px;
  max-width: calc(var(--mr-content-width) + 240px + 300px);
  margin: 0 auto;
}

.mr-article {
  width: 100%;
  max-width: var(--mr-content-width);
  min-width: 0;
}

/* ---------- 工具栏 ---------- */
.mr-find {
  position: fixed;
  top: 10px;
  left: 50%;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 1px solid var(--mr-border);
  border-radius: 10px;
  background: var(--mr-bg);
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

.mr-toolbar {
  position: fixed;
  top: 16px;
  right: 24px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--mr-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--mr-bg) 88%, transparent);
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  opacity: 0.55;
  transition: opacity 0.18s ease;
}

.mr-toolbar:hover,
.mr-toolbar:focus-within {
  opacity: 1;
}

.mr-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--mr-muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.mr-toolbar button:hover {
  background: var(--mr-inline-code-bg);
  color: var(--mr-fg);
}

.mr-toolbar button[aria-pressed='true'] {
  color: var(--mr-accent);
  background: color-mix(in srgb, var(--mr-accent) 12%, transparent);
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

/* ---------- 排版 ---------- */
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
  margin: 1.8em 0 0.6em;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.01em;
  scroll-margin-top: 24px;
}

.mr-article h1 {
  margin-top: 0;
  padding-bottom: 0.35em;
  border-bottom: 1px solid var(--mr-border);
  font-size: 1.9em;
  letter-spacing: -0.02em;
}

.mr-article h2 {
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--mr-border);
  font-size: 1.45em;
}

.mr-article h3 { font-size: 1.2em; }
.mr-article h4 { font-size: 1.05em; }
.mr-article h5,
.mr-article h6 { font-size: 1em; color: var(--mr-muted); }

.mr-article p,
.mr-article ul,
.mr-article ol,
.mr-article blockquote,
.mr-article table,
.mr-article pre {
  margin: 0 0 1em;
}

.mr-article a {
  color: var(--mr-accent);
  text-decoration: none;
}

.mr-article a:hover {
  text-decoration: underline;
}

.mr-article ul,
.mr-article ol {
  padding-left: 1.6em;
}

.mr-article li + li {
  margin-top: 0.25em;
}

.mr-article li > ul,
.mr-article li > ol {
  margin: 0.25em 0 0;
}

.mr-article blockquote {
  margin-left: 0;
  padding: 0.2em 0 0.2em 1em;
  border-left: 3px solid var(--mr-border);
  color: var(--mr-muted);
}

.mr-article hr {
  height: 1px;
  margin: 2em 0;
  border: 0;
  background: var(--mr-border);
}

.mr-article mark {
  padding: 0.1em 0.2em;
  border-radius: 3px;
  background: var(--mr-mark-bg);
  color: inherit;
}

/* 行内代码 */
.mr-article :not(pre) > code {
  padding: 0.15em 0.4em;
  border-radius: 6px;
  background: var(--mr-inline-code-bg);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;
  font-size: 0.88em;
  word-break: break-word;
}

/* 代码块 */
.mr-article pre {
  position: relative;
  overflow: auto;
  padding: 16px 18px;
  border: 1px solid var(--mr-border);
  border-radius: 10px;
  background: var(--mr-code-bg);
  font-size: 0.86em;
  line-height: 1.6;
  tab-size: 2;
}

.mr-article pre code {
  display: block;
  background: transparent;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;
  white-space: pre;
}

.mr-mermaid {
  margin: 22px 0;
  padding: 14px;
  border: 1px solid var(--mr-border);
  border-radius: 10px;
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
  border-color: rgba(211, 51, 51, 0.45);
  color: #d33;
  font-family: var(--mr-mono);
  font-size: 13px;
  text-align: left;
}

.mr-copy {
  position: absolute;
  top: 6px;
  right: 8px;
  padding: 3px 8px;
  border: 1px solid var(--mr-border);
  border-radius: 6px;
  background: var(--mr-bg);
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
  color: var(--mr-accent);
}

/* 表格 */
.mr-article table {
  display: block;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 0.94em;
}

.mr-article th,
.mr-article td {
  padding: 7px 12px;
  border: 1px solid var(--mr-border);
}

.mr-article th {
  background: var(--mr-code-bg);
  font-weight: 600;
}

.mr-article tbody tr:nth-child(2n) td {
  background: color-mix(in srgb, var(--mr-code-bg) 55%, transparent);
}

/* 任务列表 */
.mr-article .task-list-item {
  list-style: none;
}

.mr-article .task-list-item input {
  width: 14px;
  height: 14px;
  margin: 0 0.55em 0 -1.4em;
  accent-color: var(--mr-accent);
  vertical-align: -2px;
}

/* 图片 */
.mr-article img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  cursor: zoom-in;
}

/* 脚注 */
.mr-article .footnotes {
  margin-top: 3em;
  padding-top: 1em;
  border-top: 1px solid var(--mr-border);
  font-size: 0.9em;
  color: var(--mr-muted);
}

/* ---------- 源码视图 ---------- */
.mr-source {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--mr-muted);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;
  font-size: 0.82em;
  line-height: 1.65;
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
  top: 24px;
  align-self: flex-start;
  flex: 0 0 220px;
  width: 220px;
  max-height: calc(100vh - 96px);
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
  margin-bottom: 8px;
  padding: 0 4px 8px;
  border-bottom: 1px solid var(--mr-border);
}

.mr-up {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--mr-muted);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}

.mr-up:hover {
  background: var(--mr-inline-code-bg);
  color: var(--mr-fg);
}

.mr-up[hidden] {
  display: none;
}

.mr-filter {
  box-sizing: border-box;
  width: 100%;
  margin: 2px 0 8px;
  padding: 5px 8px;
  border: 1px solid var(--mr-border);
  border-radius: 6px;
  outline: none;
  background: transparent;
  color: var(--mr-fg);
  font: inherit;
  font-size: 12px;
  appearance: none;
}

.mr-filter::placeholder {
  color: var(--mr-muted);
}

.mr-filter:focus {
  border-color: var(--mr-accent);
}

.mr-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  margin-bottom: 8px;
  color: var(--mr-muted);
  font-size: 11px;
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
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.mr-crumb:hover {
  background: var(--mr-inline-code-bg);
  color: var(--mr-accent);
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
  color: var(--mr-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.mr-sidebar-close {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--mr-muted);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.mr-sidebar-close:hover {
  background: var(--mr-inline-code-bg);
  color: var(--mr-fg);
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
  padding: 4px 8px 4px 0;
  border-radius: 6px;
  cursor: default;
  transition: background 0.12s ease, color 0.12s ease;
}

.mr-node-row:hover {
  background: var(--mr-inline-code-bg);
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
  color: var(--mr-accent);
}

.mr-node.is-current > .mr-node-row {
  background: color-mix(in srgb, var(--mr-accent) 11%, transparent);
}

.mr-node.is-current > .mr-node-row .mr-node-name {
  color: var(--mr-accent);
  font-weight: 550;
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
  flex: 0 0 14px;
  color: var(--mr-muted);
}

.mr-icon svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mr-node[data-type='dir'] > .mr-node-row .mr-icon {
  color: var(--mr-accent);
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
  top: 24px;
  align-self: flex-start;
  width: 220px;
  flex: 0 0 220px;
  max-height: calc(100vh - 96px);
  overflow-y: auto;
  padding-left: 20px;
  border-left: 1px solid var(--mr-border);
  font-size: 13px;
  line-height: 1.5;
  scrollbar-width: thin;
}

.mr-toc[hidden] {
  display: none;
}

.mr-toc-title {
  margin-bottom: 10px;
  color: var(--mr-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mr-toc nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mr-toc a {
  display: block;
  overflow: hidden;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--mr-muted);
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease, background 0.15s ease;
}

.mr-toc a:hover {
  color: var(--mr-fg);
  background: var(--mr-inline-code-bg);
}

.mr-toc a[data-level='3'] { padding-left: 18px; }
.mr-toc a[data-level='4'] { padding-left: 30px; font-size: 12px; }

.mr-toc a.is-active {
  color: var(--mr-accent);
  background: color-mix(in srgb, var(--mr-accent) 10%, transparent);
  font-weight: 500;
}

/* 窄屏收窄三栏 */
@media (max-width: 1340px) {
  .mr-layout {
    gap: 28px;
  }

  .mr-sidebar {
    flex-basis: 196px;
    width: 196px;
  }
}

/* 再窄隐藏侧栏 */
@media (max-width: 980px) {
  .mr-sidebar {
    display: none;
  }
}

/* 窄屏隐藏目录 */
@media (max-width: 1100px) {
  .mr-toc {
    display: none;
  }
  .mr-layout {
    padding: 64px 20px 120px;
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
@media print {
  .mr-toolbar,
  .mr-toc,
  .mr-copy,
  .mr-lightbox {
    display: none !important;
  }
  .mr-layout {
    padding: 0;
    max-width: none;
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
