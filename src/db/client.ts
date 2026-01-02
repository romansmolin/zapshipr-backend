import 'dotenv/config'

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { schema } from './schema'

const connectionString = process.env.DATABASE_URL

const ssl = (process.env.DB_SSL ?? 'false').toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined

const pool = connectionString
    ? new Pool({ connectionString, ssl })
    : new Pool({
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? '5432'),
          user: process.env.DB_USER ?? 'app_user',
          password: process.env.DB_PASSWORD ?? 'app_password',
          database: process.env.DB_NAME ?? 'app_db',
          ssl,
      })

export const db = drizzle(pool, { schema })
export type DbClient = typeof db
