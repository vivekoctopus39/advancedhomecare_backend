import { Router } from 'express'
import { query } from '../../db/pool.js'
import { badRequest, notFound } from '../../utils/httpError.js'
import { camelRow, parseId, validateBody } from '../../utils/validate.js'

const router = Router()

const SELECT = `
  SELECT e.id, e.source, e.patient_name, e.patient_age, e.patient_condition,
         e.preferred_start_date, e.city, e.address, e.requirements, e.admin_notes,
         e.created_at, e.updated_at,
         c.id AS customer_id, c.full_name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
         s.id AS service_id, s.title AS service_title,
         d.id AS care_duration_id, d.label AS care_duration_label,
         st.id AS status_id, st.code AS status_code, st.label AS status_label
  FROM enquiries e
  JOIN customers c ON c.id = e.customer_id
  JOIN enquiry_statuses st ON st.id = e.status_id
  LEFT JOIN services s ON s.id = e.service_id
  LEFT JOIN care_durations d ON d.id = e.care_duration_id`

/**
 * GET /api/admin/enquiries
 *   ?page=1&limit=20&status=new&source=booking-form&serviceId=3
 *   &search=ramesh&from=2026-01-01&to=2026-12-31
 */
router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
  const where = []
  const params = []
  const add = (sql, value) => {
    params.push(value)
    where.push(sql.replace('?', `$${params.length}`))
  }

  if (req.query.status) add('st.code = ?', String(req.query.status))
  if (req.query.source) add('e.source = ?', String(req.query.source))
  if (req.query.serviceId) add('e.service_id = ?', parseId(req.query.serviceId, 'serviceId'))
  if (req.query.from) add('e.created_at >= ?::date', String(req.query.from))
  if (req.query.to) add("e.created_at < (?::date + INTERVAL '1 day')", String(req.query.to))
  if (req.query.search) {
    params.push(`%${String(req.query.search).trim()}%`)
    const p = `$${params.length}`
    where.push(`(c.full_name ILIKE ${p} OR c.mobile ILIKE ${p} OR c.email ILIKE ${p} OR e.patient_name ILIKE ${p} OR e.city ILIKE ${p})`)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const [{ rows }, { rows: count }] = await Promise.all([
    query(`${SELECT} ${whereSql} ORDER BY e.created_at DESC, e.id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params),
    query(
      `SELECT COUNT(*)::int AS total FROM enquiries e
       JOIN customers c ON c.id = e.customer_id
       JOIN enquiry_statuses st ON st.id = e.status_id ${whereSql}`,
      params,
    ),
  ])
  res.json({
    data: rows.map(camelRow),
    pagination: { page, limit, total: count[0].total, totalPages: Math.ceil(count[0].total / limit) },
  })
})

router.get('/:id', async (req, res) => {
  const { rows } = await query(`${SELECT} WHERE e.id = $1`, [parseId(req.params.id)])
  if (!rows[0]) throw notFound('Enquiry not found.')
  res.json({ data: camelRow(rows[0]) })
})

/** PUT /:id  { statusId?, adminNotes? } */
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const values = validateBody(
    [
      { key: 'statusId', label: 'Status', type: 'fk', required: true },
      { key: 'adminNotes', label: 'Notes', type: 'text', max: 5000 },
    ],
    req.body,
    { partial: true },
  )
  const columns = Object.keys(values)
  if (!columns.length) throw badRequest('Nothing to update.')
  const { rowCount } = await query(
    `UPDATE enquiries SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${columns.length + 1}`,
    [...Object.values(values), id],
  )
  if (!rowCount) throw notFound('Enquiry not found.')
  const { rows } = await query(`${SELECT} WHERE e.id = $1`, [id])
  res.json({ data: camelRow(rows[0]), message: 'Enquiry updated.' })
})

router.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM enquiries WHERE id = $1', [parseId(req.params.id)])
  if (!rowCount) throw notFound('Enquiry not found.')
  res.json({ message: 'Enquiry deleted.' })
})

export default router
