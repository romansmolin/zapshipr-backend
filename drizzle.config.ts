import 'dotenv/config'

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './src/db/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? '5432'),
        user: process.env.DB_USER ?? 'app_user',
        password: process.env.DB_PASSWORD ?? 'app_password',
        database: process.env.DB_NAME ?? 'app_db',
    },
    ssl: (process.env.DB_SSL ?? 'false').toLowerCase() === 'true',
})
