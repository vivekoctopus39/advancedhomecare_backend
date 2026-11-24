import pg from 'pg'
import { env } from '../config/env.js'

// Return DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting).
pg.types.setTypeParser(1082, (value) => value)

export const pool = new pg.Pool({ ...env.db, idleTimeoutMillis: 30000 })

pool.on('error', (err) => {
  console.error('[db] Unexpected idle client error:', err.message)
})

/** Run a parameterised query. Always pass user input via `params`. */
export const query = (text, params) => pool.query(text, params)

/** Run `fn(client)` inside a transaction; rolls back on any error. */
export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
