import * as dotenv from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

const isProduction = process.env.NODE_ENV === 'production'
const localEnvFilePaths = [
  resolve(process.cwd(), '../.env.local'),
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '../.env'),
  resolve(process.cwd(), '.env'),
]
  .filter(existsSync)

let hasLoadedLocalEnv = false

export const getEnvFilePaths = (): string[] => {
  return isProduction ? [] : localEnvFilePaths
}

export const loadLocalEnv = (): void => {
  if (isProduction || hasLoadedLocalEnv) {
    return
  }

  for (const envFilePath of localEnvFilePaths) {
    dotenv.config({ path: envFilePath })
  }

  hasLoadedLocalEnv = true
}

export const getDatabaseUrl = (): string => {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL is not a valid URL')
  }

  validateSupabasePoolerUrl(parsedUrl)

  return databaseUrl
}

const validateSupabasePoolerUrl = (parsedUrl: URL): void => {
  if (!parsedUrl.hostname.endsWith('pooler.supabase.com')) {
    return
  }

  const username = decodeURIComponent(parsedUrl.username)
  const usernameParts = username.split('.')
  const projectScopedUser = usernameParts.slice(1).join('.')

  if (!projectScopedUser) {
    throw new Error('Supabase pooler DATABASE_URL must use a project-scoped user like postgres.<project-ref>')
  }

  const projectRef = process.env.SUPABASE_PROJECT_REF?.trim()

  if (!projectRef) {
    return
  }

  if (projectScopedUser !== projectRef) {
    const shouldRequireProjectMatch = process.env.REQUIRE_SUPABASE_PROJECT_REF_MATCH === 'true'
    const message = 'DATABASE_URL Supabase pooler username suffix does not match SUPABASE_PROJECT_REF'
    if (shouldRequireProjectMatch) {
      throw new Error(message)
    }
    console.warn(`${message}; continuing because DATABASE_URL is the source of truth`)
  }
}
