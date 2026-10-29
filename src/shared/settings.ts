export type Theme = 'auto' | 'light' | 'dark'

export interface Settings {
  theme: Theme
  /** 正文字号，px */
  fontSize: number
  /** 是否显示右侧目录 */
  showToc: boolean
}

export const DEFAULTS: Settings = {
  theme: 'auto',
  fontSize: 16,
  showToc: true,
}

const KEY = 'settings'

export async function getSettings(): Promise<Settings> {
  try {
    const stored = await chrome.storage.local.get(KEY)
    return { ...DEFAULTS, ...(stored[KEY] ?? {}) }
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
    cb({ ...DEFAULTS, ...(changes[KEY].newValue ?? {}) })
  }
  chrome.storage.onChanged.addListener(handler)
  return () => chrome.storage.onChanged.removeListener(handler)
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'auto') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
