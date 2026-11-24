import { badRequest } from './httpError.js'

export const toSnake = (key) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
export const toCamel = (key) => key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())

/** Convert a DB row (snake_case) to camelCase keys. */
export const camelRow = (row) =>
  row ? Object.fromEntries(Object.entries(row).map(([k, v]) => [toCamel(k), v])) : row

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Site-relative paths (/about, #faq), http(s), mailto: and tel: links.
const LINK_RE = /^(\/|#|https?:\/\/|mailto:|tel:)/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function checkField(field, raw) {
  const { type = 'string', required, max, min, values } = field
  let value = raw

  if (typeof value === 'string') value = value.trim()
  const empty = value === undefined || value === null || value === ''

  if (empty) {
    if (required) return { error: 'is required.' }
    if (type === 'int' || type === 'date' || type === 'fk') return { value: null }
    if (type === 'bool') return { value: false }
    return { value: '' }
  }

  switch (type) {
    case 'string':
    case 'text':
      if (typeof value !== 'string') return { error: 'must be text.' }
      if (max && value.length > max) return { error: `must be at most ${max} characters.` }
      if (min && value.length < min) return { error: `must be at least ${min} characters.` }
      return { value }
    case 'link':
      if (typeof value !== 'string' || !LINK_RE.test(value)) {
        return { error: 'must start with /, #, http(s)://, mailto: or tel:.' }
      }
      if (max && value.length > max) return { error: `must be at most ${max} characters.` }
      return { value }
    case 'email':
      if (typeof value !== 'string' || !EMAIL_RE.test(value)) return { error: 'must be a valid email address.' }
      return { value: value.toLowerCase() }
    case 'int':
    case 'fk': {
      const num = Number(value)
      if (!Number.isInteger(num)) return { error: 'must be a whole number.' }
      if (min !== undefined && num < min) return { error: `must be ${min} or more.` }
      if (field.maxValue !== undefined && num > field.maxValue) return { error: `must be ${field.maxValue} or less.` }
      return { value: num }
    }
    case 'bool':
      if (typeof value === 'boolean') return { value }
      if (value === 'true' || value === 1 || value === '1') return { value: true }
      if (value === 'false' || value === 0 || value === '0') return { value: false }
      return { error: 'must be true or false.' }
    case 'date':
      if (!DATE_RE.test(value) || Number.isNaN(Date.parse(value))) return { error: 'must be a date (YYYY-MM-DD).' }
      return { value }
    case 'enum':
      if (!values.includes(value)) return { error: `must be one of: ${values.join(', ')}.` }
      return { value }
    default:
      return { value }
  }
}

/**
 * Validate a request body against field definitions.
 * Field keys are camelCase; the result is keyed by DB column (snake_case).
 * With `partial: true` (updates), missing keys are skipped instead of required.
 */
export function validateBody(fields, body = {}, { partial = false } = {}) {
  const values = {}
  const errors = {}
  for (const field of fields) {
    const present = Object.prototype.hasOwnProperty.call(body, field.key)
    if (partial && !present) continue
    if (!present && !field.required) {
      // Omitted optional field: use its default, or let the DB default apply.
      if (field.default !== undefined) values[field.column || toSnake(field.key)] = field.default
      continue
    }
    const { value, error } = checkField(field, body[field.key])
    if (error) errors[field.key] = `${field.label || field.key} ${error}`
    else values[field.column || toSnake(field.key)] = value
  }
  if (Object.keys(errors).length) throw badRequest('Please check the highlighted fields.', errors)
  return values
}

/** Validate a list of strings (feature bullets, skills, …). */
export function validateStringList(list, { label, max = 300, maxItems = 30 } = {}) {
  if (list === undefined) return undefined
  if (!Array.isArray(list)) throw badRequest(`${label} must be a list.`)
  const clean = list.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
  if (clean.length > maxItems) throw badRequest(`${label} can have at most ${maxItems} items.`)
  const tooLong = clean.find((s) => s.length > max)
  if (tooLong) throw badRequest(`Each item in ${label} must be at most ${max} characters.`)
  return clean
}

export function parseId(value, label = 'id') {
  const id = Number(value)
  if (!Number.isInteger(id) || id < 1) throw badRequest(`Invalid ${label}.`)
  return id
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}
