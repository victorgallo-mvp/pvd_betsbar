import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const CONFIG_PATH = join(dirname(fileURLToPath(import.meta.url)), '../pdv-config.json')

export interface AppConfig {
  establishment: {
    name: string
    address: string
    cnpj: string
    phone: string
  }
  printer: {
    type: 'html' | 'network' | 'usb'
    ip: string
    port: number
    width: 58 | 80
    characterSet: string
  }
  kitchenPrinter: {
    enabled: boolean
    ip: string
    port: number
  }
}

const DEFAULTS: AppConfig = {
  establishment: { name: 'Bar & Restaurante', address: '', cnpj: '', phone: '' },
  printer: { type: 'html', ip: '192.168.1.100', port: 9100, width: 80, characterSet: 'PC860_PORTUGUESE' },
  kitchenPrinter: {
    enabled: false,
    ip: process.env.KITCHEN_PRINTER_IP ?? '192.168.1.50',
    port: 9100,
  },
}

export function readConfig(): AppConfig {
  if (!existsSync(CONFIG_PATH)) return structuredClone(DEFAULTS)
  try {
    const stored = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Partial<AppConfig>
    return {
      establishment: { ...DEFAULTS.establishment, ...stored.establishment },
      printer: { ...DEFAULTS.printer, ...stored.printer },
      kitchenPrinter: { ...DEFAULTS.kitchenPrinter, ...stored.kitchenPrinter },
    }
  } catch {
    return structuredClone(DEFAULTS)
  }
}

export function writeConfig(patch: Partial<AppConfig>): AppConfig {
  const current = readConfig()
  const next: AppConfig = {
    establishment: { ...current.establishment, ...patch.establishment },
    printer: { ...current.printer, ...patch.printer },
    kitchenPrinter: { ...current.kitchenPrinter, ...patch.kitchenPrinter },
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf-8')
  return next
}
