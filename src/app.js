import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import { query } from './db/pool.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { UPLOAD_DIR } from './middleware/upload.js'
import adminRoutes from './routes/admin/index.js'
import authRoutes from './routes/auth.routes.js'
import publicRoutes from './routes/public.routes.js'

export const app = express()

app.set('trust proxy', 1) // correct client IPs for rate limiting behind a proxy
app.disable('x-powered-by')

// Images are loaded by the website and admin panel from other origins.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser clients (no Origin header) and listed origins.
      if (!origin || env.corsOrigins.includes(origin)) return cb(null, true)
      // In development, Vite may pick another port (5175, 5176, …) when one is busy.
      if (!env.isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return cb(null, true)
      cb(null, false)
    },
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(morgan(env.isProduction ? 'combined' : 'dev'))

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false }))

app.get('/api/health', async (_req, res) => {
  await query('SELECT 1')
  res.json({ status: 'ok', database: 'connected' })
})

app.use('/api/public', publicRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)

app.use(notFoundHandler)
app.use(errorHandler)
