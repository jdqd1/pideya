export const normalizeSaleCode = (raw: string | null | undefined) => {
    const value = raw?.trim()
    if (!value) return null
    const stripClaimPrefix = (code: string) =>
        code.toLowerCase().startsWith("claim:") ? code.slice(6) : code
    return stripClaimPrefix(value)
}

export const truncateToStep = (value: Date, unit: "hour" | "day" | "month", step = 1) => {
    const next = new Date(value)
    if (unit === "hour") {
        next.setMinutes(0, 0, 0)
        const block = Math.floor(next.getHours() / step)
        next.setHours(block * step)
    } else if (unit === "day") {
        next.setHours(0, 0, 0, 0)
    } else {
        next.setDate(1)
        next.setHours(0, 0, 0, 0)
    }
    return next
}

export const addInterval = (value: Date, unit: "hour" | "day" | "month", amount: number) => {
    const next = new Date(value)
    if (unit === "hour") {
        next.setHours(next.getHours() + amount)
    } else if (unit === "day") {
        next.setDate(next.getDate() + amount)
    } else {
        next.setMonth(next.getMonth() + amount)
    }
    return next
}

export const startOfWeek = (value: Date) => {
    const next = new Date(value)
    const day = next.getDay() // 0 Sunday, 1 Monday
    const diffToMonday = day === 0 ? -6 : 1 - day
    next.setHours(0, 0, 0, 0)
    next.setDate(next.getDate() + diffToMonday)
    return next
}

export const startOfMonth = (value: Date) => {
    const next = new Date(value)
    next.setDate(1)
    next.setHours(0, 0, 0, 0)
    return next
}
