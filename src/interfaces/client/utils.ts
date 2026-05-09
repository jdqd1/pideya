import type { LevelDefinition } from "../../types/loyalty"
import type { CouponDto } from "../../types/userState"
import type { ActivityItem } from "./types"
import type { ScannedProduct, PendingSale } from "../../types/app"

export const getActivityDate = (item: ActivityItem) =>
    item.type === "pending"
        ? item.createdAt
        : item.type === "coupon"
            ? item.at
            : item.type === "ticket"
                ? item.createdAt
                : item.scannedAt

export const formatActivityDate = (item: ActivityItem) => {
    const dateValue = getActivityDate(item)
    const ts = dateValue ? new Date(dateValue).getTime() : NaN
    if (!Number.isFinite(ts)) return "—"
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export const isPointsBlockedCoupon = (coupon?: CouponDto | null) =>
    coupon?.kind === "free-item" || coupon?.kind === "combo"

type CouponCoverageItem = { price?: number; quantity?: number }

export const getCouponCoverageByItem = (
    items: CouponCoverageItem[],
    coupon?: CouponDto | null,
) => {
    const coverage = Array.from({ length: items.length }, () => 0)
    if (!coupon || !isPointsBlockedCoupon(coupon)) return coverage

    const round = (val: number) => Math.round(val * 100) / 100
    const cap = round(Number(coupon.capUsd ?? 0))
    if (!Number.isFinite(cap) || cap <= 0) return coverage

    const ordered = items
        .map((item, index) => {
            const price = Number(item?.price ?? 0)
            const quantity = Math.max(1, Number(item?.quantity ?? 1) || 1)
            return {
                index,
                price,
                quantity,
            }
        })
        .filter((entry) => Number.isFinite(entry.price) && entry.price > 0 && entry.quantity > 0)
        .sort((a, b) => a.price - b.price)

    let remaining = cap
    for (const entry of ordered) {
        if (remaining <= 0.005) break
        const unitPrice = round(entry.price)

        // Add epsilon to avoid floating point floor errors
        const maxFullUnits = Math.floor((remaining + 0.001) / unitPrice)

        let coveredUnits = Math.min(entry.quantity, Math.max(0, maxFullUnits))

        remaining = round(remaining - (coveredUnits * unitPrice))

        if (remaining > 0.005 && coveredUnits < entry.quantity) {
            coveredUnits += 1
            remaining = 0
        }
        coverage[entry.index] = coveredUnits
    }

    return coverage
}

export const activityTime = (item: ActivityItem) => {
    const dateValue = getActivityDate(item)
    const ts = dateValue ? new Date(dateValue).getTime() : NaN
    return Number.isFinite(ts) ? ts : 0
}

export const buildActivityKey = (item: ActivityItem) => {
    const baseId =
        item.type === "coupon"
            ? item.couponId || item.title || "coupon"
            : item.type === "ticket"
                ? item.id.toString()
                : (item as ScannedProduct | PendingSale).code || item.name
    return `${item.type}-${baseId}-${getActivityDate(item)}`
}

export const expandMonthlyCoupons = (perks?: LevelDefinition["perks"]) => {
    const packs = perks?.monthlyCoupons ?? []
    const coupons: { percent: number; expiresInDays: number }[] = []
    const expiryDays = perks?.monthlyCouponExpiryDays ?? 14
    packs.forEach((pack) => {
        const qty = Math.max(1, pack.quantity ?? 1)
        for (let i = 0; i < qty; i++) {
            coupons.push({ percent: pack.percent, expiresInDays: expiryDays })
        }
    })
    return coupons
}

export const isLevelCoupon = (coupon: CouponDto) => {
    return /cupon mensual/i.test(coupon.title) || /nivel/i.test(coupon.title)
}

export const formatTimeLeft = (expiresAt?: string | null) => {
    if (!expiresAt) return "Sin expiración"
    const now = Date.now()
    const ts = new Date(expiresAt).getTime()
    if (Number.isNaN(ts)) return "Fecha desconocida"
    const diffMs = ts - now
    if (diffMs <= 0) return "Expirado"
    const minutes = Math.floor(diffMs / (1000 * 60))
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 48) return `${hours} h`
    const days = Math.ceil(hours / 24)
    return `${days} d`
}
