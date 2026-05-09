import { Ticket, X } from "lucide-react"
import type { LevelDefinition } from "../../../../types/loyalty"
import { expandMonthlyCoupons } from "../../utils"

type LevelBenefitsModalProps = {
    active: boolean
    onClose: () => void
    levelLadder: LevelDefinition[]
    currentLevelId?: string
}

export function LevelBenefitsModal({
    active,
    onClose,
    levelLadder,
    currentLevelId,
}: LevelBenefitsModalProps) {
    const sorted = [...levelLadder].sort((a, b) => a.minPoints - b.minPoints)

    return (
        <div
            className={`fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-6 transition-all duration-300 ${active ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
        >
            <div className="absolute inset-0 bg-[#6A3A30]/60 backdrop-blur-sm" onClick={onClose} />

            <div
                className={`bg-[#FFFBEA] w-full max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] max-h-[85vh] flex flex-col relative z-10 shadow-2xl transition-all duration-500 ${active ? "translate-y-0" : "translate-y-full sm:translate-y-20"
                    }`}
            >
                <div className="p-6 border-b border-[#6A3A30]/10 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-[#6A3A30]">Niveles y Beneficios</h3>
                        <p className="text-xs text-[#6A3A30]/60 font-medium">Desbloquea ventajas acumulando puntos</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-[#6A3A30]/5 rounded-full text-[#6A3A30]/40 hover:text-[#6A3A30] transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-4">
                    {sorted.map((level) => {
                        const isCurrent = currentLevelId === level.id
                        const color = level.badge?.color || "#1A864D"
                        const monthlyCoupons = expandMonthlyCoupons(level.perks)

                        return (
                            <div key={level.id} className={`p-5 rounded-3xl border transition-all duration-300 ${isCurrent
                                ? "border-[#6A3A30]/30 bg-[#6A3A30]/10 ring-2 ring-[#6A3A30]/5 shadow-lg shadow-[#6A3A30]/5"
                                : "border-[#6A3A30]/10 bg-[#6A3A30]/5"}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2.5">
                                        <span className="px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-white shadow-sm" style={{ backgroundColor: color }}>
                                            {level.name}
                                        </span>
                                        {isCurrent && (
                                            <span className="text-[10px] font-black text-[#6A3A30] bg-[#6A3A30]/10 px-2.5 py-1 rounded-lg border border-[#6A3A30]/10">
                                                Actual
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs font-black text-[#6A3A30]/40 tracking-tight">{level.minPoints} pts</span>
                                </div>
                                {/* Etiquetas de Beneficios */}
                                <div className="flex flex-wrap gap-2.5 mt-2">
                                    {monthlyCoupons.length ? monthlyCoupons.map((c, idx) => (
                                        <span key={`${level.id}-${idx}`} className="px-3 py-1.5 bg-[#1A864D]/10 rounded-xl text-[10px] font-black text-[#1A864D] border border-[#1A864D]/20 flex items-center gap-2 shadow-sm">
                                            <Ticket size={12} strokeWidth={3} />
                                            {c.percent}% · {c.expiresInDays}d
                                        </span>
                                    )) : (
                                        <span className="px-3 py-1.5 bg-[#6A3A30]/5 rounded-xl text-[10px] font-bold text-[#6A3A30]/40 border border-[#6A3A30]/10 border-dashed">
                                            Sube de nivel para beneficios
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
