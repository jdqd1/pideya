import {
    ChevronDown,
    ChevronUp,
    Download,
    Search,
    Tag,
    Trash2,
    Zap,
    Plus,
    Minus,
    ArrowRight
} from "lucide-react"
import QRCodeLib from "qrcode"
import { saveAs } from "file-saver"
import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { SITE_URL } from "../../../api/config"
import type { GeneratedQrRecord, ProductDef } from "../../../types/app"

export type QrWithStatus = GeneratedQrRecord & { status: "available" | "used" }
export type QrGroup = { key: string; product: ProductDef | null; name: string; codes: QrWithStatus[] }

export type QrSectionProps = {
    isAdmin: boolean
    qrRegistry: GeneratedQrRecord[]
    catalog: ProductDef[]
    isCodeInvalidated: (code: string) => boolean
    handleDeleteQr: (codeId: string) => void | Promise<void>
    handleDeleteUsedQrs: (codes: string[]) => void | Promise<void>
    formatPoints: (value: number | string | undefined | null) => string
    // Generator props
    selectedProductIdx: number
    setSelectedProductIdx: Dispatch<SetStateAction<number>>
    adminGen: { count: number; status: string }
    setAdminGen: Dispatch<SetStateAction<{ count: number; status: string }>>
    handleGenerate: () => void | Promise<void>
    loadingAction: boolean
}

export default function QrSection({
    isAdmin,
    qrRegistry,
    catalog,
    isCodeInvalidated,
    handleDeleteQr,
    handleDeleteUsedQrs,
    formatPoints,
    selectedProductIdx,
    setSelectedProductIdx,
    adminGen,
    setAdminGen,
    handleGenerate,
    loadingAction,
}: QrSectionProps) {
    const [expandedProductKey, setExpandedProductKey] = useState<string | null>(null)
    const [qrSearch, setQrSearch] = useState("")
    const [deletingQrId, setDeletingQrId] = useState<string | null>(null)
    const [downloadingQrId, setDownloadingQrId] = useState<string | null>(null)
    const [showGenerator, setShowGenerator] = useState(false)

    const activeQrRegistry = useMemo(() => qrRegistry.filter((qr) => !isCodeInvalidated(qr.id)), [isCodeInvalidated, qrRegistry])
    const usedQrRegistry = useMemo(() => qrRegistry.filter((qr) => isCodeInvalidated(qr.id)), [isCodeInvalidated, qrRegistry])

    const qrGroups = useMemo(
        () => {
            const groups = new Map<string, QrGroup>()
            qrRegistry.forEach((entry) => {
                const matchById = entry.productId ? catalog.find((p) => p.id === entry.productId) : undefined
                const matchByName = catalog.find((p) => p.name.toLowerCase() === entry.productName.toLowerCase())
                const product = matchById || matchByName || null
                const key = product?.id ?? `orphan-${entry.productName.toLowerCase()}`
                if (!groups.has(key)) {
                    groups.set(key, { key, product, name: product?.name ?? entry.productName, codes: [] })
                }
                groups.get(key)!.codes.push({ ...entry, status: isCodeInvalidated(entry.id) ? "used" : "available" })
            })
            return Array.from(groups.values())
                .map((group) => ({
                    ...group,
                    codes: [...group.codes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
                }))
                .sort((a, b) => a.name.localeCompare(b.name))
        },
        [catalog, isCodeInvalidated, qrRegistry],
    )

    const availableGroups = useMemo(
        () =>
            qrGroups
                .map((group) => ({ ...group, codes: group.codes.filter((qr) => qr.status === "available") }))
                .filter((group) => group.codes.length > 0),
        [qrGroups],
    )

    const usedGroups = useMemo(
        () =>
            qrGroups
                .map((group) => ({ ...group, codes: group.codes.filter((qr) => qr.status === "used") }))
                .filter((group) => group.codes.length > 0),
        [qrGroups],
    )

    const filterQrGroups = (groups: QrGroup[]) => {
        const term = qrSearch.trim().toLowerCase()
        if (!term) return groups
        return groups
            .map((group) => {
                const matchGroup = group.name.toLowerCase().includes(term)
                const codes = matchGroup ? group.codes : group.codes.filter((qr) => qr.id.toLowerCase().includes(term))
                return { ...group, codes }
            })
            .filter((group) => group.codes.length > 0)
    }

    const filteredAvailableGroups = useMemo(() => filterQrGroups(availableGroups), [availableGroups, qrSearch])
    const filteredUsedGroups = useMemo(() => filterQrGroups(usedGroups), [usedGroups, qrSearch])

    const highlightCode = (value: string) => {
        const term = qrSearch.trim()
        if (!term) return value
        const lower = value.toLowerCase()
        const idx = lower.indexOf(term.toLowerCase())
        if (idx === -1) return value
        const before = value.slice(0, idx)
        const match = value.slice(idx, idx + term.length)
        const after = value.slice(idx + term.length)
        return (
            <>
                {before}
                <span className="bg-yellow-200 text-gray-900 px-1 rounded-sm">{match}</span>
                {after}
            </>
        )
    }

    const buildQrDownloadTarget = (qr: QrWithStatus, product: ProductDef | null) => {
        const match =
            product ??
            catalog.find((p) => p.id === qr.productId) ??
            catalog.find((p) => p.name.toLowerCase() === qr.productName.toLowerCase()) ??
            null
        const productIndex = match ? catalog.indexOf(match) : -1
        const params = new URLSearchParams({
            code: qr.id,
            name: match?.name ?? qr.productName,
            points: String(qr.points ?? match?.points ?? 0),
            price: String(qr.price ?? match?.price ?? 0),
        })
        if (productIndex >= 0) params.append("pIdx", String(productIndex))
        return { url: `${SITE_URL}/?${params.toString()}`, filename: `${qr.id}.png` }
    }

    const handleDownloadQr = async (qr: QrWithStatus, product: ProductDef | null) => {
        setDownloadingQrId(qr.id)
        try {
            const target = buildQrDownloadTarget(qr, product)
            const dataUrl = await QRCodeLib.toDataURL(target.url, { margin: 1, scale: 8 })
            const response = await fetch(dataUrl)
            const blob = await response.blob()
            saveAs(blob, target.filename)
        } catch (err) {
            console.error("Error descargando QR", err)
        } finally {
            setDownloadingQrId(null)
        }
    }

    const renderGroupList = (groups: QrGroup[], variant: "available" | "used") => (
        <div className="grid gap-3">
            {groups.map((group) => {
                const groupKey = `${variant}-${group.key}`
                const open = expandedProductKey === groupKey
                const stockLabel = group.product !== null ? `Stock: ${group.product.stock ?? 0}` : "No catalogado"
                const countLabel = `${group.codes.length} QR`

                return (
                    <div key={groupKey} className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300">
                        <button
                            className={`w-full flex items-center justify-between p-4 outline-none ${open ? "bg-gray-50/80" : "hover:bg-gray-50/50"
                                }`}
                            onClick={() => setExpandedProductKey((prev) => (prev === groupKey ? null : groupKey))}
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${variant === 'available' ? 'bg-secondary-50 border-secondary-100 text-secondary-600' : 'bg-amber-50 border-amber-100 text-amber-600'
                                    }`}>
                                    <Tag size={18} />
                                </div>
                                <div className="text-left min-w-0">
                                    <p className="font-semibold text-gray-900 truncate text-sm sm:text-base">{group.name}</p>
                                    <p className="text-xs text-gray-500 font-medium">
                                        {countLabel} <span className="text-gray-300 mx-1">|</span> {stockLabel}
                                    </p>
                                </div>
                            </div>
                            {open ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-300" />}
                        </button>

                        {open && (
                            <div className="p-2 space-y-2 bg-gray-50/50 border-t border-gray-100">
                                {group.codes.map((qr) => {
                                    const created = new Date(qr.createdAt)
                                    const createdLabel = Number.isNaN(created.getTime())
                                        ? "N/A"
                                        : created.toLocaleDateString()
                                    const usedAtDate = qr.usedAt ? new Date(qr.usedAt) : null
                                    const usedLabel =
                                        usedAtDate && !Number.isNaN(usedAtDate.getTime())
                                            ? usedAtDate.toLocaleDateString()
                                            : "Desc."
                                    const timelineLabel = qr.status === "used" ? `Usado ${usedLabel}` : `Del ${createdLabel}`
                                    const isDeleting = deletingQrId === qr.id
                                    const isDownloading = downloadingQrId === qr.id

                                    return (
                                        <div
                                            key={qr.id}
                                            className="bg-white rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm border border-gray-100/50"
                                        >
                                            <div className="min-w-0 flex items-center gap-3">
                                                <div className={`w-1.5 h-8 rounded-full ${qr.status === "used" ? "bg-gray-300" : "bg-primary-400"}`} />
                                                <div>
                                                    <p className="font-mono text-xs font-bold text-gray-700 tracking-wide break-all">{highlightCode(qr.id)}</p>
                                                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                                                        {timelineLabel} · {formatPoints(qr.points)} pts
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {variant === "available" && (
                                                    <button
                                                        onClick={() => handleDownloadQr(qr, group.product)}
                                                        disabled={isDownloading}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-secondary-600 hover:bg-secondary-50 transition-colors border border-secondary-100/80 disabled:opacity-60"
                                                    >
                                                        {isDownloading ? (
                                                            <div className="w-3.5 h-3.5 border-2 border-emerald-500 rounded-full animate-spin border-t-transparent" />
                                                        ) : (
                                                            <Download size={16} />
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={async () => {
                                                        setDeletingQrId(qr.id)
                                                        try { await Promise.resolve(handleDeleteQr(qr.id)) }
                                                        catch { /* ... */ } finally { setDeletingQrId(null) }
                                                    }}
                                                    disabled={isDeleting}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0"
                                                >
                                                    {isDeleting ? <div className="w-3 h-3 border-2 border-rose-500 rounded-full animate-spin border-t-transparent" /> : <Trash2 size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )

    if (!isAdmin) return null

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">

            {/* Minimalist Generator Panel */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100/80">
                <button
                    onClick={() => setShowGenerator(!showGenerator)}
                    className="w-full flex items-center justify-between text-left"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center shrink-0">
                            <Zap size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm">Generador Rápido</h3>
                            <p className="text-xs text-slate-500">Crear nuevos códigos QR</p>
                        </div>
                    </div>
                    {showGenerator ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </button>

                {showGenerator && (
                    <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Producto</label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-xl pl-4 pr-10 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-[#6A3A30]/30 focus:ring-2 focus:ring-[#6A3A30]/10 transition-all"
                                        value={selectedProductIdx}
                                        onChange={(e) => setSelectedProductIdx(Number(e.target.value))}
                                        disabled={!catalog.length}
                                    >
                                        {catalog.length === 0 && <option value={0}>Crear productos primero</option>}
                                        {catalog.map((p, i) => (
                                            <option key={i} value={i}>{p.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                </div>
                            </div>

                            <div className="w-full sm:w-32">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Cantidad</label>
                                <div className="flex items-center gap-1 bg-[#6A3A30]/5 rounded-xl p-1 border border-[#6A3A30]/10 h-[42px]">
                                    <button onClick={() => setAdminGen(prev => ({ ...prev, count: Math.max(1, prev.count - 5) }))} className="w-8 h-full rounded-lg hover:bg-white hover:shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"><Minus size={14} /></button>
                                    <input
                                        className="flex-1 bg-transparent text-center font-bold text-sm text-slate-900 outline-none w-0"
                                        type="number"
                                        min={1}
                                        value={adminGen.count}
                                        onChange={(e) => setAdminGen({ ...adminGen, count: Number(e.target.value) })}
                                    />
                                    <button onClick={() => setAdminGen(prev => ({ ...prev, count: prev.count + 5 }))} className="w-8 h-full rounded-lg hover:bg-white hover:shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"><Plus size={14} /></button>
                                </div>
                            </div>
                        </div>

                        <button
                            className="w-full bg-primary-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary-600/10 hover:shadow-primary-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none"
                            onClick={handleGenerate}
                            disabled={loadingAction || !catalog.length}
                        >
                            {loadingAction ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>Generar {adminGen.count} Códigos <ArrowRight size={16} /></>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                    <input
                        className="w-full bg-[#6A3A30]/5 rounded-xl pl-12 pr-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-[#6A3A30]/10 focus:border-[#6A3A30]/30 transition-all font-medium placeholder:text-slate-400 border border-[#6A3A30]/10"
                        placeholder="Buscar código o producto..."
                        value={qrSearch}
                        onChange={e => setQrSearch(e.target.value)}
                    />
                </div>
                <div className="flex justify-between items-center mt-4 px-2">
                    <div className="flex gap-2 text-xs font-bold">
                        <span className="px-3 py-1 bg-secondary-50 text-secondary-700 rounded-full">{activeQrRegistry.length} Activos</span>
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full">{usedQrRegistry.length} Usados</span>
                    </div>
                    {usedQrRegistry.length > 0 && (
                        <button onClick={() => handleDeleteUsedQrs(usedQrRegistry.map(q => q.id))} className="text-rose-500 text-xs font-bold hover:bg-rose-50 px-3 py-1 rounded-lg transition-colors">Limpiar Historial</button>
                    )}
                </div>
            </div>

            <div className="space-y-8">
                {filteredAvailableGroups.length > 0 && (
                    <div>
                        <h4 className="font-bold text-slate-900 text-sm mb-4 px-2">Disponibles</h4>
                        {renderGroupList(filteredAvailableGroups, "available")}
                    </div>
                )}
                {filteredUsedGroups.length > 0 && (
                    <div>
                        <h4 className="font-bold text-slate-900 text-sm mb-4 px-2">Historial Canjeados</h4>
                        {renderGroupList(filteredUsedGroups, "used")}
                    </div>
                )}
            </div>
        </div>
    )
}
