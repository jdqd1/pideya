import { X, Plus, Minus, ShoppingBag, ChevronUp, Ticket } from "lucide-react"
import { CartSheet } from "./CartSheet"
import type { ProductDef } from "../../../types/app"
import type { CouponDto } from "../../../types/userState"
import type { CartItem } from "../types"
import { formatVesLabelFromUsd } from "../../../utils/currency"

type OrderSectionProps = {
    active: boolean
    onClose: () => void
    products: ProductDef[]
    cartItems: CartItem[]
    cartTotals: { items: number; total: number; points: number }
    pointsBlockedCount: number
    couponCoverage: number[]

    cartOpen: boolean
    onOpenCart: () => void
    onToggleCart: () => void
    onChangeQuantity: (product: ProductDef | CartItem, delta: number) => void
    onClearCart: () => void
    onPay: () => void
    formatPrice: (value: number) => string
    getQuantity: (product: ProductDef) => number
    exchangeRate: number | null
    availableCoupons: CouponDto[]
    selectedCoupon: CouponDto | null
    onSelectCoupon: (c: CouponDto | null) => void
    discountAmount: number
    finalTotal: number
    isClosed?: boolean
}

const isProductAvailable = (product: ProductDef | CartItem) => {
    const catalogProduct = product as ProductDef
    return catalogProduct.available ?? (catalogProduct.active !== false && (catalogProduct.stock ?? 1) > 0)
}

export function OrderSection({
    active,
    onClose,
    products,
    cartItems,
    cartTotals,
    pointsBlockedCount,
    couponCoverage,

    cartOpen,
    onOpenCart,
    onToggleCart,
    onChangeQuantity,
    onClearCart,
    onPay,
    formatPrice,
    getQuantity,
    exchangeRate,
    availableCoupons,
    selectedCoupon,
    onSelectCoupon,
    discountAmount,
    finalTotal,
    isClosed = false,
}: OrderSectionProps) {
    const isActive = active

    if (!isActive) return null

    return (
        <div className="fixed inset-0 z-[70] bg-[#AFC8BF] overflow-y-auto">
            <div className="max-w-5xl mx-auto px-4 pb-36 pt-6">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <h3 className="text-2xl font-black text-[#6A3A30] tracking-tight">Menú</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full bg-[#FFFBEA] text-[#6A3A30]/50 hover:text-[#6A3A30] hover:bg-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4 pb-24">
                    {products.map((product, idx) => {
                        const qty = getQuantity(product)
                        const available = isProductAvailable(product)
                        return (
                            <div
                                key={product.id || product.name || idx}
                                className="relative flex flex-col bg-[#FFFBEA] rounded-[1.5rem] p-3 shadow-[0_8px_30px_rgba(106,58,48,0.04)] border border-[#6A3A30]/10 hover:shadow-[0_8px_30px_rgba(106,58,48,0.08)] transition-all group overflow-hidden"
                            >
                                {/* Image Header */}
                                <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#FFFBEA] mb-3 shadow-inner shadow-[#6A3A30]/5">
                                    <img
                                        src={product.imageUrl || "/images/brownie.png"}
                                        alt={product.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    {!available && (
                                        <span className="absolute top-3 right-3 rounded-full bg-[#6A3A30]/90 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#FFFBEA]">
                                            Agotado
                                        </span>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex flex-col flex-1">
                                    <h4 className="text-2xl font-black text-[#6A3A30] leading-tight mb-2 line-clamp-2" title={product.name}>
                                        {product.name.charAt(0).toUpperCase() + product.name.slice(1)}
                                    </h4>

                                    {/* Description */}
                                    <p className="text-base text-[#6A3A30]/70 font-medium leading-relaxed line-clamp-3 mb-4 h-16">
                                        {(product.description || `Delicioso ${product.name.toLowerCase()} preparado con ingredientes de la más alta calidad.`).charAt(0).toUpperCase() + (product.description || `Delicioso ${product.name.toLowerCase()} preparado con ingredientes de la más alta calidad.`).slice(1)}
                                    </p>

                                    <div className="mt-auto flex items-end justify-between">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-3xl font-black text-[#6A3A30]">
                                                    {formatPrice(product.price || 0)}
                                                </span>
                                                {product.points > 0 && (
                                                    <span className="inline-flex items-center gap-1.5 bg-[#1A864D] text-[#FFFBEA] text-xs font-bold px-2.5 py-1 rounded-full shadow-sm border border-[#1A864D]">
                                                        <Ticket size={14} className="fill-[#FFFBEA]/20 stroke-[#FFFBEA]" /> +{product.points} pts
                                                    </span>
                                                )}
                                            </div>
                                            {exchangeRate && (
                                                <span className="text-sm text-[#6A3A30]/50 font-bold">
                                                    {formatVesLabelFromUsd(product.price || 0, exchangeRate)}
                                                </span>
                                            )}
                                        </div>

                                        {qty === 0 ? (
                                            <button
                                                onClick={() => onChangeQuantity(product, 1)}
                                                disabled={!available}
                                                className="h-10 px-6 rounded-full bg-[#6A3A30] text-[#FFFBEA] text-sm font-bold shadow-lg shadow-[#6A3A30]/20 hover:bg-[#5a3128] active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                            >
                                                {available ? "Agregar" : "Agotado"}
                                            </button>
                                        ) : (
                                            <div className="flex items-center bg-[#FFFBEA] rounded-full p-1 h-10 shadow-inner border border-[#6A3A30]/10">
                                                <button
                                                    onClick={() => onChangeQuantity(product, -1)}
                                                    className="w-8 h-full flex items-center justify-center rounded-full text-[#6A3A30]/50 hover:text-[#6A3A30] hover:bg-[#6A3A30]/5 transition-colors bg-[#FFFBEA] shadow-sm"
                                                >
                                                    <Minus size={16} strokeWidth={2.5} />
                                                </button>
                                                <span className="text-base font-black text-[#6A3A30] px-3 min-w-[30px] text-center">{qty}</span>
                                                <button
                                                    onClick={() => onChangeQuantity(product, 1)}
                                                    disabled={!available}
                                                    className="w-8 h-full flex items-center justify-center rounded-full bg-[#6A3A30] text-[#FFFBEA] transition-all shadow-md shadow-[#6A3A30]/20 active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Plus size={16} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {!products.length && (
                    <div className="mt-6 rounded-2xl border border-dashed border-[#6A3A30]/20 bg-[#FFFBEA]/50 p-6 text-center text-sm text-[#6A3A30]/60 font-medium">
                        No hay productos para mostrar aún.
                    </div>
                )}

                <div className="mt-6 flex justify-end">
                    <div />
                </div>
            </div>

            {!cartOpen && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80]">
                    <button
                        onClick={onOpenCart}
                        className="flex items-center gap-3 bg-[#6A3A30] text-[#FFFBEA] pl-5 pr-6 py-4 rounded-full shadow-[0_20px_40px_-10px_rgba(106,58,48,0.45)] hover:shadow-[0_25px_50px_-12px_rgba(106,58,48,0.6)] transition-all"
                    >
                        <ShoppingBag size={20} />
                        <div className="text-left">
                            <p className="text-sm font-bold leading-none">Carrito</p>
                            <p className="text-[10px] text-[#FFFBEA]/70 font-medium leading-none">{cartTotals.items} {cartTotals.items === 1 ? 'artículo' : 'artículos'}</p>
                        </div>
                        {cartTotals.items > 0 && (
                            <span className="ml-2 px-2 py-0.5 text-[10px] font-black bg-rose-500 text-white rounded-full shadow-sm">{cartTotals.items}</span>
                        )}
                        <ChevronUp size={18} className="ml-1 text-[#FFFBEA]/80" />
                    </button>
                </div>
            )}

            <CartSheet
                open={cartOpen}
                onToggle={onToggleCart}
                cartItems={cartItems}
                cartTotals={cartTotals}
                pointsBlockedCount={pointsBlockedCount}
                couponCoverage={couponCoverage}

                formatPrice={formatPrice}
                onChangeQuantity={onChangeQuantity}
                onClearCart={onClearCart}
                onPay={onPay}
                exchangeRate={exchangeRate}
                availableCoupons={availableCoupons}
                selectedCoupon={selectedCoupon}
                onSelectCoupon={onSelectCoupon}
                discountAmount={discountAmount}
                finalTotal={finalTotal}
                isClosed={isClosed}
            />
        </div>
    )
}
