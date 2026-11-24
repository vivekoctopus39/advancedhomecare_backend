import { Router } from 'express'
import { query, withTransaction } from '../../db/pool.js'
import { badRequest, notFound } from '../../utils/httpError.js'
import { camelRow, parseId, validateBody } from '../../utils/validate.js'

/** Privacy Policy / Terms. The page and its sections are saved together. */
const router = Router()

const SELECT = `
  SELECT p.*,
         COALESCE((SELECT json_agg(json_build_object('id', s.id, 'heading', s.heading, 'body', s.body)
                                   ORDER BY s.sort_order, s.id)
                   FROM legal_sections s WHERE s.page_id = p.id), '[]') AS sections
  FROM legal_pages p`

router.get('/', async (_req, res) => {
  const { rows } = await query(`${SELECT} ORDER BY p.id`)
  res.json({ data: rows.map(camelRow) })
})

router.get('/:id', async (req, res) => {
  const { rows } = await query(`${SELECT} WHERE p.id = $1`, [parseId(req.params.id)])
  if (!rows[0]) throw notFound('Page not found.')
  res.json({ data: camelRow(rows[0]) })
})

/**
 * PUT /:id  { title, intro, sections: [{ heading, body }] }
 * `sections` replaces all sections (body paragraphs separated by a blank line).
 */
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const values = validateBody(
    [
      { key: 'title', label: 'Title', required: true, max: 150 },
      { key: 'intro', label: 'Introduction', type: 'text', max: 3000 },
    ],
    req.body,
    { partial: true },
  )

  let sections
  if (req.body.sections !== undefined) {
    if (!Array.isArray(req.body.sections)) throw badRequest('"sections" must be a list.')
    sections = req.body.sections.map((s, i) =>
      validateBody(
        [
          { key: 'heading', label: `Section ${i + 1} heading`, required: true, max: 200 },
          { key: 'body', label: `Section ${i + 1} text`, type: 'text', required: true, max: 10000 },
        ],
        s || {},
      ),
    )
  }

  await withTransaction(async (client) => {
    const columns = Object.keys(values)
    const { rowCount } = columns.length
      ? await client.query(
          `UPDATE legal_pages SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${columns.length + 1}`,
          [...Object.values(values), id],
        )
      : await client.query('UPDATE legal_pages SET updated_at = NOW() WHERE id = $1', [id])
    if (!rowCount) throw notFound('Page not found.')
    if (sections) {
      await client.query('DELETE FROM legal_sections WHERE page_id = $1', [id])
      for (const [i, s] of sections.entries()) {
        await client.query('INSERT INTO legal_sections (page_id, heading, body, sort_order) VALUES ($1, $2, $3, $4)', [
          id,
          s.heading,
          s.body,
          i + 1,
        ])
      }
    }
  })

  const { rows } = await query(`${SELECT} WHERE p.id = $1`, [id])
  res.json({ data: camelRow(rows[0]), message: 'Page saved.' })
})

export default router
