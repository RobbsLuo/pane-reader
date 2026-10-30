export type Theme = 'auto' | 'light' | 'dark'

export interface Settings {
  theme: Theme
  /** 正文字号，px */
  fontSize: number
  /** 是否显示右侧目录 */
  showToc: boolean
  /** 是否显示左侧文件树 */
  showFiles: boolean
  /** 文件树里是否列出图片 / PDF / 文本等非 Markdown 文件 */
  showOtherFiles: boolean
}

export const DEFAULTS: Settings = {
  theme: 'auto',
  fontSize: 16,
  showToc: true,
  showFiles: true,
  showOtherFiles: true,
}

const KEY = 'settings'
/** v0.3.1 起默认列出所有文件，用它给老配置做一次性纠正 */
const MIGRATED_KEY = 'settingsShowOtherFilesDefaultOn'

function readStored(stored: Record<string, unknown>): Settings {
  const raw = (stored[KEY] ?? {}) as Partial<Settings>
  const next = { ...DEFAULTS, ...raw }
  if (!stored[MIGRATED_KEY] && raw.showOtherFiles !== true) next.showOtherFiles = true
  return next
}

export async function getSettings(): Promise<Settings> {
  try {
    const stored = await chrome.storage.local.get([KEY, MIGRATED_KEY])
    const next = readStored(stored)
    if (!stored[MIGRATED_KEY]) {
      await chrome.storage.local.set({ [KEY]: next, [MIGRATED_KEY]: true })
    }
    return next
  } catch {
    return { ...DEFAULTS }
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch }
  await chrome.storage.local.set({ [KEY]: next })
  return next
}

/** 监听设置变化，返回取消订阅函数 */
export function onSettingsChange(cb: (s: Settings) => void): () => void {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || !changes[KEY]) return
    cb(readStored({ [KEY]: changes[KEY].newValue, [MIGRATED_KEY]: true }))
  }
  chrome.storage.onChanged.addListener(handler)
  return () => chrome.storage.onChanged.removeListener(handler)
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'auto') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
