export const numericTransformer = {
  to: (value?: number | string | null) => value,
  from: (value?: string | number | null) => {
    if (value === null || value === undefined) return value
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  },
}
