import { useState, useEffect } from "react"
import { X, Save, DollarSign, Loader2, AlertCircle } from "lucide-react"
import { fetchFinancialSettings, updateFinancialSettings, type FinancialSettings } from "../../../api/secure"

interface FinancialSettingsModalProps {
    onClose: () => void
    onSave?: (settings: FinancialSettings) => void
}

export default function FinancialSettingsModal({ onClose, onSave }: FinancialSettingsModalProps) {
    const [settings, setSettings] = useState<FinancialSettings>({ fixedExpenses: 0 })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                // We need to read the token from localStorage manually as we are in a component
                const tokenStr = localStorage.getItem("loyalty-auth")
                if (!tokenStr) {
                    setError("No autorizado")
                    setLoading(false)
                    return
                }
                const token = JSON.parse(tokenStr).token
                const data = await fetchFinancialSettings(token)
                setSettings(data)
            } catch (err) {
                console.error("Failed to load settings", err)
                setError("No se pudo cargar la configuración")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError(null)
        try {
            const tokenStr = localStorage.getItem("loyalty-auth")
            if (!tokenStr) throw new Error("No token")
            const token = JSON.parse(tokenStr).token

            const updated = await updateFinancialSettings(settings, token)
            if (onSave) onSave(updated)
            onClose()
        } catch (err) {
            console.error("Failed to save", err)
            setError("Error al guardar cambios")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-2xl shadow-xl flex items-center gap-3">
                    <Loader2 className="animate-spin text-indigo-600" size={24} />
                    <span className="font-medium text-slate-700">Cargando configuración...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-black/5">
                <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Establecer metas</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white hover:shadow-sm rounded-full text-slate-400 hover:text-rose-500 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-sm font-medium flex items-center gap-2">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Gastos Fijos Mensuales ($)
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white font-mono font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                                    value={settings.fixedExpenses}
                                    onChange={e => setSettings({ ...settings, fixedExpenses: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <p className="mt-2 text-xs text-slate-400">
                                Total de gastos operativos fijos (Alquiler, Nómina fija, Servicios básicos, etc.)
                            </p>
                        </div>


                    </div>

                    <div className="pt-4 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-8 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-lg hover:shadow-indigo-500/30 disabled:opacity-70 disabled:active:scale-100 flex items-center gap-2"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
