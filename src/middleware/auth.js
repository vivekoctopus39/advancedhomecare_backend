import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { query } from '../db/pool.js'
import { forbidden, unauthorized } from '../utils/httpError.js'

export function signToken(admin) {
  return jwt.sign({ sub: String(admin.id), role: admin.role }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
    algorithm: 'HS256',
  })
}

/**
 * Verifies `Authorization: Bearer <token>` and loads the admin.
 * The admin is re-read from the database so deactivated accounts and
 * role changes take effect immediately, even for unexpired tokens.
 */
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) throw unauthorized()

  let payload
  try {
    payload = jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] })
  } catch (error) {
    throw unauthorized(error.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token.')
  }

  const { rows } = await query(
    'SELECT id, full_name, email, role, is_active FROM admins WHERE id = $1',
    [Number(payload.sub)],
  )
  const admin = rows[0]
  if (!admin || !admin.is_active) throw unauthorized('Account not found or disabled.')

  req.admin = { id: admin.id, fullName: admin.full_name, email: admin.email, role: admin.role }
  next()
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.admin || !roles.includes(req.admin.role)) throw forbidden()
  next()
}
