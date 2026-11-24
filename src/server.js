import { app } from './app.js'
import { env } from './config/env.js'
import { pool } from './db/pool.js'

const server = app.listen(env.port, async () => {
  console.log(`AHC API running on http://localhost:${env.port}`)
  try {
    await pool.query('SELECT 1')
    console.log(`[db] Connected to "${env.db.database}" on ${env.db.host}:${env.db.port}`)
  } catch (error) {
    console.error(`[db] Could not connect to PostgreSQL: ${error.message}`)
    console.error('[db] Check DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD in .env')
  }
})

function shutdown(signal) {
  console.log(`${signal} received, shutting down...`)
  server.close(() => pool.end().then(() => process.exit(0)))
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
