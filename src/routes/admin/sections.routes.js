import { Router } from 'express'
import { query } from '../../db/pool.js'
import { badRequest, notFound } from '../../utils/httpError.js'
import { camelRow, parseId, validateBody } from '../../utils/validate.js'

/**
 * Page sections are fixed slots on the website (home.hero, about.story, …),
 * so they can be edited but not created or deleted. Their list items are
 * managed through /api/admin/section-items?sectionId=…
 */
const router = Router()

const fields = [
  { key: 'eyebrow', label: 'Small heading', max: 150 },
  { key: 'title', label: 'Title', max: 250 },
  { key: 'highlight', label: 'Highlight text', max: 300 },
  { key: 'body', label: 'Body text', type: 'text', max: 5000 },
  { key: 'imageMediaId', label: 'Image', type: 'fk' },
  { key: 'primaryCtaLabel', label: 'Primary button text', max: 80 },
  { key: 'primaryCtaUrl', label: 'Primary button link', type: 'link', max: 300 },
  { key: 'secondaryCtaLabel', label: 'Secondary button text', max: 80 },
  { key: 'secondaryCtaUrl', label: 'Secondary button link', type: 'link', max: 300 },
  { key: 'isActive', type: 'bool' },
]

const SELECT = `
  SELECT p.*, m.url AS image_url, m.alt_text AS image_alt,
         (SELECT COUNT(*) FROM section_items i WHERE i.section_id = p.id)::int AS item_count
  FROM page_sections p LEFT JOIN media m ON m.id = p.image_media_id`

/** GET /api/admin/sections?page=home */
router.get('/', async (req, res) => {
  const params = []
  let where = ''
  if (req.query.page) {
    params.push(String(req.query.page))
    where = 'WHERE p.page = $1'
  }
  const { rows } = await query(`${SELECT} ${where} ORDER BY p.page, p.id`, params)
  res.json({ data: rows.map(camelRow) })
})

/** GET /api/admin/sections/:id  (includes its items) */
router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const { rows } = await query(`${SELECT} WHERE p.id = $1`, [id])
  if (!rows[0]) throw notFound('Section not found.')
  const { rows: items } = await query('SELECT * FROM section_items WHERE section_id = $1 ORDER BY sort_order, id', [id])
  res.json({ data: { ...camelRow(rows[0]), items: items.map(camelRow) } })
})

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const values = validateBody(fields, req.body, { partial: true })
  const columns = Object.keys(values)
  if (!columns.length) throw badRequest('Nothing to update.')
  const sets = columns.map((c, i) => `${c} = $${i + 1}`)
  const { rowCount } = await query(
    `UPDATE page_sections SET ${sets.join(', ')} WHERE id = $${columns.length + 1}`,
    [...Object.values(values), id],
  )
  if (!rowCount) throw notFound('Section not found.')
  const { rows } = await query(`${SELECT} WHERE p.id = $1`, [id])
  res.json({ data: camelRow(rows[0]), message: 'Section saved.' })
})

export default router
