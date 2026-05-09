import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const readEnvFile = (filePath) => {
  if (!existsSync(filePath)) return {}
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) return acc
      const eq = trimmed.indexOf("=")
      if (eq < 0) return acc
      const key = trimmed.slice(0, eq).trim()
      const rawValue = trimmed.slice(eq + 1).trim()
      acc[key] = rawValue.replace(/^["']|["']$/g, "")
      return acc
    }, {})
}

const localEnv = {
  ...readEnvFile(resolve(".env")),
  ...readEnvFile(resolve(".env.local")),
}

const apiUrl = (process.env.VITE_API_URL || localEnv.VITE_API_URL || "").trim()

if (!apiUrl) {
  console.error("Missing VITE_API_URL. Set it to the public backend URL before building for production.")
  process.exit(1)
}

if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(apiUrl)) {
  const isVercelBuild = Boolean(process.env.VERCEL || process.env.CI)
  if (isVercelBuild) {
    console.error("VITE_API_URL points to localhost. Production must use the public backend URL.")
    process.exit(1)
  }
}
