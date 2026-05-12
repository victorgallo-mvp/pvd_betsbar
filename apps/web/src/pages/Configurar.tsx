import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Settings, Printer, Store, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { api } from '../lib/api'

interface AppConfig {
  establishment: { name: string; address: string; cnpj: string; phone: string }
  printer: { type: 'html' | 'network' | 'usb'; ip: string; port: number; width: 58 | 80; characterSet: string }
  kitchenPrinter: { enabled: boolean; ip: string; port: number; width: 58 | 80 }
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-700/50 border-b border-slate-700">
        <Icon size={16} className="text-slate-400" />
        <span className="text-sm font-semibold text-slate-300">{title}</span>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-slate-400 font-medium">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 user-select-text" />
  )
}

function WidthToggle({ value, onChange }: { value: 58 | 80; onChange: (v: 58 | 80) => void }) {
  return (
    <div className="flex gap-2">
      {([58, 80] as const).map(w => (
        <button key={w} onClick={() => onChange(w)}
          className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium touch-btn ${
            value === w ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300' : 'border-slate-600 text-slate-500'
          }`}>
          {w}mm
        </button>
      ))}
    </div>
  )
}

export default function Configurar() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [testKitchenStatus, setTestKitchenStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [testKitchenMsg, setTestKitchenMsg] = useState('')

  useEffect(() => {
    api.get<AppConfig>('/config').then(setConfig)
  }, [])

  const update = (section: keyof AppConfig, key: string, value: unknown) => {
    if (!config) return
    setConfig({ ...config, [section]: { ...config[section], [key]: value } })
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setSaveMsg(null)
    try {
      await api.patch('/config', config)
      setSaveMsg({ ok: true, text: 'Configurações salvas!' })
    } catch {
      setSaveMsg({ ok: false, text: 'Erro ao salvar.' })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  const handleTestPrint = async () => {
    setTestStatus('loading')
    setTestMsg('')
    try {
      const res = await api.post<{ ok: boolean; message: string }>('/config/test-print', {})
      setTestStatus('ok')
      setTestMsg(res.message)
    } catch (err) {
      setTestStatus('err')
      setTestMsg((err as Error).message)
    }
    setTimeout(() => setTestStatus('idle'), 4000)
  }

  const handleTestKitchenPrint = async () => {
    setTestKitchenStatus('loading')
    setTestKitchenMsg('')
    try {
      const res = await api.post<{ ok: boolean; message: string }>('/config/test-kitchen-print', {})
      setTestKitchenStatus('ok')
      setTestKitchenMsg(res.message)
    } catch (err) {
      setTestKitchenStatus('err')
      setTestKitchenMsg((err as Error).message)
    }
    setTimeout(() => setTestKitchenStatus('idle'), 4000)
  }

  if (!config) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <Loader size={32} className="text-slate-500 animate-spin" />
      </div>
    )
  }

  const { establishment: est, printer: prt, kitchenPrinter: kp } = config

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-200 touch-btn">
          <ArrowLeft size={22} />
        </button>
        <Settings size={18} className="text-slate-400" />
        <span className="text-slate-200 font-medium flex-1">Configurações</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Estabelecimento */}
        <Section title="Estabelecimento" icon={Store}>
          <Field label="Nome (aparece nos cupons)">
            <Input value={est.name} onChange={v => update('establishment', 'name', v)} placeholder="Bar & Restaurante" />
          </Field>
          <Field label="Endereço">
            <Input value={est.address} onChange={v => update('establishment', 'address', v)} placeholder="Rua, número, bairro" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="CNPJ">
              <Input value={est.cnpj} onChange={v => update('establishment', 'cnpj', v)} placeholder="00.000.000/0001-00" />
            </Field>
            <Field label="Telefone">
              <Input value={est.phone} onChange={v => update('establishment', 'phone', v)} placeholder="(00) 00000-0000" />
            </Field>
          </div>
        </Section>

        {/* Impressora Balcão */}
        <Section title="Impressora Balcão (Recibos)" icon={Printer}>
          <Field label="Tipo de conexão">
            <div className="flex gap-2">
              {(['html', 'network', 'usb'] as const).map(t => (
                <button key={t} onClick={() => update('printer', 'type', t)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium touch-btn transition-all ${
                    prt.type === t
                      ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300'
                      : 'border-slate-600 text-slate-500 hover:border-slate-500'
                  }`}>
                  {t === 'html' ? 'HTML' : t === 'network' ? 'Rede (TCP)' : 'USB'}
                </button>
              ))}
            </div>
          </Field>

          {prt.type === 'html' && (
            <div className="bg-slate-900 rounded-xl p-3 text-xs text-slate-400 border border-slate-700">
              O cupom é aberto como nova aba e impresso via <code>window.print()</code>. Funciona em qualquer dispositivo sem configuração.
            </div>
          )}

          {prt.type === 'network' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="IP da impressora">
                  <Input value={prt.ip} onChange={v => update('printer', 'ip', v)} placeholder="192.168.1.100" />
                </Field>
              </div>
              <Field label="Porta">
                <Input value={String(prt.port)} onChange={v => update('printer', 'port', Number(v))} type="number" placeholder="9100" />
              </Field>
            </div>
          )}

          {prt.type === 'usb' && (
            <div className="bg-slate-900 rounded-xl p-3 text-xs text-slate-400 border border-slate-700">
              A impressão USB é feita pelo agente local. Configure o nome da impressora Windows no <code>.env</code> do agente:<br />
              <code className="text-emerald-400">PRINTER_INTERFACE=printer:POS-80</code>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Largura do papel">
              <WidthToggle value={prt.width} onChange={v => update('printer', 'width', v)} />
            </Field>
            <Field label="Teste de impressão">
              <button onClick={handleTestPrint} disabled={testStatus === 'loading'}
                className={`w-full py-2.5 rounded-xl border-2 text-sm font-medium touch-btn transition-all flex items-center justify-center gap-2 ${
                  testStatus === 'ok' ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300'
                  : testStatus === 'err' ? 'border-rose-500 bg-rose-900/30 text-rose-300'
                  : 'border-slate-600 text-slate-400 hover:border-slate-500'
                }`}>
                {testStatus === 'loading' ? <Loader size={16} className="animate-spin" />
                  : testStatus === 'ok' ? <CheckCircle size={16} />
                  : testStatus === 'err' ? <AlertCircle size={16} />
                  : <Printer size={16} />}
                Testar
              </button>
            </Field>
          </div>
          {testMsg && (
            <p className={`text-xs ${testStatus === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>{testMsg}</p>
          )}
        </Section>

        {/* Impressora Cozinha */}
        <Section title="Impressora Cozinha (Comandas)" icon={Printer}>
          <Field label="Habilitar impressão automática na cozinha">
            <button
              onClick={() => update('kitchenPrinter', 'enabled', !kp.enabled)}
              className={`w-full py-2.5 rounded-xl border-2 text-sm font-medium touch-btn transition-all ${
                kp.enabled
                  ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300'
                  : 'border-slate-600 text-slate-500 hover:border-slate-500'
              }`}
            >
              {kp.enabled ? 'Habilitada ✓' : 'Desabilitada'}
            </button>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="IP da impressora (cozinha)">
                <Input value={kp.ip} onChange={v => update('kitchenPrinter', 'ip', v)} placeholder="192.168.1.50" />
              </Field>
            </div>
            <Field label="Porta">
              <Input value={String(kp.port)} onChange={v => update('kitchenPrinter', 'port', Number(v))} type="number" placeholder="9100" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Largura do papel">
              <WidthToggle value={kp.width ?? 80} onChange={v => update('kitchenPrinter', 'width', v)} />
            </Field>
            <Field label="Teste de impressão">
              <button onClick={handleTestKitchenPrint} disabled={testKitchenStatus === 'loading' || !kp.enabled}
                className={`w-full py-2.5 rounded-xl border-2 text-sm font-medium touch-btn transition-all flex items-center justify-center gap-2 ${
                  testKitchenStatus === 'ok' ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300'
                  : testKitchenStatus === 'err' ? 'border-rose-500 bg-rose-900/30 text-rose-300'
                  : !kp.enabled ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                  : 'border-slate-600 text-slate-400 hover:border-slate-500'
                }`}>
                {testKitchenStatus === 'loading' ? <Loader size={16} className="animate-spin" />
                  : testKitchenStatus === 'ok' ? <CheckCircle size={16} />
                  : testKitchenStatus === 'err' ? <AlertCircle size={16} />
                  : <Printer size={16} />}
                Testar
              </button>
            </Field>
          </div>
          {testKitchenMsg && (
            <p className={`text-xs ${testKitchenStatus === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>{testKitchenMsg}</p>
          )}

          <div className="bg-slate-900 rounded-xl p-3 text-xs text-slate-400 border border-slate-700">
            Quando o garçom toca em <strong className="text-slate-300">Concluir / Cozinha</strong>, os itens são enviados
            para esta impressora via ESC/POS (TCP/IP). Se offline, fica na fila e imprime quando voltar.
          </div>
        </Section>
      </div>

      {/* Save footer */}
      <div className="shrink-0 p-4 bg-slate-800 border-t border-slate-700 flex items-center gap-3">
        {saveMsg && (
          <div className={`flex items-center gap-2 text-sm ${saveMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
            {saveMsg.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {saveMsg.text}
          </div>
        )}
        <div className="flex-1" />
        <button onClick={handleSave} disabled={saving}
          className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold touch-btn disabled:opacity-40 flex items-center gap-2">
          {saving ? <Loader size={16} className="animate-spin" /> : null}
          Salvar Configurações
        </button>
      </div>
    </div>
  )
}
