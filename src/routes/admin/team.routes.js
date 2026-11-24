import { Router } from 'express'
import { query, withTransaction } from '../../db/pool.js'
import { badRequest, notFound } from '../../utils/httpError.js'
import { camelRow, parseId, validateBody, validateStringList } from '../../utils/validate.js'

const router = Router()

const fields = [
  { key: 'roleTitle', label: 'Role title', required: true, max: 120 },
  { key: 'description', label: 'Description', max: 500 },
  { key: 'imageMediaId', label: 'Image', type: 'fk' },
  { key: 'isSample', type: 'bool', default: false },
  { key: 'sortOrder', type: 'int', min: 0 },
  { key: 'isActive', type: 'bool', default: true },
]

const SELECT = `
  SELECT t.*, m.url AS image_url, m.alt_text AS image_alt,
         COALESCE((SELECT json_agg(k.skill ORDER BY k.sort_order, k.id)
                   FROM team_member_skills k WHERE k.team_member_id = t.id), '[]') AS skills
  FROM team_members t LEFT JOIN media m ON m.id = t.image_media_id`

async function getOne(id) {
  const { rows } = await query(`${SELECT} WHERE t.id = $1`, [id])
  if (!rows[0]) throw notFound('Team member not found.')
  return camelRow(rows[0])
}

async function replaceSkills(client, id, skills) {
  if (skills === undefined) return
  await client.query('DELETE FROM team_member_skills WHERE team_member_id = $1', [id])
  for (const [i, skill] of skills.entries()) {
    await client.query('INSERT INTO team_member_skills (team_member_id, skill, sort_order) VALUES ($1, $2, $3)', [id, skill, i + 1])
  }
}

router.get('/', async (_req, res) => {
  const { rows } = await query(`${SELECT} ORDER BY t.sort_order, t.id`)
  res.json({ data: rows.map(camelRow) })
})

router.put('/reorder', async (req, res) => {
  const ids = req.body?.ids
  if (!Array.isArray(ids) || !ids.length) throw badRequest('"ids" must be a non-empty list.')
  const clean = ids.map((raw) => parseId(raw))
  await withTransaction(async (client) => {
    for (const [i, id] of clean.entries()) {
      await client.query('UPDATE team_members SET sort_order = $1 WHERE id = $2', [i + 1, id])
    }
  })
  res.json({ message: 'Order updated.' })
})

router.get('/:id', async (req, res) => {
  res.json({ data: await getOne(parseId(req.params.id)) })
})

/** POST  { roleTitle, description, imageMediaId, skills: [..] } */
router.post('/', async (req, res) => {
  const values = validateBody(fields, req.body)
  const skills = validateStringList(req.body.skills, { label: 'Skills', max: 80, maxItems: 12 }) || []
  const id = await withTransaction(async (client) => {
    if (values.sort_order === undefined) {
      const { rows } = await client.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM team_members')
      values.sort_order = rows[0].next
    }
    const columns = Object.keys(values)
    const { rows } = await client.query(
      `INSERT INTO team_members (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      Object.values(values),
    )
    await replaceSkills(client, rows[0].id, skills)
    return rows[0].id
  })
  res.status(201).json({ data: await getOne(id), message: 'Team member created.' })
})

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const values = validateBody(fields, req.body, { partial: true })
  const skills = validateStringList(req.body.skills, { label: 'Skills', max: 80, maxItems: 12 })
  await withTransaction(async (client) => {
    const columns = Object.keys(values)
    const { rowCount } = columns.length
      ? await client.query(
          `UPDATE team_members SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${columns.length + 1}`,
          [...Object.values(values), id],
        )
      : await client.query('SELECT 1 FROM team_members WHERE id = $1', [id])
    if (!rowCount) throw notFound('Team member not found.')
    await replaceSkills(client, id, skills)
  })
  res.json({ data: await getOne(id), message: 'Team member updated.' })
})

router.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM team_members WHERE id = $1', [parseId(req.params.id)])
  if (!rowCount) throw notFound('Team member not found.')
  res.json({ message: 'Team member deleted.' })
})

export default router
