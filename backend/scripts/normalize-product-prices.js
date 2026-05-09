#!/usr/bin/env node
"use strict"

const fs = require("fs")
const path = require("path")
const dotenv = require("dotenv")
const { Client } = require("pg")

const loadEnv = () => {
  const rootEnvPath = path.resolve(__dirname, "..", "..", ".env")
  const backendEnvPath = path.resolve(__dirname, "..", ".env")
  if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath })
    return
  }
  if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath })
    return
  }
  dotenv.config()
}

const parseLimit = (args) => {
  let limit = 25
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg.startsWith("--limit=")) {
      const raw = Number(arg.split("=")[1])
      if (Number.isFinite(raw) && raw > 0) limit = raw
    } else if (arg === "--limit" && i + 1 < args.length) {
      const raw = Number(args[i + 1])
      if (Number.isFinite(raw) && raw > 0) limit = raw
    }
  }
  return limit
}

const formatRow = (row) => ({
  id: row.id,
  name: row.name,
  price: row.price,
  rounded: row.rounded_price,
})

const printHelp = () => {
  console.log("Normalize product prices to 2 decimals.")
  console.log("Usage:")
  console.log("  node scripts/normalize-product-prices.js [--apply] [--limit N]")
  console.log("")
  console.log("Options:")
  console.log("  --apply    Apply updates (default is dry-run).")
  console.log("  --limit N  Limit preview rows (default 25).")
}

const run = async () => {
  const args = process.argv.slice(2)
  if (args.includes("--help") || args.includes("-h")) {
    printHelp()
    return
  }

  loadEnv()
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.")
  }

  const isSsl = process.env.DB_SSL !== "false"
  const client = new Client({
    connectionString,
    ssl: isSsl ? { rejectUnauthorized: false } : false,
  })

  const apply = args.includes("--apply")
  const limit = parseLimit(args)

  const diffQuery = `
    SELECT id, name, price::numeric AS price, ROUND(price::numeric, 2) AS rounded_price
    FROM products
    WHERE price IS NOT NULL
      AND ROUND(price::numeric, 2) <> price::numeric
    ORDER BY name ASC
  `

  await client.connect()
  try {
    const diffResult = await client.query(diffQuery)
    const rows = diffResult.rows

    if (!rows.length) {
      console.log("No product prices need normalization.")
      return
    }

    console.log(`${apply ? "[apply]" : "[dry-run]"} ${rows.length} product(s) need updates.`)
    console.table(rows.slice(0, limit).map(formatRow))
    if (rows.length > limit) {
      console.log(`...and ${rows.length - limit} more.`)
    }

    if (!apply) {
      console.log("Run with --apply to update the database.")
      return
    }

    await client.query("BEGIN")
    const updateResult = await client.query(`
      UPDATE products
      SET price = ROUND(price::numeric, 2)
      WHERE price IS NOT NULL
        AND ROUND(price::numeric, 2) <> price::numeric
      RETURNING id
    `)
    await client.query("COMMIT")
    console.log(`Updated ${updateResult.rowCount} product(s).`)
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    await client.end()
  }
}

run().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
