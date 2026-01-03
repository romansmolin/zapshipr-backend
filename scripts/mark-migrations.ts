import { Pool } from 'pg'
import { getEnvVar } from '../src/shared/utils/get-env-var'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

async function markMigrationsAsApplied() {
    const pool = new Pool({
        connectionString: getEnvVar('DATABASE_URL'),
    })

    try {
        console.log('🔍 Marking migrations as applied...\n')

        // Read migrations folder
        const migrationsPath = path.join(__dirname, '../src/db/migrations')
        const files = fs.readdirSync(migrationsPath)
            .filter(f => f.endsWith('.sql'))
            .sort()

        console.log('Found migrations:', files)
        console.log('')

        // Check if __drizzle_migrations table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = '__drizzle_migrations'
            );
        `)

        if (!tableCheck.rows[0].exists) {
            console.log('Creating __drizzle_migrations table...')
            await pool.query(`
                CREATE TABLE __drizzle_migrations (
                    id SERIAL PRIMARY KEY,
                    hash text NOT NULL,
                    created_at bigint
                );
            `)
        }

        // Check current migrations
        const currentMigrations = await pool.query(`
            SELECT hash FROM __drizzle_migrations ORDER BY id;
        `)

        console.log('Currently applied migrations:', currentMigrations.rows.length)
        console.log('')

        // Mark first migration as applied if not already
        if (currentMigrations.rows.length === 0) {
            console.log('⚠️  No migrations applied yet. Marking first migration as applied...')
            
            const firstMigration = '0000_ambiguous_magma'
            await pool.query(`
                INSERT INTO __drizzle_migrations (hash, created_at) 
                VALUES ($1, $2);
            `, [firstMigration, Date.now()])

            console.log(`✅ Marked ${firstMigration} as applied`)
        } else {
            console.log('✅ First migration already applied')
        }

        // Now try to run remaining migrations
        console.log('\n📝 Now you can run: npx drizzle-kit migrate')

    } catch (error) {
        console.error('❌ Error:', error)
    } finally {
        await pool.end()
    }
}

markMigrationsAsApplied()




