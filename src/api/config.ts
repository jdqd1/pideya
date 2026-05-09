const readEnv = (key: string) => {
  const value = import.meta.env[key]
  return typeof value === "string" ? value.trim() : ""
}

const normalizeUrl = (value: string) => value.replace(/\/+$/, "")

const resolveApiUrl = () => {
  const configured = readEnv("VITE_API_URL")
  if (configured) return normalizeUrl(configured)

  if (import.meta.env.PROD) {
    throw new Error("VITE_API_URL is required for production builds")
  }

  return "http://localhost:3000"
}

const resolveSiteUrl = () => {
  const configured = readEnv("VITE_SITE_URL")
  if (configured) return normalizeUrl(configured)
  if (typeof window !== "undefined") return window.location.origin
  return "http://localhost:5173"
}

export const API_URL = resolveApiUrl()
export const SITE_URL = resolveSiteUrl()
