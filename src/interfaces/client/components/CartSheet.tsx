import { useState, useRef, useEffect } from "react"
import { ArrowRight, CheckCircle2, ChevronDown, Gift, Minus, Plus, ShoppingBag, Ticket, Trash2, X, Percent } from "lucide-react"
import type { CartItem } from "../types"
import type { ProductDef } from "../../../types/app"
import type { CouponDto } from "../../../types/userState"
import { formatVesLabelFromUsd } from "../../../utils/currency"

type CartSheetProps = {
    open: boolean
    onToggle: () => void
    cartItems: CartItem[]
    cartTotals: { items: number; total: number; points: number }
    pointsBlockedCount: number
    couponCoverage: number[]

    formatPrice: (value: number) => string
    onChangeQuantity: (product: ProductDef | CartItem, delta: number) => void
    onClearCart: () => void
    onPay: () => void

    exchangeRate: number | null

    availableCoupons: CouponDto[]
    selectedCoupon: CouponDto | null
    onSelectCoupon: (c: CouponDto | null) => void
    discountAmount: number
    finalTotal: number
    isClosed?: boolean
}

export function CartSheet({
    open,
    onToggle,
    cartItems,
    cartTotals,
    pointsBlockedCount,
    couponCoverage,

    formatPrice,
    onChangeQuantity,
    onClearCart,
    onPay,

    exchangeRate,

    availableCoupons,
    selectedCoupon,
    onSelectCoupon,
    discountAmount,
    finalTotal,
    isClosed = false,
}: CartSheetProps) {
    const isEmpty = cartItems.length === 0
    const [showCouponInput, setShowCouponInput] = useState(false)
    const couponContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (showCouponInput && couponContainerRef.current) {
            setTimeout(() => {
                couponContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
            }, 100)
        }
    }, [showCouponInput])

    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [open])

    const couponContainerClass = `border-b border-[#6A3A30]/10 ${showCouponInput ? "pb-2 mb-2" : "pb-0 mb-1"}`

    const getDisplayPrice = (amount: number) => {
        return formatPrice(amount)
    }

    const getBsPrice = (amount: number) => {
        if (exchangeRate) {
            return formatVesLabelFromUsd(amount, exchangeRate)
        }
        return null
    }

    return (
        <div
            className={`fixed inset-0 z-[90] transition-transform duration-500 bg-[#FFFBEA] ${open ? "translate-y-0" : "translate-y-full"} ${open ? "pointer-events-auto" : "pointer-events-none"
                }`}
            style={{ display: 'flex', flexDirection: 'column' }}
        >
            {/* Header Redesigned */}
            <div className="flex items-center justify-between px-6 py-5 shrink-0 bg-[#FFFBEA] z-10 border-b border-[#6A3A30]/10">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-[#6A3A30] tracking-tight">Tu Carrito</h2>
                    {cartTotals.items > 0 && (
                        <span className="bg-[#6A3A30]/10 text-[#6A3A30] text-[10px] font-bold px-2 py-1 rounded-full">
                            {cartTotals.items} items
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {cartTotals.items > 0 && (
                        <button
                            onClick={onClearCart}
                            className="mr-2 bg-[#6A3A30] text-[#FFFBEA] px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#5a3128] transition-colors flex items-center gap-1.5"
                        >
                            <Trash2 size={12} />
                            Vaciar
                        </button>
                    )}
                    <button
                        onClick={onToggle}
                        className="p-2 -mr-2 text-[#6A3A30]/50 hover:text-[#6A3A30] transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>

            {
                !isEmpty ? (
                    <>
                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

                            {/* Items List */}
                            <div className="space-y-6">
                                {cartItems.map((item, index) => {
                                    const rawPoints = Number(item.points ?? 0)
                                    const quantity = Math.max(1, Number(item.quantity ?? 1) || 1)
                                    const pointsPerUnit = Number.isFinite(rawPoints) ? Math.max(0, rawPoints) : 0
                                    const coveredUnits = Math.max(0, Math.min(quantity, Number(couponCoverage[index] ?? 0) || 0))
                                    const eligibleUnits = Math.max(0, quantity - coveredUnits)
                                    const pointsAwarded = pointsPerUnit * eligibleUnits
                                    const pointsLabel = Number.isInteger(pointsAwarded) ? String(pointsAwarded) : pointsAwarded.toFixed(2)

                                    return (
                                        <div key={item.id} className="flex gap-4">
                                            {/* Image (Square) */}
                                            <div className="w-16 h-16 rounded-xl bg-[#6A3A30]/5 shrink-0 overflow-hidden border border-[#6A3A30]/10">
                                                <img src={item.imageUrl || "/images/brownie.png"} alt={item.name} className="w-full h-full object-cover" />
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                                <div className="flex justify-between items-start gap-3">
                                                    <div>
                                                        <p className="font-bold text-[#6A3A30] text-sm leading-tight line-clamp-2">{item.name}</p>
                                                        {/* Puntos always visible if > 0 or if there is coverage info */}
                                                        {coveredUnits > 0 ? (
                                                            eligibleUnits > 0 ? (
                                                                <p className="text-[10px] font-semibold mt-0.5 text-[#6A3A30]/60">
                                                                    <span className="text-[#1A864D]">+{pointsLabel} pts</span>
                                                                    <span className="mx-1 text-[#6A3A30]/30">|</span>
                                                                    <span className="text-[#6A3A30]/70">{coveredUnits} sin puntos</span>
                                                                </p>
                                                            ) : (
                                                                <p className="text-[10px] font-semibold mt-0.5 text-[#6A3A30]/70">
                                                                    Sin puntos por cupón
                                                                </p>
                                                            )
                                                        ) : (
                                                            pointsAwarded > 0 && (
                                                                <p className="text-[10px] font-bold mt-0.5 text-[#1A864D]">
                                                                    +{pointsLabel} pts
                                                                </p>
                                                            )
                                                        )}
                                                        <div className="flex flex-col mt-1">
                                                            <p className="text-[11px] text-[#6A3A30]/70 font-medium">
                                                                {getDisplayPrice(item.price)}
                                                            </p>
                                                            {exchangeRate && (
                                                                <p className="text-[10px] text-[#6A3A30]/50">
                                                                    {getBsPrice(item.price)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Price & Controls Right Side */}
                                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                        <div className="text-right">
                                                            <p className="font-bold text-[#6A3A30] text-sm">
                                                                {getDisplayPrice(item.price * item.quantity)}
                                                            </p>
                                                            {exchangeRate && (
                                                                <p className="text-[10px] text-[#6A3A30]/50 whitespace-nowrap">
                                                                    {getBsPrice(item.price * item.quantity)}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Qty Controls */}
                                                        <div className="flex items-center bg-[#FFFBEA] border border-[#6A3A30]/10 rounded-lg p-0.5 h-7 shadow-sm">
                                                            <button
                                                                onClick={() => onChangeQuantity(item, -1)}
                                                                className={`w-7 h-full flex items-center justify-center rounded-md transition-all duration-200 ${item.quantity === 1
                                                                    ? "bg-[#6A3A30] text-[#FFFBEA] hover:bg-[#5a3128]"
                                                                    : "text-[#6A3A30]/50 hover:text-[#6A3A30] hover:bg-[#6A3A30]/5"
                                                                    }`}
                                                            >
                                                                {item.quantity === 1 ? (
                                                                    <Trash2 size={13} className="animate-in fade-in zoom-in duration-200" />
                                                                ) : (
                                                                    <Minus size={12} strokeWidth={2.5} className="animate-in fade-in zoom-in duration-200" />
                                                                )}
                                                            </button>
                                                            <span className="text-xs font-bold text-[#6A3A30] px-2 min-w-[20px] text-center tabular-nums">{item.quantity}</span>
                                                            <button
                                                                onClick={() => onChangeQuantity(item, 1)}
                                                                className="w-7 h-full flex items-center justify-center rounded-md text-[#6A3A30]/50 hover:text-[#6A3A30] hover:bg-[#6A3A30]/5 transition-colors"
                                                            >
                                                                <Plus size={12} strokeWidth={2.5} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Padding for bottom scroll */}
                            <div className="h-4" />
                        </div>

                        <div className="border-t border-[#6A3A30]/10 bg-[#FFFBEA] p-6 pb-8 space-y-4 shrink-0 z-20 shadow-[0_-10px_40px_rgba(106,58,48,0.05)]">

                            {/* Points Banner (Minimalist) */}
                            {cartTotals.points > 0 && (
                                <div className="flex items-center justify-center gap-1.5 py-1">
                                    <Gift size={14} className="text-[#1A864D]" />
                                    <p className="text-[11px] font-bold text-[#6A3A30]/70 leading-tight">
                                        Ganas <span className="text-base font-black text-violet-600 tracking-tight">{cartTotals.points} {cartTotals.points === 1 ? 'punto' : 'puntos'}</span> con esta orden
                                    </p>
                                </div>
                            )}

                            {/* Coupon Section (Fixed above total) */}
                            {availableCoupons.length > 0 && (
                                <div ref={couponContainerRef} className={couponContainerClass}>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setShowCouponInput(!showCouponInput)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                setShowCouponInput(!showCouponInput)
                                            }
                                        }}
                                        className="w-full flex items-center justify-between group cursor-pointer"
                                    >
                                        <div className="flex items-start gap-2 text-xs font-bold text-[#6A3A30] hover:text-[#5a3128] transition-colors">
                                            <div className="w-6 h-6 rounded-full bg-[#6A3A30]/10 text-[#6A3A30] flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Gift size={12} />
                                            </div>
                                            {selectedCoupon ? (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[#6A3A30]">Cupón: {selectedCoupon.title}</span>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            onSelectCoupon(null)
                                                        }}
                                                        className="text-[9px] font-bold text-[#6A3A30]/60 hover:text-[#6A3A30] hover:underline"
                                                    >
                                                        Remover
                                                    </button>
                                                    {pointsBlockedCount > 0 && (
                                                        <span className="text-[9px] font-semibold text-[#6A3A30] bg-[#6A3A30]/10 px-1.5 py-0.5 rounded border border-[#6A3A30]/20">
                                                            Sin puntos por cupón
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-violet-600 font-bold">¡Tienes un cupón disponible!</span>
                                            )}
                                        </div>
                                        <ChevronDown size={14} className={`text-[#6A3A30]/40 transition-transform duration-300 ${showCouponInput ? "rotate-180" : ""}`} />
                                    </div>

                                    {showCouponInput && (
                                        <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 fade-in duration-200 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                            {availableCoupons.map((coupon) => {
                                                const isSelected = selectedCoupon?.id === coupon.id
                                                const capValue = Number(coupon.capUsd ?? NaN)
                                                const cap = Number.isFinite(capValue) && capValue > 0 ? capValue : null
                                                const prices = cartItems
                                                    .map((item) => Number(item.price ?? 0))
                                                    .filter((price) => Number.isFinite(price) && price > 0)
                                                const maxPrice = prices.length ? Math.max(...prices) : 0
                                                const freeItemCap = cap ?? maxPrice

                                                return (
                                                    <button
                                                        key={coupon.id}
                                                        onClick={() => {
                                                            onSelectCoupon(coupon)
                                                            setShowCouponInput(false)
                                                        }}
                                                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all relative overflow-hidden group ${isSelected
                                                            ? "bg-[#6A3A30] text-[#FFFBEA] border-[#6A3A30] shadow-lg shadow-[#6A3A30]/20"
                                                            : "bg-[#FFFBEA] border-[#6A3A30]/10 text-[#6A3A30] hover:border-[#6A3A30]/30 hover:bg-[#6A3A30]/5"
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-center z-10 relative">
                                                            <div className="flex items-center gap-3">
                                                                {/* Icon based on type */}
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isSelected ? "bg-white/20 text-[#FFFBEA]" : "bg-[#6A3A30]/10 text-[#6A3A30]"
                                                                    }`}>
                                                                    {coupon.kind === 'percent' ? (
                                                                        <Percent size={14} />
                                                                    ) : coupon.kind === 'free-item' ? (
                                                                        <Gift size={14} />
                                                                    ) : (
                                                                        <Ticket size={14} />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-bold">{coupon.title}</p>
                                                                    <p className={`text-[10px] font-medium mt-0.5 ${isSelected ? "text-[#FFFBEA]/80" : "text-[#6A3A30]/60"}`}>
                                                                        {coupon.kind === 'percent'
                                                                            ? cap
                                                                                ? `Descuento del ${coupon.value}% (tope ${getDisplayPrice(cap)})`
                                                                                : `Descuento del ${coupon.value}%`
                                                                            : coupon.kind === 'free-item'
                                                                                ? `Producto gratis (hasta ${getDisplayPrice(freeItemCap)})`
                                                                                : coupon.kind === 'combo'
                                                                                    ? `Combo gratis (hasta ${getDisplayPrice(freeItemCap)})`
                                                                                    : coupon.kind === 'bogo'
                                                                                        ? "2x1 en brownies"
                                                                                        : `Ahorro de ${getDisplayPrice(Number(coupon.value ?? 0))}`
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            {isSelected && <CheckCircle2 size={16} />}
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1">
                                <div className="flex justify-between items-center text-xs text-[#6A3A30]/70 font-medium">
                                    <span>Subtotal</span>
                                    <span>{getDisplayPrice(cartTotals.total)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-[#6A3A30]/70 font-medium">
                                    <span>Delivery</span>
                                    <span className="text-[10px] font-semibold text-violet-700 bg-violet-100/80 px-2 py-0.5 rounded-md">
                                        Confirmar con la tienda
                                    </span>
                                </div>
                                {/* Tax would go here if available */}

                                {selectedCoupon && (
                                    <div className="flex justify-between items-center text-xs text-[#6A3A30] font-bold">
                                        <span>Descuento aplicado</span>
                                        <span>-{getDisplayPrice(discountAmount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-end pt-2">
                                    <span className="text-base font-black text-[#6A3A30]">Total a pagar</span>

                                    <div className="text-right">
                                        <span className="text-xl font-black text-[#6A3A30] tracking-tight leading-none block">
                                            {getDisplayPrice(finalTotal)}
                                        </span>
                                        {exchangeRate && (
                                            <span className="text-[12px] font-bold text-[#6A3A30]/50 block mt-1">
                                                {getBsPrice(finalTotal)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={onPay}
                                disabled={isClosed}
                                className={`w-full h-12 rounded-xl font-bold text-base transition-all shadow-lg flex items-center justify-center gap-2 ${isClosed
                                    ? "bg-[#6A3A30]/10 text-[#6A3A30]/40 cursor-not-allowed shadow-none"
                                    : "bg-[#6A3A30] text-[#FFFBEA] hover:bg-[#5a3128] active:scale-[0.98] shadow-[#6A3A30]/20"
                                    }`}
                            >
                                {isClosed ? (
                                    <span>Negocio Cerrado</span>
                                ) : (
                                    <>
                                        <span>Proceder al pago</span>
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 opacity-70 relative">
                        <div className="w-16 h-16 rounded-full bg-[#6A3A30]/5 flex items-center justify-center">
                            <ShoppingBag size={24} className="text-[#6A3A30]/30" />
                        </div>
                        <p className="text-sm font-medium text-[#6A3A30]/60 max-w-[200px]">
                            Tu carrito está vacío.
                        </p>
                        <button onClick={onToggle} className="text-[#6A3A30] font-bold text-xs hover:underline">
                            Volver al menú
                        </button>
                    </div>
                )
            }
        </div >

    )
}
