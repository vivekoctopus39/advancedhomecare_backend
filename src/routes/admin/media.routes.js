import { Router } from 'express'
import { query } from '../../db/pool.js'
import { imageUpload, removeUploadedFile } from '../../middleware/upload.js'
import { badRequest, conflict, notFound } from '../../utils/httpError.js'
import { camelRow, parseId, validateBody } from '../../utils/validate.js'

const router = Router()

// Places that can reference an image; used to block deleting images in use.
const USAGE = `
  (SELECT COUNT(*) FROM site_settings WHERE logo_media_id = m.id) +
  (SELECT COUNT(*) FROM page_sections WHERE image_media_id = m.id) +
  (SELECT COUNT(*) FROM services WHERE image_media_id = m.id) +
  (SELECT COUNT(*) FROM team_members WHERE image_media_id = m.id)`

router.get('/', async (_req, res) => {
  const { rows } = await query(`SELECT m.*, (${USAGE})::int AS usage_count FROM media m ORDER BY m.created_at DESC, m.id DESC`)
  res.json({ data: rows.map(camelRow) })
})

/** POST /api/admin/media  multipart/form-data: file=<image>, altText=<text> */
router.post('/', imageUpload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Please choose an image file (field name "file").')
  try {
    const { alt_text: alt } = validateBody([{ key: 'altText', label: 'Alt text', max: 255 }], req.body || {})
    const { rows } = await query(
      `INSERT INTO media (file_name, original_name, mime_type, size_bytes, url, alt_text)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.file.filename, req.file.originalname.slice(0, 255), req.file.mimetype, req.file.size, `/uploads/${req.file.filename}`, alt],
    )
    res.status(201).json({ data: camelRow(rows[0]), message: 'Image uploaded.' })
  } catch (error) {
    removeUploadedFile(req.file.filename)
    throw error
  }
})

/** PUT /api/admin/media/:id  { altText } */
router.put('/:id', async (req, res) => {
  const { alt_text: alt } = validateBody([{ key: 'altText', label: 'Alt text', required: true, max: 255 }], req.body)
  const { rows } = await query('UPDATE media SET alt_text = $1 WHERE id = $2 RETURNING *', [alt, parseId(req.params.id)])
  if (!rows[0]) throw notFound('Image not found.')
  res.json({ data: camelRow(rows[0]), message: 'Image updated.' })
})

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  const { rows } = await query(`SELECT m.file_name, (${USAGE})::int AS usage_count FROM media m WHERE m.id = $1`, [id])
  if (!rows[0]) throw notFound('Image not found.')
  if (rows[0].usage_count > 0) {
    throw conflict('This image is used on the website. Replace it where it is used before deleting it.')
  }
  await query('DELETE FROM media WHERE id = $1', [id])
  removeUploadedFile(rows[0].file_name)
  res.json({ message: 'Image deleted.' })
})

export default router
