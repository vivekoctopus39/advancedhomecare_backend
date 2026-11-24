import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { query } from '../db/pool.js'
import { requireAuth, signToken } from '../middleware/auth.js'
import { env } from '../config/env.js'
import { badRequest, unauthorized } from '../utils/httpError.js'
import { validateBody } from '../utils/validate.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please wait 15 minutes and try again.' },
})

// Used to keep response time similar when the email does not exist.
const DUMMY_HASH = '$2b$12$Aq1xCM.rfPN8wnaWGxYTw.KRu/E.wbfrmiGKBSMAkmTo0vFSdNkQe'

/** POST /api/auth/login  { email, password } → { token, admin } */
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = validateBody(
    [
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Password', required: true, max: 200 },
    ],
    req.body,
  )

  const { rows } = await query(
    'SELECT id, full_name, email, role, is_active, password_hash FROM admins WHERE email = $1',
    [email],
  )
  const admin = rows[0]
  const ok = await bcrypt.compare(password, admin?.password_hash || DUMMY_HASH)
  if (!admin || !ok || !admin.is_active) throw unauthorized('Incorrect email or password.')

  await query('UPDATE admins SET last_login_at = NOW() WHERE id = $1', [admin.id])

  res.json({
    data: {
      token: signToken(admin),
      expiresIn: env.jwt.expiresIn,
      admin: { id: admin.id, fullName: admin.full_name, email: admin.email, role: admin.role },
    },
  })
})

/** GET /api/auth/me → current admin */
router.get('/me', requireAuth, (req, res) => {
  res.json({ data: req.admin })
})

/** POST /api/auth/change-password  { currentPassword, newPassword } */
router.post('/change-password', requireAuth, async (req, res) => {
  const { current_password: current, new_password: next } = validateBody(
    [
      { key: 'currentPassword', label: 'Current password', required: true, max: 200 },
      { key: 'newPassword', label: 'New password', required: true, min: 8, max: 200 },
    ],
    req.body,
  )
  if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) {
    throw badRequest('New password must contain at least one letter and one number.')
  }

  const { rows } = await query('SELECT password_hash FROM admins WHERE id = $1', [req.admin.id])
  if (!(await bcrypt.compare(current, rows[0].password_hash))) {
    throw badRequest('Current password is incorrect.')
  }
  const hash = await bcrypt.hash(next, 12)
  await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [hash, req.admin.id])
  res.json({ message: 'Password changed.' })
})

export default router
