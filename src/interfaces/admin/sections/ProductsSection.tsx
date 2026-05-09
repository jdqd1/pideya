import {
    Edit3,
    Eye,
    EyeOff,
    Minus,
    Package,
    Plus,
    UploadCloud,
    Image as ImageIcon,
    Search,
    ChevronDown,
    ChevronUp,
    X,
    LayoutGrid,
    AlertCircle,
} from "lucide-react"
import { type Dispatch, type SetStateAction, useMemo, useRef, useState, useEffect } from "react"
import type { ProductDef } from "../../../types/app"
import { API_URL } from "../../../api/config"
import type { Recipe } from "../../../types/recetario"
import { roundUsd } from "../../../utils/currency"

export type InventoryFilter = "all" | "low"

export type InventorySummary = {
    totalStock: number
    lowStock: number
    items: number
}

export type EditingProductState = {
    index: number
    draft: { name: string; price: string; points: string; stock: string; cost: string; imageUrl: string; description: string }
} | null

export type NewProductState = { name: string; price: string; points: string; stock: string; cost: string; imageUrl: string; description: string }

export type ProductsSectionProps = {
    isAdmin: boolean
    catalog: ProductDef[]
    newProduct: NewProductState
    setNewProduct: Dispatch<SetStateAction<NewProductState>>
    addProduct: () => void | Promise<void>
    loadingAction: boolean
    handleDeleteProduct: (id: string) => void
    handleRestoreProduct: (id: string) => void
    editingProduct: EditingProductState
    setEditingProduct: Dispatch<SetStateAction<EditingProductState>>
    handleSaveProductEdit: () => void | Promise<void>
    inventoryFilter: InventoryFilter
    setInventoryFilter: Dispatch<SetStateAction<InventoryFilter>>
    filteredInventory: ProductDef[]
    lowStockThreshold: number
    formatMoney: (value: number | string | undefined | null) => string
    inventorySummary: InventorySummary
    stockUpdates: Record<string, number>
    onQueueStockUpdate: (id: string, delta: number) => void
    onSaveStockUpdates: () => void
}

function StockCounter({ initialStock, onUpdate }: { initialStock: number, onUpdate: (delta: number) => void }) {
    const [localStock, setLocalStock] = useState(initialStock)
    const [isDirty, setIsDirty] = useState(false)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Sync local state if prop changes from outside (and we are not editing)
    useEffect(() => {
        if (!isDirty) setLocalStock(initialStock)
    }, [initialStock, isDirty])

    const commitChange = (newValue: number) => {
        const delta = newValue - initialStock
        if (delta !== 0) {
            onUpdate(delta)
        }
        setIsDirty(false)
    }

    const handleChange = (val: string) => {
        setIsDirty(true)
        const parsed = parseInt(val)
        if (!isNaN(parsed) && parsed >= 0) {
            setLocalStock(parsed)
            // Debounce commit
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            timeoutRef.current = setTimeout(() => {
                commitChange(parsed)
            }, 1000)
        } else if (val === "") {
            setLocalStock(0) // Handle empty input temporarily as 0
        }
    }

    const handleBlur = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        commitChange(localStock)
    }

    const adjust = (delta: number) => {
        setIsDirty(true)
        const next = Math.max(0, localStock + delta)
        setLocalStock(next)

        // Quick debounce for buttons
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
            commitChange(next)
        }, 600)
    }

    return (
        <div className="flex items-center bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button
                onClick={() => adjust(-1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-colors active:scale-90"
            >
                <Minus size={16} />
            </button>
            <input
                className="w-12 text-center font-bold text-slate-900 tabular-nums outline-none bg-transparent"
                value={localStock}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.currentTarget.blur()
                    }
                }}
            />
            <button
                onClick={() => adjust(1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-colors active:scale-90"
            >
                <Plus size={16} />
            </button>
        </div>
    )
}


export default function ProductsSection({
    isAdmin,
    catalog,
    newProduct,
    setNewProduct,
    addProduct,
    loadingAction,
    handleDeleteProduct,
    handleRestoreProduct,
    editingProduct,
    setEditingProduct,
    handleSaveProductEdit,
    inventoryFilter,
    setInventoryFilter,
    filteredInventory,
    lowStockThreshold,
    formatMoney,
    inventorySummary,
    stockUpdates,
    onQueueStockUpdate,
    onSaveStockUpdates,
}: ProductsSectionProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const editFileInputRef = useRef<HTMLInputElement>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isEditDragging, setIsEditDragging] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [isStockOpen, setIsStockOpen] = useState(false)
    const [linkedRecipeMap, setLinkedRecipeMap] = useState<Record<string, string>>({})
    const hasUpdates = Object.keys(stockUpdates).length > 0
    const [recipes, setRecipes] = useState<Recipe[]>([])

    useEffect(() => {
        const fetchRecipes = async () => {
            try {
                const token = JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
                if (!token) return
                const res = await fetch(`${API_URL}/recetario/recipes`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (res.ok) {
                    const data: Recipe[] = await res.json()
                    setRecipes(Array.isArray(data) ? data : []) // Set recipes state
                    const map: Record<string, string> = {}
                    data.forEach(r => {
                        if (r.linkedProductId) {
                            map[r.linkedProductId] = r.name
                        }
                    })
                    setLinkedRecipeMap(map)
                }
            } catch (e) {
                console.error("Failed to fetch recipes for linking info", e)
            }
        }
        fetchRecipes()
    }, [])

    if (!isAdmin) return null

    const handleFileChange = (file: File, isEdit: boolean = false) => {
        if (!file.type.startsWith("image/")) return
        const reader = new FileReader()
        reader.onload = (e) => {
            const base64 = e.target?.result as string
            if (isEdit) {
                setEditingProduct((prev) =>
                    prev ? { ...prev, draft: { ...prev.draft, imageUrl: base64 } } : prev
                )
            } else {
                setNewProduct((prev) => ({ ...prev, imageUrl: base64 }))
            }
        }
        reader.readAsDataURL(file)
    }

    const filteredCatalog = useMemo(() => {
        if (!searchTerm) return catalog
        return catalog.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
        )
    }, [catalog, searchTerm])

    const handleCreateProduct = async () => {
        await addProduct()
        setShowAddModal(false)
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-[1200px] mx-auto px-4 lg:px-0">
            {/* Header & Stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Productos</h2>
                    <p className="text-slate-500 font-medium">Gestiona tu catálogo y stock</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-2xl border border-slate-200">
                        <div className="px-4 py-2 text-center border-r border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
                            <p className="text-lg font-bold text-slate-800">{inventorySummary.items}</p>
                        </div>
                        <div className="px-4 py-2 text-center">
                            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Bajos</p>
                            <p className="text-lg font-bold text-rose-600">{inventorySummary.lowStock}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="h-14 px-6 bg-slate-900 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Plus size={20} />
                        <span className="hidden sm:inline">Nuevo Producto</span>
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o descripción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#6A3A30]/5 h-12 pl-12 pr-4 rounded-2xl border border-[#6A3A30]/10 outline-none focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30]/30 transition-all font-medium text-slate-600 shadow-sm"
                    />
                </div>
            </div>

            {/* Catalog Grid */}
            {filteredCatalog.length === 0 ? (
                <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[2.5rem] py-20 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <Package size={32} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-bold text-lg">No se encontraron productos</p>
                    <p className="text-slate-400 text-sm">Prueba ajustando tu búsqueda o crea uno nuevo</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCatalog.map((p, i) => {
                        const isLinked = recipes.some(r => r.linkedProductId === p.id)
                        const hasCost = (p.cost || 0) > 0
                        const hasFinancialData = isLinked || hasCost
                        const isVisible = p.active !== false

                        return (
                            <div
                                key={p.id || i}
                                className={`group bg-white rounded-[2rem] border overflow-hidden hover:shadow-2xl hover:shadow-slate-200 hover:border-slate-300 transition-all duration-300 flex flex-col h-full ${isVisible ? "border-slate-200/60" : "border-slate-300 opacity-70 grayscale-[0.25]"}`}
                            >
                                {/* Image Container */}
                                <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
                                    {p.imageUrl ? (
                                        <img
                                            src={p.imageUrl}
                                            alt={p.name}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-100">
                                            <ImageIcon size={48} strokeWidth={1.5} />
                                        </div>
                                    )}

                                    {/* Recipe Link Badge */}
                                    {p.id && linkedRecipeMap[p.id] ? (
                                        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-bold text-indigo-600 shadow-sm border border-indigo-100 flex items-center gap-1.5 animate-in fade-in zoom-in duration-300">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                            <span className="truncate max-w-[120px]">Enlazado</span>
                                        </div>
                                    ) : (
                                        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-slate-900/40 backdrop-blur-md rounded-full text-[10px] font-bold text-white/50 border border-white/10 flex items-center gap-1.5 transition-opacity">
                                            <span>Sin enlace</span>
                                        </div>
                                    )}

                                    <div className="absolute top-4 right-4 flex gap-2 transition-all duration-300">
                                        {!hasFinancialData && (
                                            <div className="group/warn relative">
                                                <div className="w-10 h-10 flex items-center justify-center bg-amber-50/90 backdrop-blur-md text-amber-500 rounded-xl cursor-help shadow-lg">
                                                    <AlertCircle size={18} />
                                                </div>
                                                <div className="absolute top-12 right-0 w-48 bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl z-20 pointer-events-none opacity-0 group-hover/warn:opacity-100 transition-opacity">
                                                    <b>Sin datos financieros</b>
                                                    <br />Este producto no tiene costo asociado ni receta enlazada.
                                                </div>
                                            </div>
                                        )}
                                        <button
                                            onClick={() =>
                                                setEditingProduct({
                                                    index: catalog.indexOf(p),
                                                    draft: {
                                                        name: p.name,
                                                        price: roundUsd(p.price ?? 0).toFixed(2),
                                                        points: p.points.toString(),
                                                        stock: (p.stock ?? 0).toString(),
                                                        cost: (p.cost ?? 0).toString(),
                                                        imageUrl: p.imageUrl ?? "",
                                                        description: p.description ?? "",
                                                    },
                                                })
                                            }
                                            className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-xl flex items-center justify-center text-slate-700 hover:bg-white hover:text-slate-900 shadow-lg"
                                        >
                                            <Edit3 size={18} />
                                        </button>
                                        <button
                                            onClick={() => p.id && (isVisible ? handleDeleteProduct(p.id) : handleRestoreProduct(p.id))}
                                            className={`w-10 h-10 bg-white/90 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg ${isVisible ? "text-slate-500 hover:bg-amber-500 hover:text-white" : "text-emerald-600 hover:bg-emerald-600 hover:text-white"}`}
                                            title={isVisible ? "Ocultar del menu" : "Mostrar en menu"}
                                        >
                                            {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>

                                    {/* Stock Badge */}
                                    <div className={`absolute bottom-4 left-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${(p.stock ?? 0) <= lowStockThreshold
                                        ? "bg-rose-500/80 text-white border-rose-400"
                                        : "bg-white/80 text-slate-700 border-white/40 shadow-sm"
                                        }`}>
                                        Stock: {p.stock ?? 0}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6 flex flex-col flex-1">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-slate-900 group-hover:text-black transition-colors truncate">
                                                {p.name}
                                            </h3>
                                            {!isVisible && (
                                                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500">
                                                    Oculto
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 line-clamp-2 min-h-[40px] leading-relaxed">
                                            {p.description || "Sin descripción disponible"}
                                        </p>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                        <div className="font-black text-lg text-slate-900">
                                            {formatMoney(p.price)}
                                        </div>
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold ring-1 ring-orange-100">
                                            <LayoutGrid size={12} />
                                            {p.points} pts
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Collapsible Stock Section */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <button
                    onClick={() => setIsStockOpen(!isStockOpen)}
                    className="w-full px-8 py-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors group"
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl transition-all ${isStockOpen ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "bg-slate-100 text-slate-500"}`}>
                            <Package size={24} />
                        </div>
                        <div className="text-left">
                            <h3 className="text-xl font-extrabold text-slate-900">Gestión de Stock</h3>
                            <p className="text-slate-500 text-sm font-medium">Actualización rápida de existencias</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {inventorySummary.lowStock > 0 && (
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-bold ring-1 ring-rose-100">
                                <AlertCircle size={14} />
                                {inventorySummary.lowStock} Alertas
                            </div>
                        )}
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-slate-900 transition-colors shadow-sm border border-slate-200/50">
                            {isStockOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                    </div>
                </button>

                {isStockOpen && (
                    <div className="p-8 pt-0 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 mb-6 bg-slate-50 p-1 rounded-2xl w-fit">
                            <button
                                onClick={() => setInventoryFilter("all")}
                                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${inventoryFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                Todos
                            </button>
                            <button
                                onClick={() => setInventoryFilter("low")}
                                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${inventoryFilter === "low" ? "bg-white text-rose-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                Por reponer
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredInventory.map((p) => {
                                const idx = catalog.indexOf(p)
                                const isLow = (p.stock ?? 0) <= lowStockThreshold
                                return (
                                    <div
                                        key={idx}
                                        className={`p-4 rounded-[1.5rem] border transition-all flex items-center justify-between gap-4 ${isLow ? "bg-rose-50/30 border-rose-100 shadow-sm shadow-rose-50" : "bg-slate-50/30 border-slate-100"
                                            }`}
                                    >
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-slate-900 truncate">{p.name}</h4>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${isLow ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`} />
                                                <p className={`text-[10px] font-bold uppercase tracking-wider ${isLow ? "text-rose-500" : "text-emerald-600"}`}>
                                                    {isLow ? "REPONER" : "En Stock"}
                                                </p>
                                            </div>
                                        </div>

                                        <StockCounter
                                            initialStock={(p.stock ?? 0) + (p.id ? (stockUpdates[p.id] || 0) : 0)}
                                            onUpdate={(delta) => p.id && onQueueStockUpdate(p.id, delta)}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Save Bar */}
            {hasUpdates && (
                <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="font-bold">Hay cambios sin guardar</span>
                        </div>
                        <button
                            onClick={onSaveStockUpdates}
                            className="bg-white text-slate-900 px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-50 active:scale-95 transition-all"
                        >
                            Guardar Cambios
                        </button>
                    </div>
                </div>
            )}

            {/* Modal: Nuevo / Editar Producto */}
            {(showAddModal || editingProduct) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                        onClick={() => {
                            setShowAddModal(false)
                            setEditingProduct(null)
                        }}
                    />
                    <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                        <div className="p-8 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900">
                                    {editingProduct ? "Editar Producto" : "Nuevo Producto"}
                                </h3>
                                <p className="text-slate-500 text-sm font-medium">Completa los detalles del item</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowAddModal(false)
                                    setEditingProduct(null)
                                }}
                                className="w-10 h-10 rounded-full bg-white text-slate-400 hover:text-slate-900 hover:shadow-md transition-all flex items-center justify-center border border-slate-200"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Left Side: Media Upload */}
                                <div className="space-y-4">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2">Imagen del Producto</p>
                                    <div
                                        onClick={() => (editingProduct ? editFileInputRef.current : fileInputRef.current)?.click()}
                                        onDragOver={(e) => {
                                            e.preventDefault()
                                            editingProduct ? setIsEditDragging(true) : setIsDragging(true)
                                        }}
                                        onDragLeave={() => editingProduct ? setIsEditDragging(false) : setIsDragging(false)}
                                        onDrop={(e) => {
                                            e.preventDefault()
                                            editingProduct ? setIsEditDragging(false) : setIsDragging(false)
                                            const file = e.dataTransfer.files[0]
                                            if (file) handleFileChange(file, !!editingProduct)
                                        }}
                                        className={`relative aspect-square rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden group ${(editingProduct ? isEditDragging : isDragging)
                                            ? "border-slate-900 bg-slate-50 scale-95"
                                            : (editingProduct ? editingProduct.draft.imageUrl : newProduct.imageUrl)
                                                ? "border-slate-200"
                                                : "border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300"
                                            }`}
                                    >
                                        {(editingProduct ? editingProduct.draft.imageUrl : newProduct.imageUrl) ? (
                                            <div className="relative w-full h-full group">
                                                <img
                                                    src={editingProduct ? editingProduct.draft.imageUrl : newProduct.imageUrl}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    alt="Vista previa"
                                                />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <p className="text-white text-xs font-bold px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/30">Cambiar Foto</p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        if (editingProduct) {
                                                            setEditingProduct({ ...editingProduct, draft: { ...editingProduct.draft, imageUrl: "" } })
                                                        } else {
                                                            setNewProduct({ ...newProduct, imageUrl: "" })
                                                        }
                                                    }}
                                                    className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 backdrop-blur-md rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-lg shadow-black/10 border border-white/50"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="w-16 h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                    <UploadCloud className="text-slate-400" size={32} strokeWidth={1.5} />
                                                </div>
                                                <p className="text-sm font-bold text-slate-600">Drag & Drop o click</p>
                                                <p className="text-xs text-slate-400 mt-1">PNG, JPG o WebP</p>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        ref={editingProduct ? editFileInputRef : fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) handleFileChange(file, !!editingProduct)
                                        }}
                                    />
                                </div>

                                {/* Right Side: Info Fields */}
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Nombre Comercial</label>
                                            <input
                                                className="w-full bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-2xl px-5 py-3.5 outline-none focus:bg-white focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30]/30 transition-all font-bold text-slate-800"
                                                placeholder="Ej: Brownie de Oreo Supremo"
                                                value={editingProduct ? editingProduct.draft.name : newProduct.name}
                                                onChange={(e) => editingProduct
                                                    ? setEditingProduct(prev => prev ? { ...prev, draft: { ...prev.draft, name: e.target.value } } : null)
                                                    : setNewProduct({ ...newProduct, name: e.target.value })
                                                }
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Precio (USD)</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-2xl pl-8 pr-4 py-3.5 outline-none focus:bg-white focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30]/30 transition-all font-black text-slate-800"
                                                        placeholder="0.00"
                                                        step="0.01"
                                                        value={editingProduct ? editingProduct.draft.price : newProduct.price}
                                                        onChange={(e) => editingProduct
                                                            ? setEditingProduct(prev => prev ? { ...prev, draft: { ...prev.draft, price: e.target.value } } : null)
                                                            : setNewProduct({ ...newProduct, price: e.target.value })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Puntos Recompensa</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-2xl px-5 py-3.5 outline-none focus:bg-white focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30]/30 transition-all font-bold text-slate-800"
                                                    placeholder="0"
                                                    value={editingProduct ? editingProduct.draft.points : newProduct.points}
                                                    onChange={(e) => editingProduct
                                                        ? setEditingProduct(prev => prev ? { ...prev, draft: { ...prev.draft, points: e.target.value } } : null)
                                                        : setNewProduct({ ...newProduct, points: e.target.value })
                                                    }
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">

                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Inventario Inicial</label>
                                            <input
                                                type="number"
                                                className="w-full bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-2xl px-5 py-3.5 outline-none focus:bg-white focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30]/30 transition-all font-bold text-slate-800"
                                                placeholder="0 unidades"
                                                value={editingProduct ? editingProduct.draft.stock : newProduct.stock}
                                                onChange={(e) => editingProduct
                                                    ? setEditingProduct(prev => prev ? { ...prev, draft: { ...prev.draft, stock: e.target.value } } : null)
                                                    : setNewProduct({ ...newProduct, stock: e.target.value })
                                                }
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Costo Unitario (USD)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                <input
                                                    type="number"
                                                    className="w-full bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-2xl pl-8 pr-4 py-3.5 outline-none focus:bg-white focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30]/30 transition-all font-bold text-slate-800"
                                                    placeholder="0.00"
                                                    step="0.01"
                                                    value={editingProduct ? (editingProduct.draft as any).cost : (newProduct as any).cost}
                                                    onChange={(e) => editingProduct
                                                        ? setEditingProduct(prev => prev ? { ...prev, draft: { ...prev.draft, cost: e.target.value } } : null)
                                                        : setNewProduct({ ...newProduct, cost: e.target.value } as any)
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Descripción Detallada</label>
                                <textarea
                                    className="w-full bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-2xl px-5 py-4 outline-none focus:bg-white focus:ring-2 focus:ring-[#6A3A30]/20 focus:border-[#6A3A30]/30 transition-all font-medium text-slate-700 min-h-[120px] resize-none leading-relaxed"
                                    placeholder="Describe las características principales, ingredientes o notas importantes para el cliente..."
                                    value={editingProduct ? editingProduct.draft.description : newProduct.description}
                                    onChange={(e) => editingProduct
                                        ? setEditingProduct(prev => prev ? { ...prev, draft: { ...prev.draft, description: e.target.value } } : null)
                                        : setNewProduct({ ...newProduct, description: e.target.value })
                                    }
                                />
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50/80 backdrop-blur-md border-t border-slate-100 flex gap-4">
                            <button
                                onClick={editingProduct ? handleSaveProductEdit : handleCreateProduct}
                                disabled={loadingAction || (editingProduct ? !editingProduct.draft.name : !newProduct.name)}
                                className="flex-1 bg-slate-900 text-white font-black py-4 rounded-[1.25rem] hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50 disabled:grayscale hover:scale-[1.01] active:scale-[0.99]"
                            >
                                {loadingAction ? "Procesando..." : editingProduct ? "Guardar Cambios" : "Crear Producto"}
                            </button>
                            <button
                                onClick={() => {
                                    setShowAddModal(false)
                                    setEditingProduct(null)
                                }}
                                className="px-8 bg-white text-slate-600 font-bold py-4 rounded-[1.25rem] border border-slate-200 hover:bg-slate-50 transition-all active:scale-[0.99]"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
