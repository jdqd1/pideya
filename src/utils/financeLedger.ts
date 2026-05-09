import type { Expense, SalesEvent } from "../types/app"
import { convertVesToUsd } from "./currency"

export const UNCLASSIFIED_USD_METHOD = "sin_metodo_usd"
export const UNCLASSIFIED_VES_METHOD = "sin_metodo_bs"

export const VES_METHODS = new Set(["efectivo_bs", "pago_movil", "punto", "transferencia", "otro", UNCLASSIFIED_VES_METHOD])
export const USD_METHODS = new Set(["efectivo_usd", "zelle", UNCLASSIFIED_USD_METHOD])

export const splitPaymentMethods = (value?: string | null) =>
    value
        ? value.split(",").map((item) => item.trim()).filter(Boolean)
        : []

export const normalizePaymentMethod = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, "_")

export const isChangeMethod = (method: string) =>
    method.startsWith("vuelto_") || method.startsWith("change_")

export const stripChangePrefix = (method: string) =>
    method.replace(/^vuelto_/, "").replace(/^change_/, "")

export const normalizeCurrency = (value?: string | null) => (value || "USD").toUpperCase()

export const safeNumber = (value: number | string | null | undefined) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

export const roundUsdAmount = (value: number) => Math.round(value * 100) / 100
export const roundVesAmount = (value: number) => Math.round(value * 100) / 100

export const getSaleTimestamp = (sale: SalesEvent) => {
    const dateStr = sale.occurredAt || sale.scannedAt
    if (!dateStr) return null
    const parsed = new Date(dateStr)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
}

export const getExpenseTimestamp = (expense: Expense) => {
    const dateStr = expense.occurredAt || expense.createdAt
    if (!dateStr) return null
    const parsed = new Date(dateStr)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
}

export const isSameLocalDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

export const resolveRate = (
    rate: number | null | undefined,
    fallbackRate: number,
    recordDate: Date | null,
) => {
    const parsed = Number(rate)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
    if (!recordDate) return null
    const today = new Date()
    if (!isSameLocalDay(recordDate, today)) return null
    const fallback = Number(fallbackRate)
    if (!Number.isFinite(fallback) || fallback <= 0) return null
    return fallback
}

export const getSaleUsdAmount = (sale: SalesEvent, fallbackRate: number) => {
    const quantity = Math.max(1, safeNumber(sale.quantity ?? 1) || 1)
    const price = safeNumber(sale.price)
    const amount = price * quantity
    const currency = normalizeCurrency(sale.currency)
    if (currency === "VES") {
        const rate = resolveRate(sale.exchangeRate ?? null, fallbackRate, getSaleTimestamp(sale))
        return roundUsdAmount(rate ? amount / rate : 0)
    }
    return roundUsdAmount(amount)
}

export const getSaleAmount = (sale: SalesEvent) => {
    const quantity = Math.max(1, safeNumber(sale.quantity ?? 1) || 1)
    const price = safeNumber(sale.price)
    const amount = price * quantity
    const currency = normalizeCurrency(sale.currency)
    return { amount, currency }
}

export const getExpenseUsdAmount = (expense: Expense, fallbackRate: number) => {
    const amount = safeNumber(expense.amount)
    const currency = normalizeCurrency(expense.currency)
    if (currency === "VES") {
        const rate = resolveRate(expense.exchangeRate ?? null, fallbackRate, getExpenseTimestamp(expense))
        return rate ? roundUsdAmount(amount / rate) : 0
    }
    return roundUsdAmount(amount)
}

export const resolveSaleRate = (sale: SalesEvent, fallbackRate: number) =>
    resolveRate(sale.exchangeRate ?? null, fallbackRate, getSaleTimestamp(sale))

export const collectSaleMethods = (sale: SalesEvent) => {
    const methods = new Set<string>()
    if (Array.isArray(sale.paymentDetails)) {
        sale.paymentDetails.forEach((item) => {
            if (!item?.method) return
            const normalized = normalizePaymentMethod(item.method)
            if (!normalized || isChangeMethod(normalized)) return
            methods.add(normalized)
        })
    }
    splitPaymentMethods(sale.paymentMethod).forEach((method) => {
        const normalized = normalizePaymentMethod(method)
        if (!normalized || isChangeMethod(normalized)) return
        methods.add(normalized)
    })
    return Array.from(methods)
}

export const collectSaleMethodAmounts = (sale: SalesEvent, fallbackRate: number) => {
    const saleRate = resolveSaleRate(sale, fallbackRate)
    const { amount, currency } = getSaleAmount(sale)
    const saleAmount = currency === "VES" ? roundVesAmount(amount) : roundUsdAmount(amount)
    const totalUsd = currency === "VES"
        ? roundUsdAmount(saleRate ? saleAmount / saleRate : 0)
        : roundUsdAmount(saleAmount)
    const detailAllocations = (Array.isArray(sale.paymentDetails) ? sale.paymentDetails : [])
        .map((item) => {
            const method = item?.method ? normalizePaymentMethod(item.method) : ""
            const amountNative = Math.max(0, safeNumber(item?.amountNative ?? item?.amount))
            const amountUsd = Math.max(0, safeNumber(item?.amountUsd))
            const rawCurrency = typeof item?.currencyNative === "string"
                ? item.currencyNative.toUpperCase()
                : typeof item?.currency === "string" ? item.currency.toUpperCase() : null
            const currency = rawCurrency ?? (VES_METHODS.has(method) ? "VES" : "USD")
            const detailRate = safeNumber(item?.exchangeRate) || saleRate
            return { method, amountNative, amountUsd, currency, detailRate }
        })
        .filter((item) => item.method && item.amountNative > 0 && !isChangeMethod(item.method))

    if (detailAllocations.length) {
        const resolved = detailAllocations.map((item) => {
            if (VES_METHODS.has(item.method)) {
                const isVes = item.currency === "VES"
                const amountUsdRaw = item.amountUsd > 0 ? item.amountUsd : isVes ? (item.detailRate ? item.amountNative / item.detailRate : 0) : item.amountNative
                const amountVesRaw = isVes ? item.amountNative : (item.detailRate ? amountUsdRaw * item.detailRate : 0)
                return {
                    method: item.method,
                    amountUsd: roundUsdAmount(amountUsdRaw),
                    amountVes: roundVesAmount(amountVesRaw),
                }
            }
            return { method: item.method, amountUsd: roundUsdAmount(item.amountNative), amountVes: 0 }
        })
        const allocatedRaw = resolved.reduce((sum, item) => sum + item.amountUsd, 0)
        const overageRatio = totalUsd > 0 ? allocatedRaw / totalUsd : 0
        const shouldScale = overageRatio > 1.05
        const scale = shouldScale && allocatedRaw > 0 ? totalUsd / allocatedRaw : 1

        const scaledAllocations = resolved.map((item) => ({
            ...item,
            amountUsd: roundUsdAmount(item.amountUsd * scale),
            amountVes: roundVesAmount(item.amountVes * scale),
        }))
        const allocated = scaledAllocations.reduce((sum, item) => sum + item.amountUsd, 0)
        const remainder = totalUsd - allocated
        if (remainder > 0.01) {
            const fallbackMethod = splitPaymentMethods(sale.paymentMethod)
                .map((method) => normalizePaymentMethod(method))
                .find((method) => method && !isChangeMethod(method))
            const method = fallbackMethod || scaledAllocations[0].method || (currency === "VES" ? UNCLASSIFIED_VES_METHOD : UNCLASSIFIED_USD_METHOD)
            const amountVes = VES_METHODS.has(method) && saleRate ? roundVesAmount(remainder * saleRate) : 0
            scaledAllocations.push({ method, amountUsd: roundUsdAmount(remainder), amountVes })
        }
        return scaledAllocations
    }

    const methods = splitPaymentMethods(sale.paymentMethod)
        .map((method) => normalizePaymentMethod(method))
        .filter((method) => Boolean(method) && !isChangeMethod(method))

    const method = methods[0] || (currency === "VES" ? UNCLASSIFIED_VES_METHOD : UNCLASSIFIED_USD_METHOD)
    if (!method) return []

    if (currency === "VES") {
        const amountVes = VES_METHODS.has(method) ? saleAmount : 0
        if (totalUsd <= 0 && amountVes <= 0) return []
        return [{ method, amountUsd: totalUsd, amountVes }]
    }

    if (totalUsd <= 0) return []
    const amountVes = VES_METHODS.has(method) && saleRate ? roundVesAmount(totalUsd * saleRate) : 0
    return [{ method, amountUsd: roundUsdAmount(totalUsd), amountVes }]
}

export const collectSalePaymentMovements = (sale: SalesEvent, fallbackRate: number) => {
    const detailAllocations = Array.isArray(sale.paymentDetails) ? sale.paymentDetails : []
    if (!detailAllocations.length) return [] as Array<{ method: string; amountUsd: number; amountVes: number; kind: "income" | "expense" }>

    const saleRate = resolveSaleRate(sale, fallbackRate)
    const totalUsd = getSaleUsdAmount(sale, fallbackRate)
    let hasChange = false

    const movements = detailAllocations
        .map((item) => {
            const rawMethod = item?.method ? normalizePaymentMethod(item.method) : ""
            const amountNative = Math.max(0, safeNumber(item?.amountNative ?? item?.amount))
            const explicitAmountUsd = Math.max(0, safeNumber(item?.amountUsd))
            if (!rawMethod || amountNative <= 0) return null

            const isChange = isChangeMethod(rawMethod)
            if (isChange) hasChange = true
            const method = isChange ? stripChangePrefix(rawMethod) : rawMethod
            if (!method) return null

            const rawCurrency = typeof item?.currencyNative === "string"
                ? item.currencyNative.toUpperCase()
                : typeof item?.currency === "string" ? item.currency.toUpperCase() : null
            const currency = rawCurrency ?? (VES_METHODS.has(method) ? "VES" : "USD")
            const isVes = currency === "VES"
            const isVesMethod = VES_METHODS.has(method)
            const detailRate = safeNumber(item?.exchangeRate) || saleRate

            let amountUsd = 0
            let amountVes = 0
            if (isVesMethod) {
                const amountUsdRaw = explicitAmountUsd > 0 ? explicitAmountUsd : isVes ? (detailRate ? amountNative / detailRate : 0) : amountNative
                const amountVesRaw = isVes ? amountNative : (detailRate ? amountUsdRaw * detailRate : 0)
                amountUsd = roundUsdAmount(amountUsdRaw)
                amountVes = roundVesAmount(amountVesRaw)
            } else if (isVes) {
                amountUsd = roundUsdAmount(explicitAmountUsd > 0 ? explicitAmountUsd : detailRate ? amountNative / detailRate : 0)
            } else {
                amountUsd = roundUsdAmount(explicitAmountUsd > 0 ? explicitAmountUsd : amountNative)
            }

            return {
                method,
                amountUsd,
                amountVes,
                kind: isChange ? "expense" : "income",
            }
        })
        .filter((entry): entry is { method: string; amountUsd: number; amountVes: number; kind: "income" | "expense" } => Boolean(entry))

    const incomeUsd = movements.reduce((sum, item) => item.kind === "income" ? sum + item.amountUsd : sum, 0)
    if (!hasChange && totalUsd > 0 && incomeUsd / totalUsd > 1.05) {
        const scale = totalUsd / incomeUsd
        return movements.map((item) => item.kind === "income"
            ? {
                ...item,
                amountUsd: roundUsdAmount(item.amountUsd * scale),
                amountVes: roundVesAmount(item.amountVes * scale),
            }
            : item)
    }

    return movements
}

export const getSaleCurrencyTotals = (sale: SalesEvent, fallbackRate: number) => {
    const allocations = collectSaleMethodAmounts(sale, fallbackRate)
    if (allocations.length) {
        const totals = allocations.reduce(
            (totals, entry) => {
                if (USD_METHODS.has(entry.method)) {
                    totals.usd += entry.amountUsd
                    return totals
                }
                if (VES_METHODS.has(entry.method)) {
                    totals.ves += entry.amountVes
                    return totals
                }
                totals.usd += entry.amountUsd
                return totals
            },
            { usd: 0, ves: 0 },
        )
        if (totals.usd > 0 || totals.ves > 0) {
            return { usd: roundUsdAmount(totals.usd), ves: roundVesAmount(totals.ves) }
        }
    }

    const { amount, currency } = getSaleAmount(sale)
    if (currency === "VES") return { usd: 0, ves: roundVesAmount(amount) }
    return { usd: roundUsdAmount(amount), ves: 0 }
}

export type CashCountInput = Record<string, { usd?: number | string | null; ves?: number | string | null }>

export type CashReconciliationLine = {
    method: string
    expectedUsd: number
    expectedVes: number
    countedUsd: number
    countedVes: number
    diffUsd: number
    diffVes: number
    nativeCurrency: "USD" | "VES"
    hasActivity: boolean
    hasDifference: boolean
}

export type CashReconciliation = {
    lines: CashReconciliationLine[]
    totals: {
        expectedUsd: number
        expectedVes: number
        countedUsd: number
        countedVes: number
        diffUsd: number
        diffVes: number
        differenceCount: number
    }
}

const CASH_METHOD_ORDER = [
    "efectivo_usd",
    "efectivo_bs",
    "pago_movil",
    "punto",
    "zelle",
    "transferencia",
]

const buildExpensePaymentMovement = (expense: Expense, fallbackRate: number) => {
    const method = expense.paymentMethod ? normalizePaymentMethod(expense.paymentMethod) : ""
    const amountNative = safeNumber(expense.amount)
    if (!method || amountNative <= 0) return null

    const currency = normalizeCurrency(expense.currency)
    if (currency === "VES") {
        const rate = resolveRate(expense.exchangeRate ?? null, fallbackRate, getExpenseTimestamp(expense))
        return {
            method,
            amountUsd: roundUsdAmount(rate ? amountNative / rate : 0),
            amountVes: roundVesAmount(VES_METHODS.has(method) ? amountNative : 0),
        }
    }

    return {
        method,
        amountUsd: roundUsdAmount(amountNative),
        amountVes: 0,
    }
}

export const buildCashReconciliation = (
    sales: SalesEvent[],
    expenses: Expense[],
    fallbackRate: number,
    counted: CashCountInput = {},
): CashReconciliation => {
    const byMethod = new Map<string, { method: string; expectedUsd: number; expectedVes: number }>()

    const ensure = (method: string) => {
        const normalized = normalizePaymentMethod(method)
        const existing = byMethod.get(normalized)
        if (existing) return existing
        const created = { method: normalized, expectedUsd: 0, expectedVes: 0 }
        byMethod.set(normalized, created)
        return created
    }

    CASH_METHOD_ORDER.forEach(ensure)

    sales.forEach((sale) => {
        const movements = collectSalePaymentMovements(sale, fallbackRate)
        if (movements.length) {
            movements.forEach((movement) => {
                const target = ensure(movement.method)
                const sign = movement.kind === "expense" ? -1 : 1
                target.expectedUsd += sign * movement.amountUsd
                if (VES_METHODS.has(movement.method)) {
                    target.expectedVes += sign * movement.amountVes
                }
            })
            return
        }

        collectSaleMethodAmounts(sale, fallbackRate).forEach((allocation) => {
            const target = ensure(allocation.method)
            target.expectedUsd += allocation.amountUsd
            if (VES_METHODS.has(allocation.method)) {
                target.expectedVes += allocation.amountVes
            }
        })
    })

    expenses.forEach((expense) => {
        const movement = buildExpensePaymentMovement(expense, fallbackRate)
        if (!movement) return
        const target = ensure(movement.method)
        target.expectedUsd -= movement.amountUsd
        if (VES_METHODS.has(movement.method)) {
            target.expectedVes -= movement.amountVes
        }
    })

    Object.keys(counted).forEach(ensure)

    const knownOrder = new Map(CASH_METHOD_ORDER.map((method, index) => [method, index]))
    const lines = Array.from(byMethod.values())
        .map((entry) => {
            const method = entry.method
            const nativeCurrency = VES_METHODS.has(method) ? "VES" as const : "USD" as const
            const countedInput = counted[method] ?? {}
            const countedUsd = roundUsdAmount(safeNumber(countedInput.usd))
            const countedVes = roundVesAmount(safeNumber(countedInput.ves))
            const expectedUsd = roundUsdAmount(entry.expectedUsd)
            const expectedVes = roundVesAmount(entry.expectedVes)
            const diffUsd = roundUsdAmount(countedUsd - expectedUsd)
            const diffVes = roundVesAmount(countedVes - expectedVes)
            const hasActivity =
                Math.abs(expectedUsd) > 0.009 ||
                Math.abs(expectedVes) > 0.009 ||
                Math.abs(countedUsd) > 0.009 ||
                Math.abs(countedVes) > 0.009
            const nativeDiff = nativeCurrency === "VES" ? diffVes : diffUsd

            return {
                method,
                expectedUsd,
                expectedVes,
                countedUsd,
                countedVes,
                diffUsd,
                diffVes,
                nativeCurrency,
                hasActivity,
                hasDifference: Math.abs(nativeDiff) > 0.009,
            }
        })
        .sort((a, b) => {
            const aIndex = knownOrder.get(a.method) ?? Number.MAX_SAFE_INTEGER
            const bIndex = knownOrder.get(b.method) ?? Number.MAX_SAFE_INTEGER
            if (aIndex !== bIndex) return aIndex - bIndex
            return a.method.localeCompare(b.method)
        })

    const totals = lines.reduce(
        (acc, line) => {
            if (line.nativeCurrency === "VES") {
                acc.expectedVes += line.expectedVes
                acc.countedVes += line.countedVes
                acc.diffVes += line.diffVes
            } else {
                acc.expectedUsd += line.expectedUsd
                acc.countedUsd += line.countedUsd
                acc.diffUsd += line.diffUsd
            }
            if (line.hasDifference) acc.differenceCount += 1
            return acc
        },
        {
            expectedUsd: 0,
            expectedVes: 0,
            countedUsd: 0,
            countedVes: 0,
            diffUsd: 0,
            diffVes: 0,
            differenceCount: 0,
        },
    )

    return {
        lines,
        totals: {
            expectedUsd: roundUsdAmount(totals.expectedUsd),
            expectedVes: roundVesAmount(totals.expectedVes),
            countedUsd: roundUsdAmount(totals.countedUsd),
            countedVes: roundVesAmount(totals.countedVes),
            diffUsd: roundUsdAmount(totals.diffUsd),
            diffVes: roundVesAmount(totals.diffVes),
            differenceCount: totals.differenceCount,
        },
    }
}

export const formatVesAsUsd = (amountVes: number, rate: number) =>
    convertVesToUsd(roundVesAmount(amountVes), rate)
