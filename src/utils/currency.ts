const USD_SCALE = 100
const RATE_SCALE = 100

const toNumber = (value: number | string | null | undefined) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

export const toUsdCents = (value: number | string | null | undefined) =>
    Math.round(toNumber(value) * USD_SCALE)

export const fromUsdCents = (cents: number) => cents / USD_SCALE

export const roundUsd = (value: number | string | null | undefined) =>
    fromUsdCents(toUsdCents(value))

export const roundVes = (value: number | string | null | undefined) =>
    Math.round(toNumber(value) * 100) / 100

const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

const toRateCents = (rate: number | string | null | undefined) =>
    Math.round(toNumber(rate) * RATE_SCALE)

export const resolveHistoricalExchangeRate = (
    rate: number | string | null | undefined,
    fallbackRate: number | string | null | undefined,
    recordDate: Date | string | null | undefined,
) => {
    const parsedRate = Number(rate)
    if (Number.isFinite(parsedRate) && parsedRate > 0) return parsedRate

    if (!recordDate) return null
    const parsedDate = recordDate instanceof Date ? recordDate : new Date(recordDate)
    if (Number.isNaN(parsedDate.getTime())) return null

    const parsedFallback = Number(fallbackRate)
    if (!Number.isFinite(parsedFallback) || parsedFallback <= 0) return null

    return isSameDay(parsedDate, new Date()) ? parsedFallback : null
}

export const convertUsdToVesCents = (
    usd: number | string | null | undefined,
    rate: number | string | null | undefined,
) => {
    const rateCents = toRateCents(rate)
    if (!rateCents) return 0
    const usdCents = toUsdCents(usd)
    return Math.round((usdCents * rateCents) / 100)
}

export const convertUsdToVes = (
    usd: number | string | null | undefined,
    rate: number | string | null | undefined,
) => convertUsdToVesCents(usd, rate) / 100

export const convertVesToUsdCents = (
    ves: number | string | null | undefined,
    rate: number | string | null | undefined,
) => {
    const rateCents = toRateCents(rate)
    if (!rateCents) return 0
    const vesCents = Math.round(toNumber(ves) * 100)
    return Math.round((vesCents * 100) / rateCents)
}

export const convertVesToUsd = (
    ves: number | string | null | undefined,
    rate: number | string | null | undefined,
) => convertVesToUsdCents(ves, rate) / 100

export const formatVes = (ves: number | string | null | undefined) =>
    roundVes(ves).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatVesLabel = (ves: number | string | null | undefined) =>
    `Bs. ${formatVes(ves)}`

export const formatExchangeRateLabel = (rate: number | string | null | undefined) => {
    const parsed = Number(rate)
    if (!Number.isFinite(parsed) || parsed <= 0) return "Tasa: --"
    return `Tasa: Bs. ${formatVes(parsed)}`
}

export const formatVesFromUsd = (
    usd: number | string | null | undefined,
    rate: number | string | null | undefined,
) => formatVes(convertUsdToVes(usd, rate))

export const formatVesLabelFromUsd = (
    usd: number | string | null | undefined,
    rate: number | string | null | undefined,
) => `Bs. ${formatVesFromUsd(usd, rate)}`

export const normalizeCurrencyCode = (currency: string | null | undefined) =>
    (currency || "USD").trim().toUpperCase()

export const isUsdCurrency = (currency: string | null | undefined) => {
    const normalized = normalizeCurrencyCode(currency)
    return normalized === "USD" || normalized === "US$"
}

export const getCurrencyAmounts = (
    amount: number | string | null | undefined,
    currency: string | null | undefined,
    rate: number | string | null | undefined,
) => {
    const value = toNumber(amount)
    const parsedRate = Number(rate)
    const hasRate = Number.isFinite(parsedRate) && parsedRate > 0

    if (isUsdCurrency(currency)) {
        const usd = roundUsd(value)
        return {
            nativeCurrency: "USD" as const,
            usd,
            ves: hasRate ? roundVes(convertUsdToVes(usd, parsedRate)) : null,
        }
    }

    const ves = roundVes(value)
    return {
        nativeCurrency: normalizeCurrencyCode(currency),
        usd: hasRate ? roundUsd(convertVesToUsd(ves, parsedRate)) : null,
        ves,
    }
}
