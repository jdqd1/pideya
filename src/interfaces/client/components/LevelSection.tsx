import { Gift, TrendingUp } from "lucide-react"
import type { UserLevelState } from "../../../types/userState"
import { Cake } from "lucide-react" // Placeholder icon, can be swapped for specific level icons if available

type LevelSectionProps = {
    levelState: UserLevelState
    onViewBenefits: () => void
}

export function LevelSection({ levelState, onViewBenefits }: LevelSectionProps) {
    const current = levelState?.currentLevel
    if (!current) return null

    const next = levelState.nextLevel
    const points = Number(levelState.pointsInWindow ?? 0)
    const start = current.minPoints
    const end = next ? next.minPoints : Math.max(points, start + 1)
    const span = Math.max(end - start, 1)
    const progress = Math.min(1, Math.max(0, (points - start) / span))
    const pointsToNext = Math.max(0, end - points)

    // Color del nivel (Dynamic Accent)
    // Default to a green color if not found, to match the theme
    const accent = current.badge?.color || "#1A864D"

    return (
        <div className="w-full flex justify-center py-4">
            <div
                className="relative w-full max-w-sm rounded-[3rem] overflow-hidden p-6 shadow-xl transition-all duration-500 hover:shadow-2xl group"
                style={{
                    background: `linear-gradient(135deg, #FFFBEA 0%, ${accent}25 100%)`, // Stronger gradient
                    boxShadow: `0 20px 40px -10px ${accent}33`,
                    borderColor: `${accent}33`,
                    borderWidth: '1px'
                }}
            >
                {/* Decorative Background Elements - Enhanced opacity */}
                <div
                    className="absolute -right-12 -top-12 h-64 w-64 rounded-full blur-3xl opacity-20 pointer-events-none"
                    style={{ backgroundColor: accent }}
                />
                <div
                    className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full blur-3xl opacity-20 pointer-events-none"
                    style={{ backgroundColor: accent }}
                />

                <div className="relative z-10 flex flex-col items-center text-center">

                    {/* Icon Circle */}
                    <div className="mb-2 relative">
                        {/* Pulse Effect */}
                        <div
                            className="absolute inset-0 rounded-full opacity-30 animate-pulse"
                            style={{ backgroundColor: accent }}
                        />

                        <div
                            className="h-28 w-28 rounded-full bg-[#FFFBEA] shadow-lg border-4 flex items-center justify-center relative z-10"
                            style={{ borderColor: `${accent}25` }}
                        >
                            <Cake size={48} style={{ color: accent }} className="drop-shadow-sm" />
                        </div>

                        {/* Level Badge Pill - Fixed Text */}
                        <div
                            className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full shadow-lg border-2 border-[#FFFBEA] z-20 group-hover:scale-105 transition-transform"
                            style={{ backgroundColor: accent }}
                        >
                            <span className="text-[11px] font-black uppercase tracking-wider text-[#FFFBEA] whitespace-nowrap">
                                {current.name}
                            </span>
                        </div>
                    </div>

                    {/* Subtitle Only (removed title) */}
                    <div className="mt-6 mb-6 px-4">
                        <p className="text-sm font-semibold text-[#6A3A30]/70 leading-relaxed">
                            ¡Compra tus productos favoritos para ganar puntos y subir de nivel!
                        </p>
                    </div>

                    {/* Progress Section */}
                    <div className="w-full mb-8 bg-white/80 backdrop-blur-md rounded-3xl p-5 border border-[#6A3A30]/10 shadow-sm">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <div className="text-left">
                                <p className="text-[10px] font-bold text-[#6A3A30]/40 uppercase tracking-wider mb-0.5">
                                    TU PROGRESO
                                </p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black" style={{ color: accent }}>
                                        {points.toLocaleString()}
                                    </span>
                                    <span className="text-sm font-bold text-[#6A3A30]/40">
                                        / {(next?.minPoints ?? end).toLocaleString()} pts
                                    </span>
                                </div>
                            </div>

                            {/* Trend Icon */}
                            <div className="h-10 w-10 rounded-full bg-[#FFFBEA] flex items-center justify-center border border-[#6A3A30]/10 shadow-sm">
                                <TrendingUp size={18} className="text-[#1A864D]" />
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-4 w-full rounded-full bg-[#6A3A30]/5 overflow-hidden mb-3 inner-shadow">
                            <div
                                className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                                style={{
                                    width: `${progress * 100}%`,
                                    backgroundColor: accent
                                }}
                            >
                                <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_2s_infinite] translate-x-[-100%]" />
                            </div>
                        </div>

                        <p className="text-xs font-medium text-[#6A3A30]/60">
                            Te faltan <span className="font-bold text-[#6A3A30]">{pointsToNext.toLocaleString()} puntos</span> para el siguiente nivel
                        </p>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={onViewBenefits}
                        className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-95 group relative overflow-hidden"
                        style={{ backgroundColor: accent, boxShadow: `0 10px 25px -5px ${accent}66` }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:animate-[shimmer_1.5s_infinite]" />
                        <span className="text-sm font-bold text-[#FFFBEA] relative z-10">
                            Ver Mis Recompensas
                        </span>
                        <Gift size={18} className="text-[#FFFBEA] relative z-10 group-hover:rotate-12 transition-transform" />
                    </button>

                </div>
            </div>
        </div>
    )
}
