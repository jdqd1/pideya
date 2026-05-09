import { useState } from "react"
import { AlertCircle, ChevronUp, Loader2, Ticket, Trash2 } from "lucide-react"
import type { PaymentTicket } from "../../../types/app"
import { formatExchangeRateLabel, formatVesLabel, getCurrencyAmounts, resolveHistoricalExchangeRate } from "../../../utils/currency"

type TicketStatusSectionProps = {
    tickets: { pending: PaymentTicket[]; confirmed: PaymentTicket[] }
    formatPrice: (value: number) => string
    exchangeRate?: number | null
    loading?: boolean
    loadError?: string | null
    onCancel: (id: number) => Promise<void>
    onView: (ticket: PaymentTicket) => void
}

export function TicketStatusSection({
    tickets,
    formatPrice,
    exchangeRate,
    loading,
    loadError,
    onCancel,
    onView,
}: TicketStatusSectionProps) {
    const hasAny = tickets.pending.length + tickets.confirmed.length > 0

    return (

        <div className="space-y-6">
            <div className="px-2">
                <h3 className="text-xl font-black text-[#6A3A30]">Mis pedidos</h3>
            </div>

            <div className="bg-[#FFFBEA] border border-[#6A3A30]/10 rounded-3xl p-6 shadow-sm shadow-[#6A3A30]/5">
                {loadError && hasAny && (
                    <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
                        <AlertCircle size={14} />
                        {loadError}
                    </div>
                )}

                {loading && !hasAny ? (
                    <div className="flex items-center gap-3 p-4 rounded-2xl border border-[#6A3A30]/10 bg-[#6A3A30]/5 text-sm text-[#6A3A30]/70 font-bold">
                        <Loader2 size={18} className="animate-spin" />
                        Cargando pedidos...
                    </div>
                ) : loadError && !hasAny ? (
                    <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-200 bg-amber-50 text-sm text-amber-800 font-bold">
                        <AlertCircle size={18} />
                        {loadError}
                    </div>
                ) : !hasAny ? (
                    <div className="p-4 rounded-2xl border border-dashed border-[#6A3A30]/20 bg-[#6A3A30]/5 text-sm text-[#6A3A30]/60 font-medium">
                        Aún no tienes tickets. Genera un pedido y reporta el pago para verlos aquí.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TicketColumn title="Pendientes" items={tickets.pending} formatPrice={formatPrice} tone="amber" exchangeRate={exchangeRate} onView={onView} onCancel={onCancel} />
                        <TicketColumn title="Confirmados" items={tickets.confirmed} formatPrice={formatPrice} tone="emerald" exchangeRate={exchangeRate} onView={onView} onCancel={onCancel} />
                    </div>
                )}
            </div>
        </div>
    )
}

function TicketColumn({
    title,
    items,
    formatPrice,
    tone,
    exchangeRate,
    onView,
    onCancel,
}: {
    title: string
    items: PaymentTicket[]
    formatPrice: (value: number) => string
    tone: "amber" | "emerald"
    exchangeRate?: number | null
    onView: (ticket: PaymentTicket) => void
    onCancel: (id: number) => Promise<void>
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const isAmber = tone === "amber"

    const border = isAmber ? "border-amber-200" : "border-[#1A864D]/20"
    const chip = isAmber ? "bg-amber-100 text-amber-800" : "bg-[#1A864D]/10 text-[#1A864D]"
    const cardBg = isAmber ? "bg-amber-50/50 hover:bg-amber-50" : "bg-[#1A864D]/5 hover:bg-[#1A864D]/10"
    const badge = isAmber ? "text-amber-700 bg-amber-100" : "text-[#1A864D] bg-[#1A864D]/10"

    return (
        <div className="rounded-2xl border border-[#6A3A30]/10 bg-[#FFFBEA]/80 overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 bg-[#6A3A30]/5 border border-[#6A3A30]/10 rounded-xl hover:bg-[#6A3A30]/10 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {isAmber && items.length > 0 && <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse mr-1" />}
                    <Ticket size={16} className="text-[#6A3A30]/50" />
                    <h4 className="text-sm font-black text-[#6A3A30]">{title}</h4>
                    <span className={`ml-2 px-2 py-0.5 text-[11px] font-bold rounded-full border ${chip} ${border}`}>
                        {items.length}
                    </span>
                </div>
                <ChevronUp
                    size={16}
                    className={`text-[#6A3A30]/40 transition-transform duration-300 ${isExpanded ? "" : "rotate-180"}`}
                />
            </button>

            <div
                className={`transition-all duration-300 ease-in-out ${isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    }`}
            >
                <div className="px-4 pb-4 overflow-y-auto max-h-96 bg-[#FFFBEA]">
                    {items.length === 0 ? (
                        <p className="text-[12px] text-[#6A3A30]/50 font-medium py-2">No hay tickets {title.toLowerCase()}.</p>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 pt-3">
                            {items.map((ticket) => (
                                <TicketCard
                                    key={ticket.id}
                                    ticket={ticket}
                                    formatPrice={formatPrice}
                                    tone={tone}
                                    cardBg={cardBg}
                                    badge={badge}
                                    exchangeRate={exchangeRate}
                                    onView={onView}
                                    onCancel={onCancel}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function TicketCard({
    ticket,
    formatPrice,
    tone,
    cardBg,
    badge,
    exchangeRate,
    onView,
    onCancel,
}: {
    ticket: PaymentTicket
    formatPrice: (value: number) => string
    tone: "amber" | "emerald"
    cardBg: string
    badge: string
    exchangeRate?: number | null
    onView: (ticket: PaymentTicket) => void
    onCancel: (id: number) => Promise<void>
}) {
    const label = tone === "amber" ? "Pendiente" : "Confirmado"
    const resolvedRate = resolveHistoricalExchangeRate(ticket.exchangeRate ?? null, exchangeRate ?? null, ticket.exchangeRateDate ?? ticket.createdAt)
    const ticketAmounts = getCurrencyAmounts(ticket.amount, ticket.currency, resolvedRate)
    const vesLabel = ticketAmounts.ves !== null ? formatVesLabel(ticketAmounts.ves) : null
    const usdLabel = ticketAmounts.usd !== null ? `${formatPrice(ticketAmounts.usd)} USD` : `${formatPrice(ticket.amount)} ${ticket.currency}`

    return (
        <div className={`border border-[#6A3A30]/5 rounded-xl p-4 space-y-3 ${cardBg} transition-colors relative group/card`}>
            <div className="flex items-start justify-between">
                <div className="flex flex-col">
                    <span className="text-sm font-black text-[#6A3A30]">{vesLabel || usdLabel}</span>
                    {vesLabel && (
                        <span className="text-[10px] text-[#6A3A30]/50 font-medium">{usdLabel}</span>
                    )}
                    <span className="mt-1 inline-flex w-fit rounded-full bg-[#6A3A30]/8 px-2 py-0.5 text-[9px] text-[#6A3A30]/60 font-black">
                        {formatExchangeRateLabel(resolvedRate)}
                    </span>
                    <span className="text-[10px] text-[#6A3A30]/50 font-medium font-mono tracking-wider">#{ticket.id.toString().padStart(6, '0')}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${badge.includes("border") ? badge : badge + " border-transparent"}`}>{label}</span>
                </div>
            </div>

            <div className="text-[11px] text-[#6A3A30]/60 font-semibold flex items-center justify-between pb-2 border-b border-[#6A3A30]/5">
                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                <span className="text-[#1A864D] font-bold">{ticket.points} pts</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
                {tone === "amber" && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            if (window.confirm("¿Estás seguro de que quieres cancelar este pedido?")) {
                                onCancel(Number(ticket.id))
                            }
                        }}
                        className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                        title="Cancelar pedido"
                    >
                        <Trash2 size={16} />
                    </button>
                )}

                <button
                    onClick={() => onView(ticket)}
                    className="inline-flex items-center gap-2 text-xs font-bold text-[#FFFBEA] bg-[#6A3A30] rounded-lg px-4 py-2 transition-all hover:bg-[#5a3128] active:scale-[0.98] shadow-sm shadow-[#6A3A30]/20"
                >
                    Ver pedido
                </button>
            </div>
        </div>
    )
}
