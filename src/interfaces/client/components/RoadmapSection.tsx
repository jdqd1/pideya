import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Circle, Gift, Trophy } from "lucide-react"
import type { LoyaltyRulesResponse } from "../../../types/loyalty"
import type { UserCouponsState } from "../../../types/userState"

type RoadmapSectionProps = {
    ladder: LoyaltyRulesResponse["rewardLadder"]
    currentState: UserCouponsState
}

const MOBILE_COLLAPSED_ROADMAP_MAX_HEIGHT_PX = 360
const DESKTOP_COLLAPSED_ROADMAP_MAX_HEIGHT_PX = 460
const LG_BREAKPOINT_PX = 1024

const getCollapsedRoadmapMaxHeight = () => (
    typeof window !== "undefined" && window.innerWidth < LG_BREAKPOINT_PX
        ? MOBILE_COLLAPSED_ROADMAP_MAX_HEIGHT_PX
        : DESKTOP_COLLAPSED_ROADMAP_MAX_HEIGHT_PX
)

const formatRewardValue = (reward: LoyaltyRulesResponse["rewardLadder"][number]) => {
    if (reward.kind === "percent") return `${reward.value ?? 0}%`
    if (reward.kind === "bogo") return "2x1"
    return reward.capUsd ? `Hasta $${reward.capUsd}` : "Gratis"
}

export function RoadmapSection({
    ladder,
    currentState,
}: RoadmapSectionProps) {
    const roadmapRef = useRef<HTMLDivElement | null>(null)
    const [isExpanded, setIsExpanded] = useState(false)
    const [canToggleHeight, setCanToggleHeight] = useState(false)
    const [collapsedMaxHeight, setCollapsedMaxHeight] = useState(getCollapsedRoadmapMaxHeight)
    const [contentHeight, setContentHeight] = useState(getCollapsedRoadmapMaxHeight)

    const sortedLadder = useMemo(
        () => [...(ladder ?? [])].sort((a, b) => Number(a.threshold) - Number(b.threshold)),
        [ladder],
    )

    const nextIndex = useMemo(
        () => sortedLadder.findIndex((item) => currentState.totalPoints < item.threshold),
        [sortedLadder, currentState.totalPoints],
    )

    const completedCount = nextIndex === -1 ? sortedLadder.length : nextIndex
    const nextReward = nextIndex >= 0 ? sortedLadder[nextIndex] : null
    const previousThreshold = nextIndex > 0 ? sortedLadder[nextIndex - 1]?.threshold ?? 0 : 0
    const nextProgress = nextReward
        ? Math.min(
            100,
            Math.max(
                0,
                ((currentState.totalPoints - previousThreshold) / Math.max(1, nextReward.threshold - previousThreshold)) * 100,
            ),
        )
        : 100

    useEffect(() => {
        const updateCollapsedMaxHeight = () => {
            setCollapsedMaxHeight(getCollapsedRoadmapMaxHeight())
        }

        updateCollapsedMaxHeight()
        window.addEventListener("resize", updateCollapsedMaxHeight)

        return () => {
            window.removeEventListener("resize", updateCollapsedMaxHeight)
        }
    }, [])

    useEffect(() => {
        const element = roadmapRef.current
        if (!element) return

        const updateCanToggle = () => {
            const measuredHeight = element.scrollHeight
            setContentHeight(measuredHeight)
            const shouldToggle = measuredHeight > collapsedMaxHeight + 8
            setCanToggleHeight(shouldToggle)
            if (!shouldToggle) setIsExpanded(false)
        }

        updateCanToggle()

        const frame = window.requestAnimationFrame(updateCanToggle)
        const observer = typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(updateCanToggle)
            : null

        observer?.observe(element)
        window.addEventListener("resize", updateCanToggle)

        return () => {
            window.cancelAnimationFrame(frame)
            observer?.disconnect()
            window.removeEventListener("resize", updateCanToggle)
        }
    }, [sortedLadder, currentState.totalPoints, collapsedMaxHeight])

    const animatedMaxHeight = canToggleHeight
        ? isExpanded
            ? Math.max(contentHeight + 1, collapsedMaxHeight)
            : collapsedMaxHeight
        : contentHeight

    return (
        <section className="w-full max-w-full overflow-hidden space-y-4">
            <div className="flex min-w-0 items-center justify-between gap-3 px-1">
                <div className="flex min-w-0 items-center gap-2">
                    <Trophy size={18} className="shrink-0 text-[#6A3A30]/60" />
                    <h3 className="truncate text-sm font-black uppercase tracking-wide text-[#6A3A30]">Cadena de premios</h3>
                </div>
                <span className="shrink-0 rounded-full bg-[#6A3A30]/10 px-2.5 py-1 text-[10px] font-black text-[#6A3A30]/70">
                    {completedCount}/{sortedLadder.length}
                </span>
            </div>

            <div className="w-full max-w-full overflow-hidden rounded-2xl border border-[#6A3A30]/10 bg-[#FFFBEA]/70">
                <div className="border-b border-[#6A3A30]/10 px-4 py-5 sm:px-5">
                    <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wide text-[#6A3A30]/45">Avance</p>
                            <p className="mt-1 text-2xl font-black leading-none text-[#6A3A30]">{currentState.totalPoints} pts</p>
                        </div>
                        {nextReward && (
                            <div className="shrink-0 text-right">
                                <p className="text-[10px] font-black uppercase tracking-wide text-[#6A3A30]/45">Siguiente</p>
                                <p className="mt-1 text-sm font-black text-[#1A864D]">{nextReward.threshold} pts</p>
                            </div>
                        )}
                    </div>
                    {nextReward && (
                        <div className="mt-4">
                            <div className="h-2 overflow-hidden rounded-full bg-[#6A3A30]/10">
                                <div
                                    className="h-full rounded-full bg-[#1A864D] transition-all duration-500"
                                    style={{ width: `${nextProgress}%` }}
                                />
                            </div>
                            <p className="mt-2 text-xs font-bold text-[#6A3A30]/60">
                                Faltan {Math.max(0, nextReward.threshold - currentState.totalPoints)} pts para {nextReward.title}
                            </p>
                        </div>
                    )}
                </div>

                <div
                    ref={roadmapRef}
                    style={{ maxHeight: `${animatedMaxHeight}px` }}
                    className="relative overflow-hidden transition-[max-height] duration-500 ease-out"
                >
                    <ol className="relative m-0 list-none p-0">
                        {sortedLadder.map((reward, idx) => {
                            const unlocked = currentState.totalPoints >= reward.threshold
                            const isNext = idx === nextIndex
                            const isLast = idx === sortedLadder.length - 1

                            return (
                                <li key={`${reward.threshold}-${reward.title}-${idx}`} className="relative grid min-w-0 grid-cols-[48px_1fr] gap-0">
                                    {!isLast && (
                                        <div
                                            className={`absolute left-[23px] top-10 h-full w-0.5 ${unlocked ? "bg-[#1A864D]" : "bg-[#6A3A30]/12"}`}
                                            aria-hidden="true"
                                        />
                                    )}
                                    <div className="relative flex justify-center pt-4">
                                        <div
                                            className={`z-10 flex h-8 w-8 items-center justify-center rounded-full border-4 border-[#FFFBEA] shadow-sm ${unlocked
                                                ? "bg-[#1A864D] text-[#FFFBEA]"
                                                : isNext
                                                    ? "bg-[#6A3A30] text-[#FFFBEA]"
                                                    : "bg-[#EFE5D2] text-[#6A3A30]/40"
                                                }`}
                                        >
                                            {unlocked ? <Check size={15} strokeWidth={3} /> : isNext ? <Gift size={14} /> : <Circle size={12} />}
                                        </div>
                                    </div>

                                    <div className={`min-w-0 border-b border-[#6A3A30]/10 py-4 pr-3 sm:pr-4 ${isLast ? "border-b-0" : ""}`}>
                                        <div className="flex min-w-0 items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className={`truncate text-sm font-black ${unlocked ? "text-[#1A864D]" : isNext ? "text-[#6A3A30]" : "text-[#6A3A30]/65"}`}>
                                                    {reward.title}
                                                </p>
                                                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-[#6A3A30]/55">
                                                    {reward.subtitle}
                                                </p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${unlocked
                                                    ? "bg-[#1A864D]/10 text-[#1A864D]"
                                                    : isNext
                                                        ? "bg-[#6A3A30] text-[#FFFBEA]"
                                                        : "bg-[#6A3A30]/8 text-[#6A3A30]/45"
                                                    }`}>
                                                    {reward.threshold} pts
                                                </span>
                                                <p className="mt-1 text-[10px] font-black text-[#6A3A30]/45">
                                                    {formatRewardValue(reward)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            )
                        })}
                    </ol>
                </div>

                {canToggleHeight && (
                    <button
                        type="button"
                        onClick={() => setIsExpanded((prev) => !prev)}
                        className="w-full border-t border-[#6A3A30]/10 bg-[#6A3A30]/5 px-4 py-3 text-xs font-black text-[#6A3A30] transition-colors hover:bg-[#6A3A30]/10"
                    >
                        {isExpanded ? "Mostrar menos" : "Ver cadena completa"}
                    </button>
                )}
            </div>
        </section>
    )
}
