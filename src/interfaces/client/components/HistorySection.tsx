import { useEffect, useRef, useState } from "react"
import { ArrowRight, Clock3, Crown, Gift, History, QrCode, ShoppingBag, Sparkles, Trophy } from "lucide-react"
import type { ActivityItem } from "../types"
import type { CouponActivity, PaymentTicket } from "../../../types/app"
import { activityTime, buildActivityKey, formatActivityDate } from "../utils"

type HistorySectionProps = {
    activityItems: ActivityItem[]
    lastSeen: number
    onViewTicket: (ticket: PaymentTicket) => void
    onLoadMore?: () => void
    hasMore?: boolean
    loadingMore?: boolean
}

const MOBILE_COLLAPSED_HISTORY_MAX_HEIGHT_PX = 280
const DESKTOP_COLLAPSED_HISTORY_MAX_HEIGHT_PX = 420
const LG_BREAKPOINT_PX = 1024

const getCollapsedHistoryMaxHeight = () => (
    typeof window !== "undefined" && window.innerWidth < LG_BREAKPOINT_PX
        ? MOBILE_COLLAPSED_HISTORY_MAX_HEIGHT_PX
        : DESKTOP_COLLAPSED_HISTORY_MAX_HEIGHT_PX
)

export function HistorySection({
    activityItems,
    lastSeen,
    onViewTicket,
    onLoadMore,
    hasMore,
    loadingMore,
}: HistorySectionProps) {
    const hasActivity = activityItems.length > 0
    const listRef = useRef<HTMLDivElement | null>(null)
    const [isExpanded, setIsExpanded] = useState(false)
    const [canToggleHeight, setCanToggleHeight] = useState(false)
    const [collapsedMaxHeight, setCollapsedMaxHeight] = useState(getCollapsedHistoryMaxHeight)
    const [contentHeight, setContentHeight] = useState(getCollapsedHistoryMaxHeight)

    useEffect(() => {
        const updateCollapsedMaxHeight = () => {
            setCollapsedMaxHeight(getCollapsedHistoryMaxHeight())
        }

        updateCollapsedMaxHeight()
        window.addEventListener("resize", updateCollapsedMaxHeight)

        return () => {
            window.removeEventListener("resize", updateCollapsedMaxHeight)
        }
    }, [])

    useEffect(() => {
        const element = listRef.current
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
    }, [activityItems, hasMore, loadingMore, collapsedMaxHeight])

    const animatedMaxHeight = canToggleHeight
        ? isExpanded
            ? Math.max(contentHeight + 1, collapsedMaxHeight)
            : collapsedMaxHeight
        : contentHeight

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h3 className="font-bold text-[#6A3A30] text-sm uppercase tracking-wide flex items-center gap-2">
                    <History size={16} className="text-[#6A3A30]/40" /> Historial
                </h3>
            </div>

            <div className="bg-[#FFFBEA] rounded-[2rem] border border-[#6A3A30]/10 shadow-sm overflow-hidden flex flex-col">
                {!hasActivity ? (
                    <div className="p-8 text-center">
                        <div className="w-12 h-12 bg-[#6A3A30]/5 rounded-full flex items-center justify-center mx-auto mb-3 text-[#6A3A30]/20">
                            <History size={20} />
                        </div>
                        <p className="text-xs font-bold text-[#6A3A30]/40">Sin actividad reciente</p>
                    </div>
                ) : (
                    <>
                        <div
                            ref={listRef}
                            style={{ maxHeight: `${animatedMaxHeight}px` }}
                            className="overflow-hidden divide-y divide-[#6A3A30]/5 transition-[max-height] duration-500 ease-out"
                        >
                            {activityItems.map((item) => {
                                const isPending = item.type === "pending"
                                const isCoupon = item.type === "coupon"
                                const isTicket = item.type === "ticket"
                                const dateLabel = formatActivityDate(item)
                                const time = activityTime(item)
                                const isNew = time > lastSeen

                                if (isCoupon) {
                                    const couponItem = item as CouponActivity
                                    // Determine subtype for custom styling
                                    const isSend = couponItem.direction === 'out' && couponItem.peer
                                    const isReceive = couponItem.activityType === 'RECEIVE' || (couponItem.direction === 'in' && couponItem.peer)
                                    const isLevelUp = couponItem.kind === 'level'
                                    const isWin = couponItem.activityType === 'WIN'
                                    const isLogin = couponItem.activityType === 'LOGIN'

                                    return (

                                        <div
                                            key={buildActivityKey(item)}
                                            className={`p-4 flex items-start gap-4 transition-all duration-300 group relative overflow-hidden ${isWin
                                                ? "bg-gradient-to-r from-amber-50/80 to-transparent border-l-4 border-amber-400 shadow-sm"
                                                : isLevelUp
                                                    ? "bg-gradient-to-r from-violet-50/80 to-transparent border-l-4 border-violet-400 shadow-sm"
                                                    : "hover:bg-[#6A3A30]/5 border-l-4 border-transparent"
                                                }`}
                                        >
                                            {isNew && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]" />}
                                            {/* Background highlight for Win/Level */}
                                            {(isWin || isLevelUp) && (
                                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                                    <Sparkles size={48} className={`${isLevelUp ? "text-violet-500" : "text-amber-500"} rotate-12`} />
                                                </div>
                                            )}

                                            {/* Icon Avatar */}
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-white z-10 ${isSend ? "bg-sky-50 text-sky-600" :
                                                isReceive ? "bg-violet-100 text-violet-600" :
                                                    isWin ? "bg-amber-100 text-amber-600 ring-2 ring-amber-100 ring-offset-1" :
                                                        isLevelUp ? "bg-violet-100 text-violet-600 ring-2 ring-violet-100 ring-offset-1" :
                                                            "bg-[#6A3A30]/10 text-[#6A3A30]/50" // Use/Burn changed to calmer gray
                                                }`}>
                                                {isSend ? <ArrowRight size={18} /> :
                                                    isReceive ? <Gift size={18} /> :
                                                        isWin ? <Trophy size={18} /> :
                                                            isLevelUp ? <Crown size={18} /> :
                                                                isLogin ? <Clock3 size={18} /> :
                                                                    <QrCode size={18} />}
                                            </div>

                                            <div className="flex-1 min-w-0 pt-0.5 z-10">
                                                {/* Title Row */}
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <p className={`text-xs font-bold truncate pr-2 ${isWin ? "text-amber-900" : isLevelUp ? "text-violet-900" : "text-[#6A3A30]"}`}>
                                                        {couponItem.title}
                                                    </p>
                                                    <span className="text-[10px] text-[#6A3A30]/40 shrink-0">{dateLabel}</span>
                                                </div>

                                                {/* Subtitle / Context Row to make it elegant */}
                                                {isSend && couponItem.peer ? (
                                                    <p className="text-[11px] text-[#6A3A30]/60 font-medium flex items-center gap-1">
                                                        Enviaste un regalo a <span className="text-[#6A3A30] font-bold">@{couponItem.peer.split('@')[0]}</span>
                                                    </p>
                                                ) : isReceive ? (
                                                    <p className="text-[11px] text-[#6A3A30]/60 font-medium flex items-center gap-1">
                                                        {couponItem.peer ? (
                                                            <>Regalo recibido de <span className="text-[#6A3A30] font-bold">@{couponItem.peer.split('@')[0]}</span></>
                                                        ) : (
                                                            <>Recibiste un regalo</>
                                                        )}
                                                    </p>
                                                ) : isWin ? (
                                                    <p className="text-[11px] text-amber-600 font-bold flex items-center gap-1">
                                                        ¡Premio Ganado! <Sparkles size={10} />
                                                    </p>
                                                ) : isLevelUp ? (
                                                    <p className="text-[11px] text-violet-600 font-bold flex items-center gap-1">
                                                        ¡Nueva categoría alcanzada! <Crown size={10} />
                                                    </p>
                                                ) : isLogin ? (
                                                    <p className="text-[11px] text-[#6A3A30]/60 font-medium">
                                                        Inicio de sesión
                                                    </p>
                                                ) : (
                                                    <p className="text-[11px] text-[#6A3A30]/60 font-medium">Canjeado en tienda</p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                }

                                if (isTicket) {
                                    const ticket = item as PaymentTicket
                                    const ticketStatus = ticket.status === "confirmed" ? "Pedido Confirmado" : "Pedido Pendiente"

                                    const rawId = String(ticket.id)
                                    // If ID is not a pure number, it's a grouped sale
                                    const isSale = Number.isNaN(Number(ticket.id))
                                    const displayId = isSale ? "Compra en Tienda" : `Ticket #${rawId.padStart(6, '0')}`

                                    return (
                                        <div key={buildActivityKey(item)} className="p-4 flex items-center gap-3 hover:bg-[#6A3A30]/5 transition-colors relative group">
                                            {isNew && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]" />}
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-white shadow-sm ${ticket.status === "confirmed" ? "bg-[#1A864D]/10 text-[#1A864D]" : "bg-amber-50 text-amber-500"
                                                }`}>
                                                <ShoppingBag size={18} />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-[#6A3A30] truncate">
                                                    {displayId}
                                                </p>
                                                <p className="text-[10px] font-medium text-[#6A3A30]/60">
                                                    {dateLabel} • {ticketStatus}
                                                </p>
                                            </div>

                                            <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                <span className={`text-[10px] font-black px-2 py-1 rounded-md ${ticket.status === "confirmed" ? "text-[#1A864D] bg-[#1A864D]/10" : "text-amber-600 bg-amber-50"
                                                    }`}>
                                                    {ticket.points} pts
                                                </span>
                                                <button
                                                    onClick={() => onViewTicket(ticket)}
                                                    className="px-3 py-1.5 rounded-lg bg-[#6A3A30]/10 text-[#6A3A30] text-[10px] font-bold hover:bg-[#6A3A30]/20 transition-colors mt-1"
                                                >
                                                    Ver detalle
                                                </button>
                                            </div>
                                        </div>
                                    )
                                }

                                // Regular Purchase Item
                                return (
                                    <div key={buildActivityKey(item)} className="p-4 flex items-center gap-3 hover:bg-[#6A3A30]/5 transition-colors relative">
                                        {isNew && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]" />}
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-white shadow-sm ${isPending ? "bg-amber-50 text-amber-500" : "bg-[#1A864D]/10 text-[#1A864D]"
                                            }`}>
                                            {isPending ? <Clock3 size={18} /> : <ShoppingBag size={18} />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-[#6A3A30] truncate">
                                                {item.name}
                                            </p>
                                            <p className="text-[10px] font-medium text-[#6A3A30]/60">
                                                {dateLabel} • Compra
                                            </p>
                                        </div>

                                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                            {isPending ? (
                                                <>
                                                    <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                                                        Pendiente
                                                    </span>
                                                    {(item as any).code && (
                                                        <span className="text-[10px] font-mono font-bold text-[#6A3A30]/40">
                                                            ID: {(item as any).code.slice(0, 8)}...
                                                        </span>
                                                    )}
                                                </>
                                            ) : item.points === 0 ? (
                                                <span className="text-[10px] font-bold text-[#6A3A30]/40 bg-[#6A3A30]/5 px-2 py-1 rounded-md mb-1">
                                                    Cupón regalo (0 pts)
                                                </span>
                                            ) : (
                                                <span className="text-xs font-black text-[#1A864D]">
                                                    +{item.points}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        {canToggleHeight && (
                            <div className="border-t border-[#6A3A30]/10 px-4 py-3">
                                <button
                                    type="button"
                                    onClick={() => setIsExpanded((prev) => !prev)}
                                    className="w-full px-4 py-2 rounded-xl text-xs font-bold bg-[#6A3A30]/10 text-[#6A3A30] hover:bg-[#6A3A30]/20 transition-colors"
                                >
                                    {isExpanded ? "Mostrar menos" : "Mostrar más"}
                                </button>
                            </div>
                        )}
                        {hasMore && onLoadMore && (
                            <div className="border-t border-[#6A3A30]/10 p-4">
                                <button
                                    type="button"
                                    onClick={onLoadMore}
                                    disabled={loadingMore}
                                    className={`w-full px-4 py-3 rounded-xl text-xs font-bold transition-all shadow-sm ${loadingMore
                                        ? "bg-[#FFFBEA] border border-[#6A3A30]/10 text-[#6A3A30]/40 cursor-not-allowed"
                                        : "bg-[#6A3A30] text-[#FFFBEA] hover:bg-[#5a3128] hover:shadow-md active:scale-95"
                                        }`}
                                >
                                    {loadingMore ? "Cargando..." : "Cargar más"}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
