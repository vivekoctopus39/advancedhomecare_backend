import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../../db/pool.js'
import { requireRole } from '../../middleware/auth.js'
import { badRequest, notFound } from '../../utils/httpError.js'
import { camelRow, parseId, validateBody } from '../../utils/validate.js'

/** Admin user management — super_admin only. */
const router = Router()
router.use(requireRole('super_admin'))

const PUBLIC_COLUMNS = 'id, full_name, email, role, is_active, last_login_at, created_at, updated_at'

function checkPassword(password) {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw badRequest('Password must be at least 8 characters and contain a letter and a number.')
  }
}

router.get('/', async (_req, res) => {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM admins ORDER BY id`)
  res.json({ data: rows.map(camelRow) })
})

/** POST { fullName, email, password, role } */
router.post('/', async (req, res) => {
  const values = validateBody(
    [
      { key: 'fullName', label: 'Name', required: true, max: 100 },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Password', required: true, max: 200 },
      { key: 'role', label: 'Role', type: 'enum', values: ['super_admin', 'editor'], default: 'editor' },
    ],
    req.body,
  )
  checkPassword(values.password)
  const hash = await bcrypt.hash(values.password, 12)
  const { rows } = await query(
    `INSERT INTO admins (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING ${PUBLIC_COLUMNS}`,
    [values.full_name, values.email, hash, values.role],
  )
  res.status(201).json({ data: camelRow(rows[0]), message: 'Admin created.' })
})

/** PUT /:id { fullName?, role?, isActive?, password? } */
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const values = validateBody(
    [
      { key: 'fullName', label: 'Name', required: true, max: 100 },
      { key: 'role', label: 'Role', type: 'enum', values: ['super_admin', 'editor'], required: true },
      { key: 'isActive', type: 'bool' },
      { key: 'password', label: 'Password', required: true, max: 200 },
    ],
    req.body,
    { partial: true },
  )
  if (id === req.admin.id && (values.is_active === false || (values.role && values.role !== 'super_admin'))) {
    throw badRequest('You cannot deactivate or demote your own account.')
  }
  if (values.password !== undefined) {
    checkPassword(values.password)
    values.password_hash = await bcrypt.hash(values.password, 12)
    delete values.password
  }
  const columns = Object.keys(values)
  if (!columns.length) throw badRequest('Nothing to update.')
  const { rows } = await query(
    `UPDATE admins SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${columns.length + 1} RETURNING ${PUBLIC_COLUMNS}`,
    [...Object.values(values), id],
  )
  if (!rows[0]) throw notFound('Admin not found.')
  res.json({ data: camelRow(rows[0]), message: 'Admin updated.' })
})

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  if (id === req.admin.id) throw badRequest('You cannot delete your own account.')
  const { rowCount } = await query('DELETE FROM admins WHERE id = $1', [id])
  if (!rowCount) throw notFound('Admin not found.')
  res.json({ message: 'Admin deleted.' })
})

export default router
