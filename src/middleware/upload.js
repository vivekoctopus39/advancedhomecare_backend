import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { env } from '../config/env.js'
import { badRequest } from '../utils/httpError.js'

export const UPLOAD_DIR = path.resolve(import.meta.dirname, '../../uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const ALLOWED = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  // SVG is intentionally not allowed: it can carry scripts.
}

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const base = path
      .parse(file.originalname)
      .name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'image'
    cb(null, `${base}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ALLOWED[file.mimetype]}`)
  },
})

export const imageUpload = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED[file.mimetype]) cb(null, true)
    else cb(badRequest('Only JPG, PNG, WEBP or GIF images are allowed.'))
  },
})

export function removeUploadedFile(fileName) {
  if (!fileName || fileName.includes('/') || fileName.includes('\\')) return
  fs.promises.unlink(path.join(UPLOAD_DIR, fileName)).catch(() => {})
}
