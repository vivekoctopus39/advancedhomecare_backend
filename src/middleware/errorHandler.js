import multer from 'multer'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
}

// Postgres error codes → friendly HTTP responses
const PG_ERRORS = {
  23505: [409, 'This value already exists. Please use a different one.'],
  23503: [409, 'This record is linked to other data and cannot be changed or removed.'],
  23514: [400, 'One of the values is not allowed.'],
  23502: [400, 'A required value is missing.'],
  '22P02': [400, 'Invalid value format.'],
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...(err.details ? { errors: err.details } : {}) })
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large.' : err.message
    return res.status(400).json({ message })
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON body.' })
  }
  // 42P01 = table does not exist → the SQL setup files were not run in this database.
  if (err.code === '42P01') {
    console.error(`[db] ${err.message}. Run queries/01_schema.sql, 02_seed_data.sql and 03_admin_user.sql in database "${env.db.database}".`)
    return res.status(500).json({
      message: `Database tables not found in "${env.db.database}". Run the files in backend/queries (01, 02, 03) in that database using pgAdmin.`,
    })
  }
  if (err.code && PG_ERRORS[err.code]) {
    const [status, message] = PG_ERRORS[err.code]
    return res.status(status).json({ message, ...(env.isProduction ? {} : { detail: err.detail }) })
  }

  console.error('[error]', err)
  res.status(500).json({ message: 'Something went wrong on the server.' })
}
