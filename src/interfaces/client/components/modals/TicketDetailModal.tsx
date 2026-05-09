import { useEffect, useRef, useState } from "react"
import { MessageCircle, Ticket, X, Trash2 } from "lucide-react"
import type { PaymentTicket } from "../../../../types/app"
import { formatExchangeRateLabel, formatVesLabel, getCurrencyAmounts, resolveHistoricalExchangeRate } from "../../../../utils/currency"

type TicketDetailModalProps = {
    ticket: PaymentTicket | null
    onClose: () => void
    onCancel?: (id: number) => Promise<void>
    onChat: (ticketId?: string) => void
    formatPrice: (value: number) => string
    exchangeRate?: number | null
}

export function TicketDetailModal({
    ticket,
    onClose,
    onCancel,
    onChat,
    formatPrice,
    exchangeRate
}: TicketDetailModalProps) {
    const [isScrollable, setIsScrollable] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const node = scrollRef.current
        if (node) {
            const check = () => {
                setIsScrollable(node.scrollHeight > node.clientHeight)
            }
            check()
            window.addEventListener('resize', check)
            const observer = new MutationObserver(check)
            observer.observe(node, { childList: true, subtree: true })

            return () => {
                window.removeEventListener('resize', check)
                observer.disconnect()
            }
        }
    }, [ticket])

    if (!ticket) return null
    const isPending = ticket.status !== "confirmed"
    const ticketExchangeRate = resolveHistoricalExchangeRate(ticket.exchangeRate ?? null, exchangeRate ?? null, ticket.exchangeRateDate ?? ticket.createdAt)

    // Calculate totals in the ticket's native currency.
    const totalNative = ticket.amount || 0
    const hasPoints = (ticket.points || 0) > 0

    const readAmounts = (value: number) =>
        getCurrencyAmounts(value, ticket.currency, ticketExchangeRate)

    const formatBs = (value: number) => {
        const amounts = readAmounts(value)
        return amounts.ves !== null ? formatVesLabel(amounts.ves) : "---"
    }

    const formatUsd = (value: number) => {
        const amounts = readAmounts(value)
        return amounts.usd !== null ? formatPrice(amounts.usd) : null
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#6A3A30]/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-[420px] bg-[#FFFBEA] rounded-3xl shadow-[0_20px_50px_rgba(106,58,48,0.2)] overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-[#6A3A30]/10">

                {/* Header - Clean & Minimal */}
                <div className="px-6 pt-6 pb-2 shrink-0 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${isPending ? 'bg-rose-500 animate-pulse' : 'bg-[#1A864D]'}`} />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-[#6A3A30]/40">
                                {isPending ? 'PENDIENTE' : 'CONFIRMADO'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-[#6A3A30] tracking-tight">
                            Pedido #{ticket.id}
                        </h2>
                        <p className="text-xs font-medium text-[#6A3A30]/60 mt-0.5 capitalize">
                            {new Date(ticket.createdAt).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="mt-2 inline-flex w-fit rounded-full bg-[#6A3A30]/8 px-2.5 py-1 text-[10px] font-black text-[#6A3A30]/65">
                            {formatExchangeRateLabel(ticketExchangeRate)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isPending && onCancel && (
                            <button
                                onClick={() => {
                                    if (window.confirm("¿Estás seguro de que quieres cancelar este pedido?")) {
                                        onCancel(Number(ticket.id))
                                        onClose()
                                    }
                                }}
                                className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                                title="Cancelar pedido"
                            >
                                <Trash2 size={16} strokeWidth={2.5} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-[#6A3A30]/5 flex items-center justify-center text-[#6A3A30]/50 hover:bg-[#6A3A30]/10 hover:text-[#6A3A30] transition-all active:scale-95"
                        >
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto px-6 py-2"
                >
                    <div className="py-2 space-y-4">
                        {/* Items List - Modern & Clean */}
                        <div className="space-y-3">
                            {ticket.items.map((item, idx) => {
                                const quantity = Number(item.quantity ?? 1) || 1
                                const coveredUnits = Math.max(0, Number(item.coveredUnits ?? 0) || 0)
                                const eligibleUnits = Number.isFinite(item.eligibleUnits)
                                    ? Math.max(0, Number(item.eligibleUnits ?? 0))
                                    : Math.max(0, quantity - coveredUnits)
                                const rawPointsAwarded = Number(item.pointsAwarded)
                                const rawPoints = Number(item.points ?? 0)
                                // Calculate points logic
                                const pointsPerUnit = Number.isFinite(rawPoints) ? Math.max(0, rawPoints) : 0
                                const pointsAwarded = Number.isFinite(rawPointsAwarded)
                                    ? Math.max(0, rawPointsAwarded)
                                    : pointsPerUnit * eligibleUnits
                                const pointsLabel = Number.isInteger(pointsAwarded)
                                    ? String(pointsAwarded)
                                    : pointsAwarded.toFixed(2)

                                const hasCoverage = coveredUnits > 0 || item.noPointsByCoupon
                                let coverageLabel = null
                                if (hasCoverage) {
                                    if (coveredUnits >= quantity) coverageLabel = "Gratis"
                                    else if (coveredUnits > 0) coverageLabel = `${coveredUnits} gratis`
                                    else coverageLabel = "No genera puntos"
                                }

                                return (
                                    <div key={idx} className="flex items-start justify-between group py-1">
                                        <div className="pr-4 min-w-0 flex-1">
                                            <div className="flex items-start gap-2">
                                                {quantity > 1 && (
                                                    <span className="text-xs font-black text-[#6A3A30] bg-[#6A3A30]/5 px-1.5 py-0.5 rounded text-center min-w-[20px] h-fit mt-0.5">
                                                        {quantity}x
                                                    </span>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-[#6A3A30] leading-snug truncate">
                                                        {item.name}
                                                    </p>

                                                    {/* Price per unit if qty > 1 */}
                                                    {quantity > 1 && (
                                                        <p className="text-[10px] text-[#6A3A30]/60 font-medium leading-tight">
                                                            {formatBs(item.price || 0)} {formatUsd(item.price || 0) && <span className="opacity-70">({formatUsd(item.price || 0)})</span>} c/u
                                                        </p>
                                                    )}

                                                    {/* Promo Badge */}
                                                    {coverageLabel && (
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <span className="text-[10px] font-bold text-amber-600">
                                                                {coverageLabel}
                                                            </span>
                                                            <span className="text-[9px] font-black text-white bg-amber-500 px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider">
                                                                CUPÓN
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Points Badge */}
                                                    {pointsAwarded > 0 && (
                                                        <div className="flex items-center gap-1 mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                            <Ticket size={10} className="text-[#1A864D]" />
                                                            <span className="text-[10px] font-bold text-[#1A864D]">
                                                                +{pointsLabel} pts
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 flex flex-col items-end">
                                            <span className="text-sm font-bold text-[#6A3A30]">
                                                {formatBs((item.price || 0) * quantity)}
                                            </span>
                                            {formatUsd((item.price || 0) * quantity) && (
                                                <span className="text-[10px] font-semibold text-[#6A3A30]/40">
                                                    {formatUsd((item.price || 0) * quantity)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer - Compact & Elegant */}
                <div className={`shrink-0 bg-[#FFFBEA] px-6 pb-6 pt-4 space-y-3 relative z-10 transition-shadow duration-300 ${isScrollable ? 'shadow-[0_-10px_40px_-5px_rgba(106,58,48,0.1)] border-t border-[#6A3A30]/5' : ''}`}>

                    {/* Divider with dots */}
                    <div className="border-t-2 border-[#6A3A30]/10 border-dashed mb-4" />

                    {/* Subtotal & Discount - Grid Layout for Compactness */}
                    {(ticket.discount ?? 0) > 0 && (
                        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
                            {/* Subtotal */}
                            <span className="font-bold text-[#6A3A30]/40 uppercase tracking-wider">Subtotal</span>
                            <div className="text-right">
                                <span className="font-bold text-[#6A3A30]/60">{formatBs(totalNative + (ticket.discount || 0))}</span>
                                {formatUsd(totalNative + (ticket.discount || 0)) && <span className="text-[10px] text-[#6A3A30]/40 ml-1">({formatUsd(totalNative + (ticket.discount || 0))})</span>}
                            </div>

                            {/* Discount */}
                            <div className="flex items-center gap-1.5 text-amber-600">
                                <Ticket size={12} />
                                <span className="font-bold uppercase tracking-wider">Descuento</span>
                            </div>
                            <div className="text-right font-bold text-amber-600">
                                -{formatBs(ticket.discount ?? 0)}
                                {formatUsd(ticket.discount || 0) && <span className="text-[10px] opacity-70 ml-1">(-{formatUsd(ticket.discount || 0)})</span>}
                            </div>
                        </div>
                    )}

                    {/* Total & Points */}
                    <div className="pt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-[#6A3A30]/40 uppercase tracking-widest">Total a Pagar</span>
                            <div className="text-right">
                                <span className="text-sm font-black text-[#6A3A30] leading-none tracking-tight">
                                    {formatBs(totalNative)}
                                </span>
                                {formatUsd(totalNative) && (
                                    <span className="text-[10px] font-bold text-[#6A3A30]/40 ml-1">
                                        ({formatUsd(totalNative)})
                                    </span>
                                )}
                            </div>
                        </div>

                        {hasPoints && (
                            <div className="flex items-center gap-1.5 py-1 px-2 bg-[#1A864D]/10 rounded-lg w-fit mt-1">
                                <Ticket size={12} className="text-[#1A864D]" />
                                <span className="text-[10px] font-bold text-[#1A864D]">+{ticket.points} pts</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    {isPending && (
                        <button
                            onClick={() => onChat(String(ticket.id))}
                            className="w-full h-11 rounded-xl bg-[#6A3A30] text-[#FFFBEA] text-xs font-bold hover:bg-[#5a3128] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#6A3A30]/20 mt-2"
                        >
                            <MessageCircle size={14} />
                            Contactar Soporte
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
