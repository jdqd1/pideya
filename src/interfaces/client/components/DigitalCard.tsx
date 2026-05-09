import { useEffect, useState } from "react"
import { CheckCircle2, Crown, Gift, Trophy } from "lucide-react"
import type { LoyaltyRulesResponse } from "../../../types/loyalty"
import type { AuthUser, UserCouponsState, UserLevelState } from "../../../types/userState"

type DigitalCardProps = {
    user: AuthUser | null
    punchSlots: number
    punchesFilled: number
    nextReward: LoyaltyRulesResponse["rewardLadder"][number] | null
    currentState: UserCouponsState
    levelState: UserLevelState
    showRewardAnimation: boolean
    punchPopVersion: number
}

export function DigitalCard({
    user,
    punchSlots,
    punchesFilled,
    nextReward,
    currentState,
    levelState,
    showRewardAnimation,
    punchPopVersion,
}: DigitalCardProps) {
    const [popActive, setPopActive] = useState(false)
    const justFilledIndex = Math.max(Math.min(punchSlots - 1, punchesFilled - 1), 0)

    // Usamos el color del nivel para teñir la tarjeta oscura
    const accent = levelState.currentLevel?.badge?.color || "#1A864D"
    const isCardFull = punchesFilled >= punchSlots

    useEffect(() => {
        if (!punchPopVersion) return
        setPopActive(true)
        const timer = window.setTimeout(() => setPopActive(false), 650)
        return () => clearTimeout(timer)
    }, [punchPopVersion])

    return (
        <div className="w-full max-w-md mx-auto lg:max-w-full group">
            <div
                className={`relative overflow-hidden rounded-[2rem] transition-all duration-500 perspective-1000 ${showRewardAnimation || isCardFull
                    ? "shadow-[0_25px_60px_-12px_rgba(106,58,48,0.5)] scale-[1.01]"
                    : "shadow-[0_20px_40px_-10px_rgba(106,58,48,0.25)] hover:shadow-[0_30px_60px_-15px_rgba(106,58,48,0.35)]"
                    }`}
                style={{
                    // Fondo oscuro base (Brown) mezclado dinámicamente con el color del nivel
                    background: `linear-gradient(135deg, ${accent}cc 0%, #6A3A30 50%, #4a2820 100%)`
                }}
            >
                {/* Capas de Textura y Ruido para realismo */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.08] mix-blend-overlay" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

                {/* Glow dinámico basado en el color del nivel */}
                <div
                    className="absolute -top-[100px] -right-[100px] w-[300px] h-[300px] rounded-full blur-[80px] opacity-40 mix-blend-screen pointer-events-none"
                    style={{ backgroundColor: accent }}
                />

                <div className="relative z-10 p-8 flex flex-col justify-between min-h-[260px]">

                    {/* Header de la Tarjeta */}
                    <div className="flex justify-between items-start mb-6">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <div className="px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
                                    <Crown size={10} className="text-[#FFFBEA]" />
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FFFBEA]/90">Krums Club</span>
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-[#FFFBEA] tracking-tight drop-shadow-md capitalize">
                                {(user as any)?.name?.split(" ")?.[0]?.toLowerCase() || "Invitado"}
                            </h3>
                            <p className="text-[10px] font-medium text-[#FFFBEA]/60 font-mono tracking-wider">
                                MEMBER ID: {(user as any)?.id?.slice(0, 8).toUpperCase() || "00000"}
                            </p>
                        </div>

                        {/* Badge de Nivel Integrado */}
                        <div className="text-right">
                            <div
                                className="inline-flex flex-col items-center justify-center w-12 h-12 rounded-xl backdrop-blur-md border border-white/20 shadow-lg"
                                style={{ backgroundColor: `${accent}40` }} // 40 hex es 25% opacidad
                            >
                                <Trophy size={18} className="text-[#FFFBEA] drop-shadow-sm mb-0.5" />
                                <span className="text-[8px] font-black text-[#FFFBEA] uppercase leading-none">
                                    NIV {levelState.currentLevel?.name?.match(/\d+/)?.[0] || ""}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Slots de Progreso - Ahora brillantes sobre fondo oscuro */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <p className="text-[10px] font-bold text-[#FFFBEA]/50 uppercase tracking-widest">Tarjeta de Sellos</p>
                            <p className="text-[10px] font-bold text-[#FFFBEA]/90">{punchesFilled} / {punchSlots}</p>
                        </div>

                        <div className="flex justify-between items-center gap-2">
                            {Array.from({ length: punchSlots }).map((_, index) => {
                                const filled = index < punchesFilled
                                const isFinal = index === punchSlots - 1
                                const shouldPop = popActive && index === justFilledIndex
                                const isNext = index === punchesFilled

                                return (
                                    <div key={index} className="flex-1 relative group flex flex-col items-center gap-2">
                                        <div
                                            className={`w-full aspect-square rounded-full flex items-center justify-center transition-all duration-500 border relative overflow-hidden ${filled
                                                ? "bg-[#FFFBEA] border-[#FFFBEA] text-[#6A3A30] shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-100"
                                                : isNext
                                                    ? "bg-white/10 border-white/30 text-white/50 scale-105 animate-pulse"
                                                    : "bg-black/20 border-white/10 text-white/20 scale-95"
                                                } ${shouldPop ? "animate-bounce" : ""} ${isFinal ? `border-${accent} shadow-lg` : ""}`}
                                            style={isFinal && filled ? { borderColor: accent, boxShadow: `0 0 20px ${accent}` } : {}}
                                        >
                                            {/* Brillo interno */}
                                            {filled && <div className="absolute inset-0 bg-gradient-to-br from-white to-[#FFFBEA]" />}

                                            <div className="relative z-10">
                                                {filled ? (
                                                    <CheckCircle2 size={isFinal ? 18 : 14} className={isFinal ? "text-[#1A864D]" : "text-[#6A3A30]"} />
                                                ) : isFinal ? (
                                                    <Gift size={16} style={{ color: accent }} />
                                                ) : (
                                                    <span className="text-[10px] font-bold">{index + 1}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Footer Card */}
                    <div className="flex items-center justify-between bg-black/20 -mx-8 -mb-8 px-8 py-4 border-t border-white/5 backdrop-blur-sm">
                        <div>
                            <p className="text-[9px] font-bold text-[#FFFBEA]/40 uppercase tracking-wider mb-0.5">Siguiente Premio</p>
                            <div className="flex items-center gap-2 text-[#FFFBEA]/90">
                                {nextReward ? (
                                    <span className="text-xs font-bold truncate max-w-[180px]">{nextReward.title}</span>
                                ) : (
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold">¡Tarjeta Completa!</span>
                                        <span className="text-[9px] font-medium text-[#FFFBEA]/60 leading-tight">pronto agregaremos más premios</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-[#FFFBEA]/40 uppercase tracking-wider">Saldo Total</span>
                            <span className="text-sm font-black text-[#FFFBEA]">{currentState.totalPoints} pts</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
