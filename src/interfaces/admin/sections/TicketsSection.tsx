import { useMemo, useState, useEffect } from "react"
import {
  User,
  Ticket as TicketIcon,
  MapPin,
  Loader2,
  ChevronDown,
} from "lucide-react"
import type { PaymentTicket } from "../../../types/app"
import TicketModal from "../components/TicketModal"
import { formatExchangeRateLabel, formatVesLabel, getCurrencyAmounts, resolveHistoricalExchangeRate } from "../../../utils/currency"

type TicketsSectionProps = {
  tickets: PaymentTicket[]
  onConfirmTicket: (id: number) => void | Promise<void>
  onCancelTicket?: (id: number) => void | Promise<void>
  confirmingTickets?: Set<number>
  formatMoney: (value: number | string | undefined | null) => string
  exchangeRate: number
}

type SelectedTicket = { ticket: PaymentTicket; actionLabel?: string }

export default function TicketsSection({
  tickets,
  onConfirmTicket,
  onCancelTicket,
  confirmingTickets,
  formatMoney,
  exchangeRate,
}: TicketsSectionProps) {
  const { pending, confirmed } = useMemo(() => {
    const sorted = [...tickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return {
      pending: sorted.filter((t) => t.status === "pending"),
      confirmed: sorted.filter((t) => t.status === "confirmed"),
    }
  }, [tickets])

  const [selectedTicket, setSelectedTicket] = useState<SelectedTicket | null>(null)

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Tickets</h2>
      </header>

      <div className="space-y-6">
        <TicketColumn
          title="Pendientes"
          tickets={pending}
          formatMoney={formatMoney}
          actionLabel="Confirmar"
          onViewTicket={(ticket, actionLabel) => setSelectedTicket({ ticket, actionLabel })}
          confirmingTickets={confirmingTickets}
          variant="pending"
          exchangeRate={exchangeRate}
        />
        <TicketColumn
          title="Confirmados"
          tickets={confirmed}
          formatMoney={formatMoney}
          onViewTicket={(ticket) => setSelectedTicket({ ticket })}
          variant="confirmed"
          exchangeRate={exchangeRate}
        />
      </div>

      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket.ticket}
          actionLabel={selectedTicket.actionLabel}
          onAction={onConfirmTicket}
          onCancel={onCancelTicket}
          formatMoney={formatMoney}
          onClose={() => setSelectedTicket(null)}
          isConfirming={confirmingTickets?.has(Number(selectedTicket.ticket.id))}
          exchangeRate={exchangeRate}
        />
      )}
    </section>
  )
}

function TicketColumn({
  title,
  tickets,
  formatMoney,
  actionLabel,
  onViewTicket,
  confirmingTickets,
  variant,
  exchangeRate,
}: {
  title: string
  tickets: PaymentTicket[]
  formatMoney: (value: number | string | undefined | null) => string
  actionLabel?: string
  onViewTicket?: (ticket: PaymentTicket, actionLabel?: string) => void
  confirmingTickets?: Set<number>
  variant: "pending" | "confirmed"
  exchangeRate: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isPending = variant === "pending"

  return (
    <div className={`rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-300 ${isExpanded ? "ring-4 ring-slate-100" : ""}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors cursor-pointer outline-none group"
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${isPending
              ? "bg-amber-50 border-amber-100 text-amber-600 group-hover:bg-amber-100"
              : "bg-emerald-50 border-emerald-100 text-emerald-600 group-hover:bg-emerald-100"
            }`}>
            <TicketIcon size={20} />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              {title}
              <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${isPending ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                {tickets.length}
              </span>
            </h3>
            {!isExpanded && (
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                {tickets.length === 0 ? "Sin tickets" : "Haz clic para ver la lista"}
              </p>
            )}
          </div>
        </div>

        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isExpanded ? "bg-slate-900 text-white rotate-180" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
          }`}>
          <ChevronDown size={18} />
        </div>
      </button>

      <div className={`transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-6 pb-6 pt-2 overflow-y-auto max-h-[600px] custom-scrollbar">
          {tickets.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-100 py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-3">
                <TicketIcon size={24} />
              </div>
              <p className="text-sm font-bold text-slate-900">No hay tickets</p>
              <p className="text-xs text-slate-400 font-medium">No se han encontrado tickets en esta seccion</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  formatMoney={formatMoney}
                  actionLabel={actionLabel}
                  onViewTicket={onViewTicket}
                  isConfirming={confirmingTickets?.has(Number(ticket.id))}
                  exchangeRate={exchangeRate}
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
  formatMoney,
  actionLabel,
  onViewTicket,
  isConfirming,
  exchangeRate,
}: {
  ticket: PaymentTicket
  formatMoney: (value: number | string | undefined | null) => string
  actionLabel?: string
  onViewTicket?: (ticket: PaymentTicket, actionLabel?: string) => void
  isConfirming?: boolean
  exchangeRate: number
}) {
  const isPending = ticket.status === "pending"
  const [timeLeft, setTimeLeft] = useState("")
  const ticketExchangeRate = resolveHistoricalExchangeRate(ticket.exchangeRate ?? null, exchangeRate, ticket.exchangeRateDate ?? ticket.createdAt)
  const ticketAmounts = getCurrencyAmounts(ticket.amount, ticket.currency, ticketExchangeRate)
  const vesLabel = ticketAmounts.ves !== null ? formatVesLabel(ticketAmounts.ves) : null
  const usdLabel = ticketAmounts.usd !== null ? `${formatMoney(ticketAmounts.usd)} USD` : `${formatMoney(ticket.amount)} ${ticket.currency}`

  useEffect(() => {
    if (!isPending) return

    const updateTimer = () => {
      const createdAt = new Date(ticket.createdAt).getTime()
      if (Number.isNaN(createdAt)) {
        setTimeLeft("Sin fecha")
        return
      }

      const expiresAt = createdAt + 24 * 60 * 60 * 1000
      const diff = expiresAt - Date.now()

      if (diff <= 0) {
        setTimeLeft("Expirado")
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      setTimeLeft(`${hours}h ${minutes}m`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 60000)
    return () => clearInterval(interval)
  }, [ticket.createdAt, isPending])

  return (
    <div className="group border border-slate-100 rounded-2xl p-4 bg-white hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-slate-900 leading-tight">
            {vesLabel ?? formatMoney(ticket.amount)} <span className="text-sm text-slate-500 font-bold">{vesLabel ? "VES" : ticket.currency}</span>
          </p>
          {vesLabel && (
            <p className="text-xs font-bold text-slate-400 mt-1">
              {usdLabel}
            </p>
          )}
          <p className="mt-2 inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
            {formatExchangeRateLabel(ticketExchangeRate)}
          </p>
          <div className="flex flex-col gap-0.5 mt-2">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
              #{ticket.id.toString().padStart(6, "0")}
            </p>
            <p className="text-xs font-semibold text-slate-700 truncate max-w-[150px] flex items-center gap-1">
              <User size={12} className="text-slate-400" />
              {ticket.customerName || ticket.customerEmail || "Invitado"}
            </p>
          </div>
          {!isPending && <p className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold mt-2 inline-block">+{ticket.points} pts</p>}
        </div>

        <div className="flex flex-col items-end">
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{new Date(ticket.createdAt).toLocaleDateString()}</p>
            <p className="text-[10px] font-bold text-slate-300">{new Date(ticket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          </div>

          {isPending && (
            <div className="mt-2 flex items-center justify-end gap-1.5 px-2 py-1 bg-orange-50 text-orange-700 rounded-lg border border-orange-100">
              <Loader2 size={10} className="animate-spin" />
              <span className="text-[10px] font-bold whitespace-nowrap">{timeLeft}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-50">
        {isPending && ticket.deliveryLocation && (
          <a
            href={`https://www.google.com/maps?q=${ticket.deliveryLocation.lat},${ticket.deliveryLocation.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors flex items-center justify-center"
            title="Ver ubicacion"
          >
            <MapPin size={16} />
          </a>
        )}
        <button
          onClick={() => onViewTicket?.(ticket, actionLabel)}
          className="flex-1 py-2 px-3 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center gap-2 group-hover:scale-[1.02]"
        >
          {isConfirming && <Loader2 size={14} className="animate-spin" />}
          Ver detalle
        </button>
      </div>
    </div>
  )
}
