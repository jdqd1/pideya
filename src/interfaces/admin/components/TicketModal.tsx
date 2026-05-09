import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2, MapPin, Ticket as TicketIcon, X } from "lucide-react"
import type { PaymentTicket } from "../../../types/app"
import { formatExchangeRateLabel, formatVesLabel, getCurrencyAmounts, resolveHistoricalExchangeRate } from "../../../utils/currency"

type TicketModalProps = {
    ticket: PaymentTicket
    actionLabel?: string
    onAction?: (id: number) => void | Promise<void>
    onCancel?: (id: number) => void | Promise<void>
    formatMoney: (value: number | string | undefined | null) => string
    onClose: () => void
    isConfirming?: boolean
    exchangeRate?: number | null
}

export default function TicketModal({ ticket, actionLabel, onAction, onCancel, formatMoney, onClose, isConfirming, exchangeRate }: TicketModalProps) {
    const [confirming, setConfirming] = useState(false)
    const [canceling, setCanceling] = useState(false)
    const [isScrollable, setIsScrollable] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    const ticketId = Number(ticket.id)
    const isPending = ticket.status === "pending"
    const ticketCurrency = (ticket.currency || "USD").toUpperCase()
    const totalAmount = Number(ticket.amount ?? 0)
    const discountAmount = Number(ticket.discount ?? 0)
    const subtotalAmount = discountAmount > 0 ? totalAmount + discountAmount : totalAmount
    const hasPoints = Number(ticket.points ?? 0) > 0
    const canConfirm = isPending && Boolean(onAction)
    const canCancel = isPending && Boolean(onCancel)
    const ticketExchangeRate = resolveHistoricalExchangeRate(ticket.exchangeRate ?? null, exchangeRate ?? null, ticket.exchangeRateDate ?? ticket.createdAt)

    useEffect(() => {
        const node = scrollRef.current
        if (!node) return

        const checkScrollable = () => {
            setIsScrollable(node.scrollHeight > node.clientHeight)
        }

        checkScrollable()
        const observer = new MutationObserver(checkScrollable)
        observer.observe(node, { childList: true, subtree: true, characterData: true })
        window.addEventListener("resize", checkScrollable)

        return () => {
            observer.disconnect()
            window.removeEventListener("resize", checkScrollable)
        }
    }, [ticket])

    const handleConfirm = async () => {
        if (!onAction) return
        setConfirming(true)
        try {
            await onAction(ticketId)
            onClose()
        } catch (error) {
            console.error(error)
        } finally {
            setConfirming(false)
        }
    }

    const handleCancel = async () => {
        if (!onCancel) return
        if (!window.confirm("Seguro que deseas cancelar este pedido?")) return
        setCanceling(true)
        try {
            await onCancel(ticketId)
            onClose()
        } catch (error) {
            console.error(error)
        } finally {
            setCanceling(false)
        }
    }

    const formatBs = (value: number) => {
        if (!Number.isFinite(value)) return "Bs --"
        const amounts = getCurrencyAmounts(value, ticketCurrency, ticketExchangeRate)
        return amounts.ves !== null ? formatVesLabel(amounts.ves) : "Bs --"
    }

    const formatUsd = (value: number) => {
        if (!Number.isFinite(value)) return "US$ --"
        const amounts = getCurrencyAmounts(value, ticketCurrency, ticketExchangeRate)
        return amounts.usd !== null ? `US$ ${formatMoney(amounts.usd)}` : `${ticketCurrency} ${formatMoney(value)}`
    }

    const formatDateLabel = (value: string) => {
        const parsed = new Date(value)
        if (Number.isNaN(parsed.getTime())) return "Sin fecha"
        const formatted = parsed.toLocaleString("es-VE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
        })
        return formatted.charAt(0).toUpperCase() + formatted.slice(1)
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#6A3A30]/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-[540px] rounded-[2rem] border border-[#6A3A30]/15 bg-[#FFF8ED] shadow-[0_24px_70px_rgba(64,33,25,0.28)] overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200">
                <div className="px-6 pt-6 pb-3 shrink-0 flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`h-2.5 w-2.5 rounded-full ${isPending ? "bg-amber-500 animate-pulse" : "bg-[#1A864D]"}`} />
                            <span className="text-[11px] font-black tracking-[0.2em] uppercase text-[#6A3A30]/40">
                                {isPending ? "PENDIENTE" : "CONFIRMADO"}
                            </span>
                        </div>
                        <h2 className="text-[1.9rem] sm:text-[2.1rem] leading-none font-black tracking-tight text-[#6A3A30]">
                            Pedido #{ticket.id}
                        </h2>
                        <p className="text-[13px] font-semibold text-[#6A3A30]/60 mt-1 capitalize">
                            {formatDateLabel(ticket.createdAt)}
                        </p>
                        <p className="mt-2 inline-flex w-fit rounded-full bg-[#6A3A30]/8 px-2.5 py-1 text-[11px] font-black text-[#6A3A30]/65">
                            {formatExchangeRateLabel(ticketExchangeRate)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-11 w-11 rounded-full bg-[#6A3A30]/8 text-[#6A3A30]/45 hover:bg-[#6A3A30]/14 hover:text-[#6A3A30] transition-colors flex items-center justify-center"
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="px-6 pb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#6A3A30]/8 px-2.5 py-1 text-[11px] font-bold text-[#6A3A30]/80">
                        {ticket.customerName || "Invitado"}
                    </span>
                    {ticket.phone && (
                        <span className="inline-flex items-center rounded-full bg-[#6A3A30]/8 px-2.5 py-1 text-[11px] font-bold text-[#6A3A30]/70">
                            {ticket.phone}
                        </span>
                    )}
                    {ticket.documentNumber && (
                        <span className="inline-flex items-center rounded-full bg-[#6A3A30]/8 px-2.5 py-1 text-[11px] font-bold text-[#6A3A30]/70">
                            {ticket.documentType}-{ticket.documentNumber}
                        </span>
                    )}
                </div>

                <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-2">
                    <div className="space-y-3 pb-2">
                        {ticket.items.map((item, idx) => {
                            const quantity = Math.max(1, Number(item.quantity ?? 1) || 1)
                            const unitPrice = Number(item.price ?? 0)
                            const itemTotal = unitPrice * quantity
                            const coveredUnits = Math.max(0, Number(item.coveredUnits ?? 0) || 0)
                            const eligibleUnits = Number.isFinite(item.eligibleUnits)
                                ? Math.max(0, Number(item.eligibleUnits ?? 0))
                                : Math.max(0, quantity - coveredUnits)
                            const rawPointsAwarded = Number(item.pointsAwarded)
                            const rawPoints = Number(item.points ?? 0)
                            const pointsPerUnit = Number.isFinite(rawPoints) ? Math.max(0, rawPoints) : 0
                            const pointsAwarded = Number.isFinite(rawPointsAwarded)
                                ? Math.max(0, rawPointsAwarded)
                                : pointsPerUnit * eligibleUnits
                            const pointsLabel = Number.isInteger(pointsAwarded) ? String(pointsAwarded) : pointsAwarded.toFixed(2)
                            const hasCoverage = coveredUnits > 0 || item.noPointsByCoupon

                            let coverageLabel: string | null = null
                            if (hasCoverage) {
                                if (coveredUnits >= quantity) coverageLabel = "Gratis"
                                else if (coveredUnits > 0) coverageLabel = `${coveredUnits} gratis`
                                else coverageLabel = "No genera puntos"
                            }

                            return (
                                <div key={`${item.productId ?? item.name}-${idx}`} className="grid grid-cols-[1fr_auto] gap-4 py-1.5">
                                    <div className="min-w-0">
                                        <div className="flex items-start gap-2">
                                            <span className="min-w-[34px] h-[30px] rounded-md bg-[#6A3A30]/8 text-[#6A3A30] text-xs leading-none font-black px-1.5 pt-0.5 flex items-center justify-center">
                                                {quantity}x
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-[1rem] sm:text-[1.1rem] leading-none font-black tracking-tight text-[#6A3A30] truncate">
                                                    {item.name}
                                                </p>
                                                <p className="text-[13px] text-[#6A3A30]/55 font-semibold mt-1">
                                                    {formatBs(unitPrice)} ({formatUsd(unitPrice)}) c/u
                                                </p>

                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    {coverageLabel && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[11px] font-black text-amber-700 uppercase">
                                                                {coverageLabel}
                                                            </span>
                                                            <span className="text-[10px] font-black text-white bg-amber-500 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                                CUPON
                                                            </span>
                                                        </div>
                                                    )}
                                                    {pointsAwarded > 0 && (
                                                        <div className="inline-flex items-center gap-1 text-[#1A864D]">
                                                            <TicketIcon size={11} />
                                                            <span className="text-[11px] font-black">+{pointsLabel} pts</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0 pt-1">
                                        <p className="text-[1.25rem] sm:text-[1.4rem] leading-none font-black tracking-tight text-[#6A3A30]">
                                            {formatBs(itemTotal)}
                                        </p>
                                        <p className="text-[0.85rem] leading-none font-bold text-[#6A3A30]/38 mt-1.5">
                                            {formatUsd(itemTotal)}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className={`shrink-0 px-6 pt-4 bg-[#FFF8ED] ${isScrollable ? "shadow-[0_-12px_36px_-10px_rgba(106,58,48,0.22)] border-t border-[#6A3A30]/10" : ""}`}>
                    <div className="border-t border-dashed border-[#6A3A30]/25 mb-5" />

                    {discountAmount > 0 && (
                        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[13px] mb-4">
                            <span className="font-black uppercase tracking-wider text-[#6A3A30]/42">
                                Subtotal
                            </span>
                            <span className="font-black text-[#6A3A30]/82 text-right">
                                {formatBs(subtotalAmount)} <span className="text-[#6A3A30]/45">{formatUsd(subtotalAmount)}</span>
                            </span>

                            <span className="font-black uppercase tracking-wider text-amber-700 flex items-center gap-1">
                                <TicketIcon size={12} />
                                Descuento
                            </span>
                            <span className="font-black text-amber-700 text-right">
                                -{formatBs(discountAmount)} <span className="text-amber-700/70">(-{formatUsd(discountAmount)})</span>
                            </span>
                        </div>
                    )}

                    {ticket.couponCode && (
                        <p className="text-[11px] font-black text-amber-700 uppercase tracking-wider mb-3">
                            Cupon: {ticket.couponCode}
                        </p>
                    )}

                    <div className="flex items-start justify-between gap-3">
                        <span className="text-[12px] font-black tracking-[0.15em] uppercase text-[#6A3A30]/40 pt-1">
                            Total a pagar
                        </span>
                        <div className="text-right">
                            <p className="text-[1.6rem] sm:text-[1.8rem] leading-none font-black tracking-tight text-[#6A3A30]">
                                {formatBs(totalAmount)}
                            </p>
                            <p className="text-[0.9rem] leading-none font-bold text-[#6A3A30]/38 mt-1.5">
                                {formatUsd(totalAmount)}
                            </p>
                        </div>
                    </div>

                    {hasPoints && (
                        <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A864D]/12 px-3 py-1.5 mt-2">
                            <TicketIcon size={12} className="text-[#1A864D]" />
                            <span className="text-[0.8rem] leading-none font-black text-[#1A864D]">+{ticket.points} pts</span>
                        </div>
                    )}

                    <div className="pb-3" />
                </div>

                {(ticket.deliveryLocation || canCancel || canConfirm) && (
                    <div className="shrink-0 px-6 pb-6 pt-3 bg-[#FFF8ED] border-t border-[#6A3A30]/10">
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                            {ticket.deliveryLocation && (
                                <a
                                    href={`https://www.google.com/maps?q=${ticket.deliveryLocation.lat},${ticket.deliveryLocation.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="h-11 px-4 rounded-xl border border-[#6A3A30]/20 text-[#6A3A30] bg-[#6A3A30]/5 hover:bg-[#6A3A30]/10 text-xs font-black tracking-wide inline-flex items-center justify-center gap-2 w-full sm:w-auto sm:mr-auto"
                                >
                                    <MapPin size={14} />
                                    UBICACION
                                </a>
                            )}

                            {canCancel && (
                                <button
                                    onClick={handleCancel}
                                    disabled={canceling || confirming || isConfirming}
                                    className="h-11 px-4 rounded-xl border border-rose-200 text-rose-600 bg-rose-50/60 hover:bg-rose-100 text-xs font-black tracking-wide inline-flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-60"
                                >
                                    {canceling ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                                    CANCELAR
                                </button>
                            )}

                            {canConfirm && (
                                <button
                                    onClick={handleConfirm}
                                    disabled={canceling || confirming || isConfirming}
                                    className="h-11 px-5 rounded-xl bg-[#6A3A30] text-[#FFF8ED] hover:bg-[#5A3129] text-xs font-black tracking-wide inline-flex items-center justify-center gap-2 w-full sm:w-auto shadow-lg shadow-[#6A3A30]/25 disabled:opacity-60"
                                >
                                    {confirming || isConfirming ? (
                                        <Loader2 size={15} className="animate-spin" />
                                    ) : (
                                        <CheckCircle2 size={15} />
                                    )}
                                    {actionLabel?.toUpperCase() || "CONFIRMAR"}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
