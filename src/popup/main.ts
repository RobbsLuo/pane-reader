import './popup.css'
import { getSettings, saveSettings, type Settings, type Theme } from '../shared/settings'

const themeButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-theme]'),
)
const sizeInput = document.querySelector<HTMLInputElement>('#fontSize')!
const sizeOutput = document.querySelector<HTMLOutputElement>('#size')!
const tocInput = document.querySelector<HTMLInputElement>('#showToc')!
const otherFilesInput = document.querySelector<HTMLInputElement>('#showOtherFiles')!

function paint(settings: Settings): void {
  for (const button of themeButtons) {
    button.setAttribute(
      'aria-checked',
      String(button.dataset.theme === settings.theme),
    )
  }
  sizeInput.value = String(settings.fontSize)
  sizeOutput.value = `${settings.fontSize}px`
  tocInput.checked = settings.showToc
  otherFilesInput.checked = settings.showOtherFiles
}

async function init(): Promise<void> {
  const settings = await getSettings()
  paint(settings)

  for (const button of themeButtons) {
    button.addEventListener('click', async () => {
      const theme = button.dataset.theme as Theme
      paint(await saveSettings({ theme }))
    })
  }

  sizeInput.addEventListener('input', () => {
    sizeOutput.value = `${sizeInput.value}px`
  })
  sizeInput.addEventListener('change', async () => {
    paint(await saveSettings({ fontSize: Number(sizeInput.value) }))
  })

  tocInput.addEventListener('change', async () => {
    paint(await saveSettings({ showToc: tocInput.checked }))
  })

  otherFilesInput.addEventListener('change', async () => {
    paint(await saveSettings({ showOtherFiles: otherFilesInput.checked }))
  })

  try {
    document.querySelector('#version')!.textContent =
      `v${chrome.runtime.getManifest().version}`
  } catch {
    /* 非扩展环境（例如直接用 http 打开预览） */
  }
}

void init()
