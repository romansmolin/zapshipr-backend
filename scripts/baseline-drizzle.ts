import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { Pool } from 'pg'
import 'dotenv/config'

const migrationsDir = path.join(process.cwd(), 'src/db/migrations')
const journalPath = path.join(migrationsDir, 'meta/_journal.json')

const loadJournal = (): { entries: { when: number; tag: string }[] } => {
    const journalRaw = fs.readFileSync(journalPath, 'utf-8')
    return JSON.parse(journalRaw)
}

const buildDbConfig = (): {
    connectionString?: string
    host?: string
    port?: number
    user?: string
    password?: string
    database?: string
    ssl?: false | { rejectUnauthorized: boolean }
} => {
    if (process.env.DATABASE_URL) {
        return { connectionString: process.env.DATABASE_URL }
    }

    return {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl:
            (process.env.DB_SSL || 'false').toLowerCase() === 'true'
                ? { rejectUnauthorized: false }
                : false,
    }
}

const computeMigrationHash = (tag: string): string => {
    const sqlPath = path.join(migrationsDir, `${tag}.sql`)
    const sql = fs.readFileSync(sqlPath, 'utf-8')
    return crypto.createHash('sha256').update(sql).digest('hex')
}

const ensureDrizzleSchema = async (pool: Pool): Promise<void> => {
    await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle')
    await pool.query(
        'CREATE TABLE IF NOT EXISTS drizzle.\"__drizzle_migrations\" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)'
    )
}

const baseline = async (): Promise<void> => {
    const pool = new Pool(buildDbConfig())

    try {
        await ensureDrizzleSchema(pool)

        const journal = loadJournal()
        const existing = await pool.query('SELECT hash FROM drizzle.\"__drizzle_migrations\"')
        const existingHashes = new Set(existing.rows.map((row) => row.hash))

        let inserted = 0

        for (const entry of journal.entries) {
            const hash = computeMigrationHash(entry.tag)
            if (existingHashes.has(hash)) {
                continue
            }

            await pool.query(
                'INSERT INTO drizzle.\"__drizzle_migrations\" (hash, created_at) VALUES ($1, $2)',
                [hash, entry.when]
            )
            inserted += 1
        }

        console.log(`Baseline complete. Added ${inserted} migration(s).`)
    } finally {
        await pool.end()
    }
}

baseline().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
})
