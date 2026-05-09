import { useState, useEffect, useMemo } from "react"
import type { Dispatch, FormEvent, SetStateAction } from "react"
import { Plus, Search, ChefHat, Package, Calculator, Trash2, Edit2, Save, X, ShoppingBag, Truck, TrendingUp, HelpCircle, DollarSign } from "lucide-react"
import { API_URL } from "../../../api/config"
import type { Ingredient, Recipe, RecipeIngredient } from "../../../types/recetario"
import type { ProductDef } from "../../../types/app"
import { calculateMC, calculateMCPercent, getHealthStatus, calculateRecipeCosts, calculateMarginFromPrice } from "../../../utils/financeUtils"
import { roundUsd } from "../../../utils/currency"
import { ResponsiveContainer, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ComposedChart } from "recharts"


// import { IngredientManager } from "./recetario/IngredientManager"
// import { RecipeManager } from "./recetario/RecipeManager"

// Placeholder API calls - replace with actual API integration later
// Placeholder API calls - replace with actual API integration later

export default function RecetarioSection({ salesResetEpoch = 0, setAdminTab, setCatalog }: { salesResetEpoch?: number, setAdminTab?: (tab: any) => void, setCatalog?: Dispatch<SetStateAction<ProductDef[]>> }) {
    const [activeView, setActiveView] = useState<"recipes" | "production" | "operational" | "direct">("recipes")
    const [productionView, setProductionView] = useState<"ingredient" | "packaging">("ingredient")

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Minimal Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 px-1">
                <div className="space-y-1">
                    <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-900 tracking-tight">
                        Recetario
                    </h2>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full lg:w-auto">
                    {/* Modern Segmented Control */}
                    <div className="w-full sm:w-auto overflow-x-auto no-scrollbar py-6 -my-6 flex justify-center">
                        <div className="p-1.5 ml-1 bg-white/95 backdrop-blur-md rounded-full border border-slate-200/60 shadow-xl shadow-slate-200/50 flex relative min-w-max">
                            {[
                                { id: "recipes", icon: ChefHat, label: "Recetas" },
                                { id: "production", icon: Package, label: "Producción" },
                                { id: "operational", icon: Truck, label: "Operativos" },
                                { id: "direct", icon: ShoppingBag, label: "Productos Listos" }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveView(tab.id as any)}
                                    className={`
                                        relative px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2.5 z-10 whitespace-nowrap
                                        ${activeView === tab.id
                                            ? "text-white"
                                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
                                        }
                                    `}
                                >
                                    {activeView === tab.id && (
                                        <span className="absolute inset-0 bg-slate-900 rounded-full -z-10 shadow-lg shadow-slate-900/20 animate-in fade-in zoom-in duration-300" />
                                    )}
                                    <tab.icon size={16} strokeWidth={2.5} className={activeView === tab.id ? "text-indigo-300" : "text-slate-400"} />
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area - Clean Canvas */}
            <div className="min-h-[500px]">
                {activeView === "production" && (
                    <div className="mb-8 flex justify-center">
                        <div className="bg-slate-100/50 p-1 rounded-xl inline-flex">
                            <button
                                onClick={() => setProductionView("ingredient")}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${productionView === "ingredient"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-400 hover:text-slate-600"
                                    } `}
                            >
                                Ingredientes
                            </button>
                            <button
                                onClick={() => setProductionView("packaging")}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${productionView === "packaging"
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-400 hover:text-slate-600"
                                    } `}
                            >
                                Empaques
                            </button>
                        </div>
                    </div>
                )}

                {activeView === "recipes" ? (
                    <RecipesView salesResetEpoch={salesResetEpoch} setAdminTab={setAdminTab} />
                ) : activeView === "production" ? (
                    <IngredientsView type={productionView} />
                ) : activeView === "direct" ? (
                    <DirectProductsView setCatalog={setCatalog} />
                ) : (
                    <IngredientsView type="service" />
                )}
            </div>
        </div>
    )
}



function FinancialAnalysisModal({ recipe, onClose, salesResetEpoch = 0, setAdminTab }: { recipe: Recipe, onClose: () => void, salesResetEpoch?: number, setAdminTab?: (tab: any) => void }) {
    const [analysisData, setAnalysisData] = useState<{ salesHistory: any[] } | null>(null)
    const [chartsReady, setChartsReady] = useState(false)
    const [viewMode, setViewMode] = useState<'total' | 'unit'>('total')

    useEffect(() => {
        const timer = setTimeout(() => setChartsReady(true), 200)
        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        // Load Analysis Data (Sales History)
        const loadAnalysis = async () => {
            try {
                const token = JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
                const res = await fetch(`${API_URL} /recetario/recipes / ${recipe.id}/analysis`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    setAnalysisData(data)
                }
            } catch (e) {
                console.error("Failed to load recipe analysis", e)
            }
        }
        loadAnalysis()
    }, [recipe.id])

    // History Chart Data Preparation
    const historyChartData = useMemo(() => {
        // Merge recipe history and sales history by date
        const historyMap = new Map<string, any>()

        const getLocalDateKey = (date: Date) => {
            const y = date.getFullYear()
            const m = String(date.getMonth() + 1).padStart(2, '0')
            const d = String(date.getDate()).padStart(2, '0')
            return `${y}-${m}-${d}`
        }

        const getDateKeyFromStr = (dateStr: string) => {
            const d = new Date(dateStr)
            return getLocalDateKey(d)
        }

        // Add Recipe History Points
        recipe.history?.forEach(h => {
            const ts = new Date(h.date).getTime()
            if (ts < salesResetEpoch) return

            const dateKey = getDateKeyFromStr(h.date)

            // For display used simplified format, using local time to match sales
            const d = new Date(h.date)
            const displayDate = d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })

            if (!historyMap.has(dateKey)) {
                historyMap.set(dateKey, {
                    date: h.date,
                    displayDate,
                    originalDate: dateKey
                })
            }
            const entry = historyMap.get(dateKey)
            const hYield = recipe.yield || 1
            const price = viewMode === 'total' ? h.price : (h.price / hYield)
            const cost = viewMode === 'total' ? h.cost : (h.cost / hYield)
            entry.price = price
            entry.cost = cost
            entry.netProfit = price - cost
        })

        // Add Sales History Points
        // Input: Raw sales list { occurredAt, quantity, price }
        // We aggregate this on the client to match SalesSection logic exactly (using local browser time)
        analysisData?.salesHistory?.forEach(s => {
            const dateStr = s.occurredAt
            if (!dateStr) return

            const dateObj = new Date(dateStr)
            if (dateObj.getTime() < salesResetEpoch) return

            const dateKey = getLocalDateKey(dateObj)
            const displayDate = dateObj.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })

            if (!historyMap.has(dateKey)) {
                historyMap.set(dateKey, {
                    date: dateStr, // Keep one example date for the key
                    displayDate,
                    originalDate: dateKey,
                    unitsSold: 0,
                    revenue: 0
                })
            }
            const entry = historyMap.get(dateKey)

            // Critical: Match SalesSection logic for quantity normalization
            // const quantity = Math.max(1, Number(sale.quantity ?? 1) || 1)
            const qty = Math.max(1, Number(s.quantity ?? 1) || 1)

            entry.unitsSold = (entry.unitsSold || 0) + qty
            entry.revenue = (entry.revenue || 0) + (Number(s.price || 0) * qty)
        })

        // Convert map to array and sort
        return Array.from(historyMap.values()).sort((a, b) => a.originalDate.localeCompare(b.originalDate))

    }, [recipe.history, analysisData, viewMode])

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#FAFAFA] rounded-[2.5rem] shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-scale-in border border-white/20 ring-1 ring-black/5">
                {/* Modern Header */}
                <div className="px-8 py-6 bg-white/80 backdrop-blur-md border-b border-slate-100 flex justify-between items-center shrink-0 z-20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Historial de Receta</h2>
                            <p className="text-sm text-slate-500 font-medium">
                                Evolución para <span
                                    className="text-indigo-600 cursor-pointer hover:underline"
                                    onClick={() => {
                                        if (setAdminTab) {
                                            setAdminTab("products")
                                            onClose()
                                        }
                                    }}
                                >
                                    {recipe.linkedProduct?.name || recipe.name}
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {recipe.yield > 1 && (
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('total')}
                                    className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'total' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Total
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('unit')}
                                    className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'unit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Unidad
                                </button>
                            </div>
                        )}
                        <div className="w-[1px] h-8 bg-slate-100 mx-2 hidden sm:block"></div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="h-full flex flex-col">
                        {/* History View Redesign */}
                        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex-1 flex flex-col">
                            <div className="flex justify-end items-center mb-8">
                                <div className="bg-slate-100 px-4 py-2 rounded-full text-xs font-bold text-slate-600">
                                    {historyChartData.length} Registros
                                </div>
                            </div>

                            {historyChartData.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <TrendingUp className="text-slate-300" size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-700 mb-2">Sin datos suficientes</h3>
                                    <p className="text-slate-400 max-w-md">No hay historial de cambios en esta receta ni ventas registradas. Comienza a vender para ver la evolución.</p>
                                </div>
                            ) : (
                                <div className="flex-1 w-full min-h-0">
                                    {chartsReady ? (
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                            <ComposedChart data={historyChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis
                                                    dataKey="displayDate"
                                                    stroke="#94a3b8"
                                                    fontSize={11}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    dy={10}
                                                />
                                                <YAxis
                                                    yAxisId="left"
                                                    stroke="#94a3b8"
                                                    fontSize={11}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={(val) => `$${val}`}
                                                    dx={-10}
                                                />
                                                <YAxis
                                                    yAxisId="right"
                                                    orientation="right"
                                                    stroke="#6366f1"
                                                    fontSize={11}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    unit=" u"
                                                    dx={10}
                                                />
                                                <RechartsTooltip
                                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                                    cursor={{ fill: '#f8fafc' }}
                                                    formatter={(value: any, name: any) => {
                                                        if (name === 'Ventas (Uni)') return [Math.round(Number(value || 0)), name]
                                                        return [`$${Number(value || 0).toFixed(2)}`, name]
                                                    }}
                                                    itemSorter={(item) => {
                                                        if (item.name === 'Ventas (Uni)') return -3
                                                        if (item.name === 'Precio Venta') return -2
                                                        if (item.name === 'Costo Total') return -1
                                                        return 0
                                                    }}
                                                />
                                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                                <Area yAxisId="left" type="monotone" dataKey="netProfit" name="Utilidad Neta" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} strokeDasharray="5 5" connectNulls />
                                                <Area yAxisId="left" type="monotone" dataKey="price" name="Precio Venta" stroke="#6366f1" fillOpacity={0} strokeWidth={3} connectNulls />
                                                <Area yAxisId="left" type="monotone" dataKey="cost" name="Costo Total" stroke="#f43f5e" fillOpacity={0} strokeWidth={3} connectNulls />
                                                <Line yAxisId="right" type="monotone" dataKey="unitsSold" name="Ventas (Uni)" stroke="#94a3b8" strokeWidth={2} dot={{ r: 4, fill: '#94a3b8', strokeWidth: 2, stroke: '#fff' }} connectNulls />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-slate-400">
                                            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- SUB-COMPONENTS (Will extract later if too large) ---

function IngredientsView({ type = "ingredient" }: { type?: "ingredient" | "packaging" | "service" }) {
    const [ingredients, setIngredients] = useState<Ingredient[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [isEditing, setIsEditing] = useState<Ingredient | null>(null) // null = list, {id: 'new'} = create, {id: ...} = edit

    useEffect(() => {
        setIngredients([])
        fetchIngredients()
    }, [type])

    const fetchIngredients = async () => {
        try {
            const token = JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
            const res = await fetch(`${API_URL}/recetario/ingredients?type=${type}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setIngredients(data)
            }
        } catch (e) {
            console.error("Failed to load ingredients", e)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este ingrediente?")) return
        try {
            const token = JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
            await fetch(`${API_URL}/recetario/ingredients/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            })
            setIngredients(prev => prev.filter(i => i.id !== id))
        } catch (e) {
            console.error("Failed to delete", e)
        }
    }

    const getUnitLabel = (unit: string) => {
        const labels: Record<string, string> = {
            mes: "Mensual",
            ano: "Anual",
            envio: "Por Envío",
            hora: "Por Hora",
            servicio: "Por Servicio"
        }
        return labels[unit] || unit
    }

    const filtered = ingredients.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))

    if (isEditing) {
        return (
            <IngredientEditor
                initialData={isEditing.id === 'new' ? null : isEditing}
                defaultType={type}
                onCancel={() => setIsEditing(null)}
                onSave={() => { setIsEditing(null); fetchIngredients() }}
            />
        )
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder={type === "ingredient" ? "Buscar ingrediente..." : type === "packaging" ? "Buscar empaque..." : "Buscar servicio..."}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl border-none bg-white shadow-sm ring-1 ring-slate-100 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:shadow-md transition-all"
                    />
                </div>
                <button
                    onClick={() => setIsEditing({ id: 'new' } as any)}
                    className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3 rounded-full font-bold hover:bg-black transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2"
                >
                    <Plus size={20} />
                    {type === "ingredient" ? "Nuevo Ingrediente" : type === "packaging" ? "Nuevo Empaque" : "Nuevo Servicio"}
                </button>
            </div>

            {/* Desktop Table - Hidden on Mobile */}
            <div className="hidden md:block bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden ring-1 ring-slate-100">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50/50 text-slate-900 font-bold tracking-tight">
                        <tr>
                            <th className="px-6 py-4">Item</th>
                            <th className="px-6 py-4">{type === "service" ? "Costo Servicio" : "Costo Paquete"}</th>
                            <th className="px-6 py-4">{type === "service" ? "Frecuencia" : "Tamaño Paq."}</th>
                            {type !== "service" && <th className="px-6 py-4 text-emerald-600">Costo Unitario</th>}
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Search className="opacity-20" size={32} />
                                    </div>
                                    <p>No se encontraron items.</p>
                                </td>
                            </tr>
                        ) : filtered.map(item => {
                            const unitCost = item.cost / item.packageSize
                            return (
                                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl text-white shadow-sm ${type === 'ingredient' ? 'bg-orange-400' : type === 'packaging' ? 'bg-blue-400' : 'bg-purple-400'}`}>
                                                {type === 'ingredient' ? <ChefHat size={18} /> : type === 'packaging' ? <Package size={18} /> : <Truck size={18} />}
                                            </div>
                                            <span className="font-bold text-slate-700">{item.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-500">${Number(item.cost).toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        {type === "service" ? (
                                            <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-500 uppercase tracking-wide">
                                                {getUnitLabel(item.unit)}
                                            </span>
                                        ) : (
                                            <span className="font-medium text-slate-600">{Number(item.packageSize)} <small className="text-slate-400 uppercase">{item.unit}</small></span>
                                        )}
                                    </td>
                                    {type !== "service" && (
                                        <td className="px-6 py-4 font-mono font-bold text-emerald-600">
                                            ${unitCost.toFixed(4)} <span className="text-xs text-emerald-400 font-normal">/ {item.unit}</span>
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all px-2">
                                            <button onClick={() => setIsEditing(item)} className="p-2 hover:bg-white hover:shadow-md text-slate-400 hover:text-indigo-600 rounded-full transition-all">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-white hover:shadow-md text-slate-400 hover:text-rose-600 rounded-full transition-all">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card List - Visible on Mobile */}
            <div className="md:hidden space-y-4">
                {filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 bg-white rounded-3xl border border-slate-100 border-dashed">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Search className="opacity-20" size={32} />
                        </div>
                        <p>No se encontraron items.</p>
                    </div>
                ) : filtered.map(item => {
                    const unitCost = item.cost / item.packageSize
                    return (
                        <div key={item.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4 relative overflow-hidden">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl text-white shadow-sm ${type === 'ingredient' ? 'bg-orange-400' : type === 'packaging' ? 'bg-blue-400' : 'bg-purple-400'}`}>
                                        {type === 'ingredient' ? <ChefHat size={20} /> : type === 'packaging' ? <Package size={20} /> : <Truck size={20} />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-lg leading-tight">{item.name}</h4>
                                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{type === 'service' ? 'Servicio' : 'Insumo'}</span>
                                    </div>
                                </div>
                                {/* Actions absolute top right */}
                                <div className="flex gap-1">
                                    <button onClick={() => setIsEditing(item)} className="p-2 bg-slate-50 text-slate-500 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} className="p-2 bg-slate-50 text-slate-500 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-3 rounded-2xl">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">{type === "service" ? "Costo" : "Paquete"}</p>
                                    <p className="font-mono font-semibold text-slate-700">
                                        ${Number(item.cost).toFixed(2)}
                                        {type !== "service" && <span className="text-slate-400 font-normal text-xs"> / {item.packageSize} {item.unit}</span>}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">{type === "service" ? "Frecuencia" : "Costo Unit"}</p>
                                    {type === "service" ? (
                                        <span className="inline-block px-2 py-0.5 bg-slate-200 rounded text-xs font-bold text-slate-600 uppercase">
                                            {getUnitLabel(item.unit)}
                                        </span>
                                    ) : (
                                        <p className="font-mono font-bold text-emerald-600">
                                            ${unitCost.toFixed(4)} <span className="text-xs text-emerald-400 font-normal">/ {item.unit}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function IngredientEditor({ initialData, defaultType = "ingredient", onCancel, onSave }: { initialData: Ingredient | null, defaultType?: string, onCancel: () => void, onSave: () => void }) {
    const [form, setForm] = useState({
        name: initialData?.name || "",
        cost: initialData?.cost || 0,
        packageSize: initialData?.packageSize || 1000,
        unit: initialData?.unit || "g",
        type: initialData?.type || defaultType
    })
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const token = JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
            const url = initialData?.id
                ? `${API_URL}/recetario/ingredients/${initialData.id}`
                : `${API_URL}/recetario/ingredients`
            const method = initialData?.id ? "PUT" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(form)
            })

            if (res.ok) {
                onSave()
            } else {
                alert("Error al guardar")
            }
        } catch (error) {
            console.error(error)
            alert("Error de conexión")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="max-w-xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">{initialData ? "Editar Item" : (form.type === "packaging" ? "Nuevo Empaque" : form.type === "service" ? "Nuevo Servicio" : "Nuevo Ingrediente")}</h3>
                <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                    <X size={20} />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                    <input
                        required
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            {form.type === "service" ? "Costo del Servicio ($)" : "Costo del Paquete ($)"}
                        </label>
                        <input
                            required
                            type="number"
                            step="0.01"
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                            value={form.cost}
                            onChange={e => setForm({ ...form, cost: parseFloat(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            {form.type === "service" ? "Unidad de Cobro" : "Tamaño del Paquete"}
                        </label>
                        {form.type === "service" ? (
                            <select
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                value={form.unit}
                                onChange={e => setForm({ ...form, unit: e.target.value, packageSize: 1 })}
                            >
                                <option value="mes">Mensual</option>
                                <option value="ano">Anual</option>
                                <option value="envio">Por Envío</option>
                                <option value="hora">Por Hora</option>
                                <option value="servicio">Por Servicio</option>
                            </select>
                        ) : (
                            <div className="flex gap-2">
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                    value={form.packageSize}
                                    onChange={e => setForm({ ...form, packageSize: parseFloat(e.target.value) })}
                                />
                                <select
                                    className="px-2 py-2 rounded-xl border border-slate-200 bg-white text-slate-900"
                                    value={form.unit}
                                    onChange={e => setForm({ ...form, unit: e.target.value })}
                                >
                                    <option value="g">g</option>
                                    <option value="ml">ml</option>
                                    <option value="und">und</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {form.type !== "service" && (
                    <div className="bg-primary-50 p-4 rounded-xl flex items-center justify-between text-sm text-primary-900">
                        <span className="font-medium">Costo Calculado por Unidad ({form.unit}):</span>
                        <span className="font-bold text-lg">${(form.cost / (form.packageSize || 1)).toFixed(4)}</span>
                    </div>
                )}

                <div className="pt-4 flex justify-end gap-3">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">Cancelar</button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        {submitting ? "Guardando..." : form.type === "service" ? "Guardar Servicio" : form.type === "packaging" ? "Guardar Empaque" : "Guardar Ingrediente"}
                    </button>
                </div>
            </form>
        </div>
    )
}


function RecipesView({ salesResetEpoch = 0, setAdminTab }: { salesResetEpoch?: number, setAdminTab?: (tab: any) => void }) {
    const [recipes, setRecipes] = useState<Recipe[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isEditing, setIsEditing] = useState<Recipe | null>(null)
    const [analyzingRecipe, setAnalyzingRecipe] = useState<Recipe | null>(null)

    useEffect(() => {
        fetchRecipes()
    }, [])

    const fetchRecipes = async () => {
        try {
            setIsLoading(true)
            const token = JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
            const res = await fetch(`${API_URL}/recetario/recipes`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
                const data: Recipe[] = await res.json()
                // Do client-side calc if needed or trust backend
                const enriched = data.map(r => calculateRecipeTotals(r))
                setRecipes(enriched)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoading(false)
        }
    }


    const handleDeleteRecipe = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar esta receta?")) return
        try {
            const token = JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
            await fetch(`${API_URL}/recetario/recipes/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            })
            setRecipes(prev => prev.filter(r => r.id !== id))
        } catch (e) {
            console.error("Failed to delete recipe", e)
            alert("No se pudo eliminar la receta")
        }
    }

    const calculateRecipeTotals = (recipe: Recipe): Recipe => {
        const { totalCost, materialCost } = calculateRecipeCosts(recipe)

        const marginDecimal = (recipe.profitMargin || 30) / 100
        // Use Margin formula: Price = Cost / (1 - Margin)
        const denominator = 1 - marginDecimal
        const suggestedPrice = denominator > 0.01 ? totalCost / denominator : 0

        const grossProfit = suggestedPrice - materialCost
        const mc = calculateMC(suggestedPrice, materialCost)
        const mcPercent = calculateMCPercent(mc, suggestedPrice)

        // Unit calculations
        const unitYield = recipe.yield || 1
        return {
            ...recipe,
            totalCost,
            suggestedPrice,
            grossProfit,
            mc,
            mcPercent,
            materialCost,
            // We can add virtual properties if needed, but for now we'll calculate JSX side or just pass them
            unitCost: totalCost / unitYield,
            unitPrice: suggestedPrice / unitYield,
            yield: unitYield
        } as any
    }

    if (isEditing) {
        return (
            <RecipeEditor
                initialData={isEditing.id === 'new' ? null : isEditing}
                onCancel={() => setIsEditing(null)}
                onSave={() => { setIsEditing(null); fetchRecipes() }}
            />
        )
    }

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex justify-end">
                <button
                    onClick={() => setIsEditing({ id: 'new' } as any)}
                    className="bg-slate-900 text-white px-6 py-3 rounded-full font-bold hover:bg-black transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2"
                >
                    <Plus size={20} /> Nueva Receta
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-32 space-y-4">
                        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
                        <p className="text-slate-400 font-medium animate-pulse">Cargando recetario...</p>
                    </div>
                ) : recipes.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShoppingBag className="text-slate-300" size={40} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No hay recetas aún</h3>
                        <p className="text-slate-500">Comienza creando tu primera receta para calcular costos.</p>
                    </div>
                ) : recipes.map(recipe => (
                    <div key={recipe.id} className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-200/80 transition-all duration-300 group relative border border-transparent hover:border-indigo-100">
                        {/* Header & Actions */}
                        <div className="flex flex-col sm:flex-row gap-5 mb-6 relative">
                            {recipe.linkedProduct?.imageUrl && (
                                <div className="w-full sm:w-28 h-48 sm:h-28 shrink-0 rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-slate-50 group-hover:scale-[1.02] transition-transform duration-500 order-1 sm:order-none">
                                    <img
                                        src={recipe.linkedProduct.imageUrl}
                                        alt={recipe.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}
                            <div className="flex-1 min-w-0 pr-0 order-2 sm:order-none">
                                <div className="flex justify-between items-start gap-3">
                                    <div className="space-y-1.5 flex-1 p-2">
                                        <h3 className="font-display font-bold text-slate-800 text-xl leading-tight">{recipe.name}</h3>

                                        <div className="flex flex-wrap gap-2">
                                            {recipe.linkedProductId ? (
                                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1 w-fit">
                                                    <TrendingUp size={10} /> Enlazado
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1 w-fit">
                                                    Sin enlace
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-3 min-w-max">
                                        {/* Actions - Static Position */}
                                        <div className="flex gap-1 justify-end">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setAnalyzingRecipe(recipe) }}
                                                className="w-7 h-7 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all border border-emerald-100"
                                                title="Analizar Rentabilidad"
                                            >
                                                <TrendingUp size={12} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setIsEditing(recipe) }}
                                                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all border border-slate-100"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteRecipe(recipe.id) }}
                                                className="w-7 h-7 flex items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all border border-rose-100"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>

                                        <div className="text-right leading-none flex flex-col items-end">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Precio {recipe.yield > 1 ? 'Unidad' : 'Venta'}</p>
                                            <p className="text-xl font-bold text-slate-900 mb-1">${((recipe as any).unitPrice || recipe.suggestedPrice)?.toFixed(2)}</p>

                                            {/* Margin Badge Moved Here */}
                                            <div className="group/tooltip relative inline-flex">
                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md flex items-center gap-1 cursor-help hover:bg-slate-200 transition-colors">
                                                    {Number(recipe.profitMargin).toFixed(0)}% de ganancia <HelpCircle size={8} />
                                                </span>
                                                {/* Tooltip */}
                                                <div className="absolute top-full right-0 mt-2 w-48 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
                                                    <p className="font-bold mb-1 text-indigo-300">Margen Neto Objetivo</p>
                                                    <p className="mb-2 text-slate-300 leading-snug">Ganancia real después de TODOS los costos.</p>
                                                    <p className="text-[10px] opacity-70 border-t border-white/20 pt-1 mt-1">
                                                        <span className="font-bold text-indigo-300">Ej:</span> 30% significa ganar $3 libres por cada $10 vendidos.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Financial Dashboard Card - Harmonious Redesign */}
                        <div className="mt-6 pt-6 border-t border-slate-50">
                            <div className="grid grid-cols-2 gap-8">
                                {/* Left Column: Costs */}
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Costos {recipe.yield > 1 ? '(Unidad)' : ''}</p>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium">
                                            <span>Materiales</span>
                                            <span>${((recipe.materialCost || 0) / (recipe.yield || 1)).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] text-slate-400">
                                            <span>Gastos Op.</span>
                                            <span>+${(((recipe.totalCost || 0) - (recipe.materialCost || 0)) / (recipe.yield || 1)).toFixed(2)}</span>
                                        </div>
                                        <div className="pt-2 mt-1 border-t border-slate-50 flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-slate-600 uppercase">Total</span>
                                            <span className="text-lg font-bold text-rose-500 tracking-tight leading-none">${((recipe.totalCost || 0) / (recipe.yield || 1)).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Profitability */}
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3 text-right">Rentabilidad {recipe.yield > 1 ? '(Unidad)' : ''}</p>
                                    <div className="space-y-1">
                                        {/* Utilidad Bruta Row */}
                                        <div className="flex justify-between items-center text-[11px] font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-slate-500">Util. Bruta</span>
                                                {/* MC Badge - Micro Pill */}
                                                <div className="group/tooltip relative">
                                                    <div className={`cursor-help ${getHealthStatus(recipe.mcPercent || 0) === 'good' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                        <HelpCircle size={10} />
                                                    </div>
                                                    {/* Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none text-center">
                                                        <p className="font-bold mb-0.5">MC: {Math.round(recipe.mcPercent || 0)}%</p>
                                                        <p className="font-light opacity-80">Margen bruto sobre venta.</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-emerald-600 font-bold">+${((recipe.grossProfit || 0) / (recipe.yield || 1)).toFixed(2)}</span>
                                        </div>

                                        {/* Gastos Op Row */}
                                        <div className="flex justify-between items-center text-[11px] text-slate-400">
                                            <span>Gastos Op.</span>
                                            <span>-${(((recipe.totalCost || 0) - (recipe.materialCost || 0)) / (recipe.yield || 1)).toFixed(2)}</span>
                                        </div>

                                        {/* Utilidad Neta Row */}
                                        <div className="pt-2 mt-1 border-t border-slate-50 flex justify-between items-center">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-600 uppercase">Util. Neta</span>
                                            </div>
                                            <span className="text-lg font-bold text-emerald-500 tracking-tight leading-none">+${(((recipe.suggestedPrice || 0) - (recipe.totalCost || 0)) / (recipe.yield || 1)).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {analyzingRecipe && (
                <FinancialAnalysisModal
                    recipe={analyzingRecipe}
                    onClose={() => setAnalyzingRecipe(null)}
                    salesResetEpoch={salesResetEpoch}
                    setAdminTab={setAdminTab}
                />
            )}
        </div>
    )
}

// Helper type for the form
interface FormIngredient extends Partial<RecipeIngredient> {
    tempId: string
    _uiType?: 'material' | 'service'
}

function RecipeEditor({ initialData, onCancel, onSave }: { initialData: Recipe | null, onCancel: () => void, onSave: () => void }) {
    const [form, setForm] = useState<{
        name: string
        description: string
        profitMargin: number
        ingredients: FormIngredient[]
        linkedProductId: string
        yield: number
    }>({
        name: initialData?.name || "",
        description: initialData?.description || "",
        profitMargin: initialData?.profitMargin || 30, // Stores Margin %
        ingredients: initialData?.ingredients.map(ri => ({
            ...ri,
            tempId: Math.random().toString() // for key
        })) || [],
        linkedProductId: initialData?.linkedProductId || "",
        yield: initialData?.yield || 1
    })

    const [availableIngredients, setAvailableIngredients] = useState<Ingredient[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [submitting, setSubmitting] = useState(false)

    // Local state for smooth price editing
    const [manualPrice, setManualPrice] = useState("")
    const [isEditingPrice, setIsEditingPrice] = useState(false)
    const [viewMode, setViewMode] = useState<'total' | 'unit'>('total')

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = JSON.parse(localStorage.getItem("loyalty-auth") || "{ }").token
                const resIng = await fetch(`${API_URL}/recetario/ingredients?limit=1000`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (resIng.ok) {
                    const data = await resIng.json()
                    setAvailableIngredients(data)
                }

                const resProd = await fetch(`${API_URL}/loyalty/products?limit=100`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (resProd.ok) {
                    const data = await resProd.json()
                    setProducts(data.data || data)
                }
            } catch (e) {
                console.error("Failed to load initial data for editor", e)
            }
        }
        fetchData()
    }, [])

    const addIngredientRow = (type: 'material' | 'service') => {
        setForm(prev => ({
            ...prev,
            ingredients: [...prev.ingredients, {
                ingredientId: "",
                quantity: 0,
                tempId: Math.random().toString(),
                _uiType: type
            }]
        }))
    }

    const removeIngredientRow = (tempId: string) => {
        setForm(prev => ({
            ...prev,
            ingredients: prev.ingredients.filter(i => i.tempId !== tempId)
        }))
    }

    const updateIngredientRow = (tempId: string, field: string, value: any) => {
        setForm(prev => {
            const next = prev.ingredients.map(item => {
                if (item.tempId === tempId) {
                    return { ...item, [field]: value }
                }
                return item
            })
            return { ...prev, ingredients: next }
        })
    }

    // specific helpers for render
    const renderRow = (row: FormIngredient, type: 'material' | 'service') => {
        const selectedIng = availableIngredients.find(i => i.id === row.ingredientId)
        const rowCost = selectedIng ? (selectedIng.cost / selectedIng.packageSize) * (row.quantity || 0) : 0
        const options = availableIngredients.filter(i => {
            if (type === 'service') return i.type === 'service';
            return !i.type || i.type === 'ingredient' || i.type === 'packaging';
        });

        return (
            <tr key={row.tempId} className="group border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="py-1.5 px-2 w-[40%]">
                    <select
                        className="w-full px-2 py-1.5 rounded-md border border-transparent hover:border-slate-200 bg-transparent hover:bg-white text-slate-700 text-sm focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none appearance-none"
                        value={row.ingredientId || ""}
                        onChange={e => updateIngredientRow(row.tempId, 'ingredientId', e.target.value)}
                        required
                    >
                        <option value="">Seleccionar...</option>
                        {options.map(ing => (
                            <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                        ))}
                    </select>
                </td>
                <td className="py-1.5 px-2 w-[20%]">
                    <div className="relative">
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                step="0.01"
                                className="w-full px-2 py-1.5 rounded-md border border-transparent hover:border-slate-200 bg-transparent hover:bg-white text-slate-900 text-sm font-medium focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none text-right placeholder:text-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                                value={row.quantity || ""}
                                onChange={e => updateIngredientRow(row.tempId, 'quantity', e.target.value)}
                                required
                            />
                            <span className="text-xs font-bold text-slate-400 w-8">
                                {selectedIng?.unit || '-'}
                            </span>
                        </div>
                    </div>
                </td>
                <td className="py-1.5 px-2 w-[15%] text-right">
                    <span className="text-xs text-slate-400 font-mono">
                        {selectedIng ? `$${(selectedIng.cost / selectedIng.packageSize).toFixed(2)}` : '-'}
                    </span>
                </td>
                <td className="py-1.5 px-2 w-[15%] text-right font-mono font-medium text-slate-700 text-sm">
                    ${rowCost.toFixed(2)}
                </td>
                <td className="py-1.5 px-2 w-[5%] text-center">
                    <button
                        type="button"
                        onClick={() => removeIngredientRow(row.tempId)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <X size={14} />
                    </button>
                </td>
            </tr>
        )
    }

    // Calculations
    const costs = form.ingredients.reduce((acc, row) => {
        const ing = availableIngredients.find(i => i.id === row.ingredientId)
        if (!ing) return acc
        const costPerUnit = ing.cost / ing.packageSize
        const rowCost = costPerUnit * (Number(row.quantity) || 0)

        acc.total += rowCost
        if (ing.type === "service") {
            acc.services += rowCost
        } else {
            acc.materials += rowCost
        }
        return acc
    }, { total: 0, materials: 0, services: 0 })

    const inputPercentage = Math.min(form.profitMargin, 99.9)
    const marginDecimal = inputPercentage / 100
    const denominator = 1 - marginDecimal
    const suggestedPrice = denominator > 0.001 ? costs.total / denominator : 0

    const unitPrice = suggestedPrice / (form.yield || 1)

    const netProfit = suggestedPrice - costs.total
    const grossProfit = suggestedPrice - costs.materials

    // Sync manual price input when calculations change (and not editing)
    useEffect(() => {
        if (!isEditingPrice) {
            const displayPrice = viewMode === 'total' ? suggestedPrice : unitPrice;
            setManualPrice(displayPrice ? displayPrice.toFixed(2) : "0.00")
        }
    }, [suggestedPrice, unitPrice, isEditingPrice, viewMode])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const token = JSON.parse(localStorage.getItem("loyalty-auth") || "{ }").token
            const url = initialData?.id
                ? `${API_URL}/recetario/recipes/${initialData.id}`
                : `${API_URL}/recetario/recipes`
            const method = initialData?.id ? "PUT" : "POST"

            const payload = {
                name: form.name,
                description: form.description,
                profitMargin: inputPercentage,
                linkedProductId: form.linkedProductId || null,
                yield: Number(form.yield) || 1,
                ingredients: form.ingredients
                    .filter(i => i.ingredientId && (i.quantity || 0) > 0)
                    .map(i => ({ ingredientId: i.ingredientId, quantity: Number(i.quantity) })),
                history: initialData?.history || []
            }
            if (initialData?.id) {
                payload.history.push({
                    date: new Date().toISOString(),
                    cost: costs.total,
                    price: suggestedPrice,
                    margin: inputPercentage
                })
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                // Sync Product Price if linked
                if (form.linkedProductId) {
                    const linkedProduct = products.find(p => p.id === form.linkedProductId)
                    if (linkedProduct) {
                        // Optimistically update product price to match recipe price
                        // We use the full product object to be safe with PUT
                        // Note: If you want to use PATCH, ensure backend supports it. Here we assume PUT wraps full object or Partial is accepted as merge.
                        // Based on secure.ts updateProduct uses PUT.
                        // We will try to fetch specific product details if the list is partial, but for now we rely on the list.
                        const normalizedUnitPrice = roundUsd(unitPrice)
                        const productPayload = { ...linkedProduct, price: normalizedUnitPrice }

                        // We intentionally don't await this to keep UI snappy, or we can await if we want to ensure consistency
                        // Let's await to avoid race conditions if user immediately goes to products
                        await fetch(`${API_URL}/loyalty/products/${form.linkedProductId}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                            body: JSON.stringify(productPayload)
                        }).catch(err => console.error("Failed to sync product price", err))
                    }
                }

                onSave()
            } else {
                alert("Error al guardar")
            }
        } catch (e) {
            console.error(e)
            alert("Error de conexión")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="w-full min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 animate-fade-in">
            {/* Top Navigation / Header Module */}
            <div className="max-w-7xl mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
                            <ChefHat size={20} />
                        </span>
                        {initialData ? "Editar Receta" : "Crear Nueva Receta"}
                    </h2>
                    <p className="text-sm text-slate-500 font-medium ml-12">Diseña la composición y rentabilidad de tu producto.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-white hover:shadow-sm hover:text-slate-900 transition-all text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20 active:scale-95 transition-all text-sm flex items-center gap-2"
                    >
                        {submitting ? <div className="w-4 h-4 border-2 border-slate-500 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                        Guardar Receta
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* LEFT COLUMN: Input Modules */}
                <div className="lg:col-span-8 space-y-6">

                    {/* Module 1: Core Information */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre de la Receta</label>
                                <input
                                    required
                                    className="w-full text-lg font-bold text-slate-900 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-3 outline-none transition-all placeholder:text-slate-300"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="Ej. Brownie de Nuez"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Producto Vinculado</label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none font-medium text-slate-700 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl pl-4 pr-10 py-3 outline-none transition-all cursor-pointer"
                                        value={form.linkedProductId}
                                        onChange={e => {
                                            const prodId = e.target.value
                                            const prod = products.find(p => String(p.id) === prodId)
                                            if (prod) {
                                                setForm({
                                                    ...form,
                                                    linkedProductId: prodId,
                                                    name: prod.name
                                                })
                                            } else {
                                                setForm({ ...form, linkedProductId: prodId })
                                            }
                                        }}
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {products.map((p: any) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <TrendingUp className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rendimiento (Unidades)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        className="w-full font-bold text-slate-900 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-3 outline-none transition-all placeholder:text-slate-300"
                                        value={form.yield}
                                        onChange={e => setForm({ ...form, yield: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">Unidades</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Module 2: Composition (Ingredients & Expenses) */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative min-h-[500px] flex flex-col">

                        {/* Internal Header */}
                        <div className="px-6 py-5 border-b border-slate-50 bg-white flex justify-between items-center sticky top-0 z-10">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                                    <Package size={18} />
                                </div>
                                Composición y Costos
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => addIngredientRow('material')}
                                    className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <Plus size={14} /> Material
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addIngredientRow('service')}
                                    className="px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors flex items-center gap-1"
                                >
                                    <Plus size={14} /> Gasto
                                </button>
                            </div>
                        </div>

                        {/* List Area */}
                        <div className="p-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3">Item / Concepto</th>
                                        <th className="px-4 py-3 w-32">Cantidad</th>
                                        <th className="px-4 py-3 text-right w-28">Costo U.</th>
                                        <th className="px-4 py-3 text-right w-28">Subtotal</th>
                                        <th className="px-2 py-3 w-12 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {/* Material Rows */}
                                    {form.ingredients
                                        .filter(row => {
                                            if ((row as any)._uiType && (row as any)._uiType === 'material') return true;
                                            if ((row as any)._uiType && (row as any)._uiType !== 'material') return false;
                                            const ing = availableIngredients.find(i => i.id === row.ingredientId)
                                            return !ing || ing.type !== "service"
                                        })
                                        .map(row => renderRow(row, 'material'))
                                    }

                                    {/* Separator / Header for Expenses if any exist */}
                                    {form.ingredients.some(row => (row as any)._uiType === 'service' || availableIngredients.find(i => i.id === row.ingredientId)?.type === 'service') && (
                                        <tr className="bg-amber-50/30 border-t border-b border-amber-100/50">
                                            <td colSpan={5} className="px-6 py-2 text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-2">
                                                <Calculator size={12} /> Gastos Operativos
                                            </td>
                                        </tr>
                                    )}

                                    {/* Service Rows */}
                                    {form.ingredients
                                        .filter(row => {
                                            if ((row as any)._uiType && (row as any)._uiType === 'service') return true;
                                            if ((row as any)._uiType && (row as any)._uiType !== 'service') return false;
                                            const ing = availableIngredients.find(i => i.id === row.ingredientId)
                                            return ing && ing.type === "service"
                                        })
                                        .map(row => renderRow(row, 'service'))
                                    }

                                    {form.ingredients.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <Package className="text-slate-300" size={24} />
                                                </div>
                                                <p className="text-slate-400 text-sm font-medium">Empieza agregando materiales o gastos.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Module 3: Notes (Collapsible or small) */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Notas / Instrucciones</label>
                        <textarea
                            className="w-full bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-4 py-3 outline-none transition-all text-sm resize-none"
                            rows={2}
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            placeholder="Detalles adicionales..."
                        />
                    </div>

                </div>

                {/* RIGHT COLUMN: Sticky Intelligence Card */}
                <div className="lg:col-span-4 lg:sticky lg:top-8 space-y-6">

                    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-6 relative overflow-hidden">
                        {/* Decorative Gradient Background */}
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800">Rentabilidad</h3>
                            {form.yield > 1 && (
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('total')}
                                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'total' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Total
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('unit')}
                                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'unit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Unidad
                                    </button>
                                </div>
                            )}
                        </div>



                        {/* Improved Profitability Container */}
                        <div className="space-y-6">

                            {/* 1. Margin Control Input */}
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                <div className="flex justify-between items-end mb-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Margen Objetivo</label>
                                    <span className="text-2xl font-black text-indigo-600 tracking-tight leading-none">
                                        {Number(form.profitMargin).toFixed(1)}<span className="text-sm font-bold text-indigo-300 ml-0.5">%</span>
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0" max="99"
                                    value={form.profitMargin}
                                    onChange={e => setForm({ ...form, profitMargin: Number(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500 transition-all"
                                />
                            </div>

                            {/* 2. Unit Context Analysis - REMOVED AS REQUESTED */}

                            {/* 2. Hero Price (The Target) */}
                            <div className="text-center py-4 relative">
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Precio de Venta Sugerido</p>
                                <div className="flex justify-center items-start gap-1">
                                    <span className="text-lg font-medium text-slate-400 mt-1">$</span>
                                    <input
                                        type="number"
                                        step="0.50"
                                        className="text-5xl font-black text-slate-800 tracking-tighter bg-transparent text-center w-64 outline-none border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-500 transition-all placeholder:text-slate-200"
                                        placeholder="0.00"
                                        value={manualPrice}
                                        onFocus={() => setIsEditingPrice(true)}
                                        onBlur={() => {
                                            setIsEditingPrice(false)
                                            if (suggestedPrice) setManualPrice(suggestedPrice.toFixed(2))
                                        }}
                                        onChange={(e) => {
                                            setManualPrice(e.target.value)
                                            const val = parseFloat(e.target.value)
                                            if (!isNaN(val) && val > 0) {
                                                const totalVal = viewMode === 'total' ? val : val * (form.yield || 1);
                                                const newMargin = calculateMarginFromPrice(costs.total, totalVal)
                                                const safeMargin = Math.min(newMargin, 99.9)
                                                setForm(prev => ({ ...prev, profitMargin: safeMargin }))
                                            }
                                        }}
                                    />
                                </div>
                                <p className="text-center text-xs text-slate-400 font-medium mt-2">
                                    Precio manual recalcula el margen
                                </p>
                            </div>
                        </div>

                        {/* 3. Logical Waterfall Breakdown */}
                        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 space-y-1">
                            {/* Display Values Helper */}
                            {(() => {
                                const currentYield = viewMode === 'total' ? 1 : (form.yield || 1);
                                const dPrice = viewMode === 'total' ? suggestedPrice : unitPrice;
                                const dMaterials = (costs.materials) / currentYield;
                                const dGross = (grossProfit) / currentYield;
                                const dServices = (costs.services) / currentYield;
                                const dNet = (netProfit) / currentYield;

                                return (
                                    <>
                                        {/* Revenue */}
                                        <div className="flex justify-between items-center pb-2 mb-1 border-b border-slate-200/50 border-dashed">
                                            <span className="text-xs font-bold text-slate-500">Precio {viewMode === 'total' ? 'Receta' : 'Unidad'}</span>
                                            <span className="text-sm font-bold text-slate-700">${dPrice.toFixed(2)}</span>
                                        </div>

                                        {/* Materials */}
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                                Costo Materiales
                                            </span>
                                            <span className="text-rose-500 font-medium">-${dMaterials.toFixed(2)}</span>
                                        </div>

                                        {/* Gross Profit */}
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                Utilidad Bruta
                                            </span>
                                            <div className="text-right flex items-center gap-2">
                                                <div className="group/tooltip relative">
                                                    <span className="text-[10px] font-bold text-emerald-600/70 bg-emerald-50 px-1 rounded cursor-help flex items-center gap-1">
                                                        MC {denominator > 0.001 ? ((grossProfit / suggestedPrice) * 100).toFixed(0) : 0}% <HelpCircle size={8} />
                                                    </span>
                                                    {/* Tooltip */}
                                                    <div className="absolute bottom-full right-0 mb-2 w-48 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
                                                        <p className="font-bold mb-1 text-emerald-300">Margen de Contribución</p>
                                                        <p className="mb-2 text-slate-300 leading-snug">Dinero disponible tras pagar materiales.</p>
                                                        <p className="text-[10px] opacity-70 border-t border-white/20 pt-1 mt-1">
                                                            <span className="font-bold text-emerald-300">Ej:</span> Venta $10 - Material $4 = MC $6 (60%).
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-emerald-600 font-medium">${dGross.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Operations */}
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                                Gastos Op.
                                            </span>
                                            <span className="text-rose-500 font-medium">-${dServices.toFixed(2)}</span>
                                        </div>

                                        {/* Net Profit */}
                                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200">
                                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Utilidad Neta</span>
                                            <span className="text-2xl font-black text-emerald-500 tracking-tight">+${dNet.toFixed(2)}</span>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    )
}
function DirectProductsView({ setCatalog }: { setCatalog?: Dispatch<SetStateAction<ProductDef[]>> }) {
    const [products, setProducts] = useState<any[]>([])
    const [recipes, setRecipes] = useState<Recipe[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editCost, setEditCost] = useState("")
    const [editPrice, setEditPrice] = useState("")
    const [editMargin, setEditMargin] = useState("") // New
    const [saving, setSaving] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newProductForm, setNewProductForm] = useState({ name: "", price: "", cost: "", margin: "30", stock: "" }) // New

    const normalizeProductPrice = (product: any) => {
        const rawPrice = Number(product?.price)
        if (!Number.isFinite(rawPrice)) return product
        const rounded = roundUsd(rawPrice)
        if (rounded === rawPrice) return product
        return { ...product, price: rounded }
    }
    const normalizeProductList = (items: any[]) => items.map(normalizeProductPrice)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const token = JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
            const headers = { Authorization: `Bearer ${token}` }

            const [prodRes, recipeRes] = await Promise.all([
                fetch(`${API_URL}/loyalty/products`, { headers }),
                fetch(`${API_URL}/recetario/recipes`, { headers })
            ])

            if (prodRes.ok && recipeRes.ok) {
                const prodData = await prodRes.json()
                const recipeData = await recipeRes.json()
                setProducts(normalizeProductList(prodData))
                setRecipes(recipeData)
            }
        } catch (e) {
            console.error("Failed to load direct products data", e)
        } finally {
            setLoading(false)
        }
    }

    const linkedProductIds = useMemo(() => {
        const set = new Set<string>()
        recipes.forEach(r => {
            if (r.linkedProductId) set.add(r.linkedProductId)
        })
        return set
    }, [recipes])

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            // Keep only products NOT linked to a recipe
            if (linkedProductIds.has(p.id)) return false
            return p.name.toLowerCase().includes(searchTerm.toLowerCase())
        })
    }, [products, linkedProductIds, searchTerm])

    const handleCreateProduct = async () => {
        setSaving(true)
        try {
            const token = JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
            const rawPrice = parseFloat(newProductForm.price)
            const price = roundUsd(rawPrice)
            const payload = {
                name: newProductForm.name,
                price,
                cost: parseFloat(newProductForm.cost) || 0,
                stock: parseInt(newProductForm.stock) || 0,
                points: 0, // Default
                imageUrl: "",
                description: "Producto Listo"
            }

            const res = await fetch(`${API_URL}/loyalty/products`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                const created = await res.json()
                const normalizedCreated = normalizeProductPrice(created)
                setProducts(prev => [normalizedCreated, ...prev])
                if (setCatalog) {
                    setCatalog(prev => [...prev, normalizedCreated])
                }
                setShowCreateModal(false)
                setNewProductForm({ name: "", price: "", cost: "", margin: "30", stock: "" })
            }
        } catch (e) {
            console.error("Failed create", e)
        } finally {
            setSaving(false)
        }
    }



    const handleSaveRow = async (product: any) => {
        const newCost = parseFloat(editCost)
        const rawPrice = parseFloat(editPrice)
        if (isNaN(newCost) || newCost < 0) return
        if (isNaN(rawPrice) || rawPrice < 0) return
        const newPrice = roundUsd(rawPrice)

        setSaving(true)
        try {
            const token = JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
            const res = await fetch(`${API_URL}/loyalty/products/${product.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ cost: newCost, price: newPrice })
            })

            if (res.ok) {
                setProducts(prev => prev.map(p => p.id === product.id ? { ...p, cost: newCost, price: newPrice } : p))
                if (setCatalog) {
                    setCatalog(prev => prev.map(p => p.id === product.id ? { ...p, cost: newCost, price: newPrice } : p))
                }
                setEditingId(null)
            }
        } catch (e) {
            console.error("Failed to save row", e)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 max-w-xl">
                    <h3 className="text-2xl font-bold mb-2">Productos sin Receta</h3>
                    <p className="text-indigo-200">
                        Gestiona costos y precios de productos terminados (bebidas, snacks, etc).
                        Estos datos alimentan tus reportes financieros.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="relative z-10 px-6 py-3 bg-white text-indigo-900 font-bold rounded-xl hover:bg-indigo-50 transition-colors shadow-lg shadow-indigo-900/20 flex items-center gap-2"
                >
                    <Plus size={20} />
                    Nuevo Producto
                </button>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border-none bg-white shadow-sm ring-1 ring-slate-100 text-slate-900 focus:ring-2 focus:ring-indigo-500/50 transition-all ml-1"
                />
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden ring-1 ring-slate-100">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/80 text-slate-900 font-bold">
                        <tr>
                            <th className="px-8 py-5">Producto</th>
                            <th className="px-8 py-5">Precio Venta</th>
                            <th className="px-8 py-5">Costo Unitario</th>
                            <th className="px-8 py-5">Margen</th>
                            <th className="px-8 py-5 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="py-20 text-center text-slate-400">Loading...</td>
                            </tr>
                        ) : filteredProducts.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-20 text-center text-slate-400">
                                    No hay productos sin receta que coincidan.
                                </td>
                            </tr>
                        ) : filteredProducts.map(p => {
                            const cost = p.cost || 0
                            const price = p.price || 0
                            const margin = calculateMarginFromPrice(cost, price)
                            const isEditing = editingId === p.id

                            return (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-4">
                                        <div className="font-bold text-slate-800">{p.name}</div>
                                        {p.active === false && <span className="text-xs text-rose-500 font-bold uppercase">Inactivo</span>}
                                    </td>
                                    <td className="px-8 py-4">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400 font-mono">$</span>
                                                <input
                                                    type="number"
                                                    className="w-24 px-3 py-1.5 rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-slate-900"
                                                    value={editPrice}
                                                    onChange={e => {
                                                        const val = e.target.value
                                                        setEditPrice(val)
                                                        const p = parseFloat(val)
                                                        const c = parseFloat(editCost)
                                                        if (!isNaN(p) && !isNaN(c) && p > 0) {
                                                            setEditMargin(calculateMarginFromPrice(c, p).toFixed(1))
                                                        }
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="font-mono text-slate-600">${price.toFixed(2)}</div>
                                        )}
                                    </td>
                                    <td className="px-8 py-4">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400 font-mono">$</span>
                                                <input
                                                    autoFocus
                                                    type="number"
                                                    className="w-24 px-3 py-1.5 rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-slate-900"
                                                    value={editCost}
                                                    onChange={e => {
                                                        const val = e.target.value
                                                        setEditCost(val)
                                                        const c = parseFloat(val)
                                                        const m = parseFloat(editMargin)
                                                        if (!isNaN(c) && !isNaN(m)) {
                                                            const mDec = m / 100
                                                            if (mDec < 1) setEditPrice((c / (1 - mDec)).toFixed(2))
                                                        }
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSaveRow(p)
                                                        if (e.key === 'Escape') setEditingId(null)
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="font-mono font-bold text-slate-700">
                                                ${cost.toFixed(2)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-8 py-4">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    className="w-16 px-2 py-1.5 rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-slate-900 text-xs"
                                                    value={editMargin}
                                                    onChange={e => {
                                                        const val = e.target.value
                                                        setEditMargin(val)
                                                        const m = parseFloat(val)
                                                        const c = parseFloat(editCost)
                                                        if (!isNaN(m) && !isNaN(c)) {
                                                            const mDec = m / 100
                                                            if (mDec < 1) setEditPrice((c / (1 - mDec)).toFixed(2))
                                                        }
                                                    }}
                                                />
                                                <span className="text-slate-400 font-bold text-xs">%</span>
                                            </div>
                                        ) : (
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${margin < 30 ? 'bg-rose-50 text-rose-600' :
                                                margin > 50 ? 'bg-emerald-50 text-emerald-600' :
                                                    'bg-amber-50 text-amber-600'
                                                }`}>
                                                {margin.toFixed(1)}%
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        {isEditing ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleSaveRow(p)}
                                                    disabled={saving}
                                                    className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors"
                                                >
                                                    <Save size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setEditingId(p.id)
                                                    setEditCost((p.cost || 0).toString())
                                                    setEditPrice(roundUsd(p.price ?? 0).toFixed(2))
                                                    setEditMargin(calculateMarginFromPrice(p.cost || 0, p.price || 0).toFixed(1))
                                                }}
                                                className="px-4 py-2 rounded-xl bg-slate-50 text-slate-600 font-bold text-xs hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                            >
                                                Editar
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in shadow-2xl">
                    <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] relative animate-scale-in border border-white/20">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Nuevo Producto Listo</h3>
                                <p className="text-slate-500 text-sm font-medium">Define el nombre y datos financieros básicos.</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Nombre Comercial</label>
                                <input
                                    autoFocus
                                    type="text"
                                    className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-inner"
                                    placeholder="Ej. Coca Cola Lata 355ml"
                                    value={newProductForm.name}
                                    onChange={e => setNewProductForm({ ...newProductForm, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Costo Unitario ($)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-4 font-mono font-bold text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                        placeholder="0.00"
                                        value={newProductForm.cost}
                                        onChange={e => {
                                            const c = e.target.value
                                            const m = parseFloat(newProductForm.margin)
                                            let p = newProductForm.price
                                            if (!isNaN(parseFloat(c)) && !isNaN(m)) {
                                                const mDec = m / 100
                                                if (mDec < 1) p = (parseFloat(c) / (1 - mDec)).toFixed(2)
                                            }
                                            setNewProductForm({ ...newProductForm, cost: c, price: p })
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Margen Deseado (%)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-4 font-mono font-bold text-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                        placeholder="30"
                                        value={newProductForm.margin}
                                        onChange={e => {
                                            const m = e.target.value
                                            const c = parseFloat(newProductForm.cost)
                                            let p = newProductForm.price
                                            if (!isNaN(parseFloat(m)) && !isNaN(c)) {
                                                const mDec = parseFloat(m) / 100
                                                if (mDec < 1) p = (c / (1 - mDec)).toFixed(2)
                                            }
                                            setNewProductForm({ ...newProductForm, margin: m, price: p })
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100/50 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Precio sugerido de venta</p>
                                    <p className="text-3xl font-black text-indigo-900 tabular-nums">${parseFloat(newProductForm.price || "0").toFixed(2)}</p>
                                </div>
                                <div className="p-3 bg-white rounded-xl shadow-sm border border-indigo-100">
                                    <DollarSign className="text-indigo-600" size={24} />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-10">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateProduct}
                                disabled={!newProductForm.name || saving}
                                className="flex-[2] py-4 rounded-2xl font-bold bg-slate-900 text-white hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50 disabled:grayscale active:scale-95"
                            >
                                {saving ? "Guardando..." : "Registrar Producto"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
