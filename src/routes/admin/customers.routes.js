import { Router } from 'express'
import { query } from '../../db/pool.js'
import { notFound } from '../../utils/httpError.js'
import { camelRow, parseId } from '../../utils/validate.js'

const router = Router()

/** GET /api/admin/customers?search=&page=1&limit=20 */
router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
  const params = []
  let where = ''
  if (req.query.search) {
    params.push(`%${String(req.query.search).trim()}%`)
    where = 'WHERE c.full_name ILIKE $1 OR c.mobile ILIKE $1 OR c.email ILIKE $1'
  }
  const [{ rows }, { rows: count }] = await Promise.all([
    query(
      `SELECT c.*, COUNT(e.id)::int AS enquiry_count, MAX(e.created_at) AS last_enquiry_at
       FROM customers c LEFT JOIN enquiries e ON e.customer_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY last_enquiry_at DESC NULLS LAST, c.id DESC
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params,
    ),
    query(`SELECT COUNT(*)::int AS total FROM customers c ${where}`, params),
  ])
  res.json({
    data: rows.map(camelRow),
    pagination: { page, limit, total: count[0].total, totalPages: Math.ceil(count[0].total / limit) },
  })
})

/** GET /api/admin/customers/:id  (with their enquiries) */
router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const { rows } = await query('SELECT * FROM customers WHERE id = $1', [id])
  if (!rows[0]) throw notFound('Customer not found.')
  const { rows: enquiries } = await query(
    `SELECT e.id, e.source, e.patient_name, e.created_at, s.title AS service_title, st.label AS status_label
     FROM enquiries e
     JOIN enquiry_statuses st ON st.id = e.status_id
     LEFT JOIN services s ON s.id = e.service_id
     WHERE e.customer_id = $1 ORDER BY e.created_at DESC`,
    [id],
  )
  res.json({ data: { ...camelRow(rows[0]), enquiries: enquiries.map(camelRow) } })
})

export default router
