import { Pool } from 'pg'
import { getEnvVar } from '../src/shared/utils/get-env-var'

async function checkMigrations() {
    const pool = new Pool({
        connectionString: getEnvVar('DATABASE_URL'),
    })

    try {
        console.log('🔍 Checking migrations status...\n')

        // Check if migrations table exists
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `)

        console.log('📊 Current tables in database:')
        tablesResult.rows.forEach((row) => {
            console.log(`  - ${row.table_name}`)
        })

        console.log('\n')

        // Check migrations
        const migrationsResult = await pool.query(`
            SELECT id, hash, created_at 
            FROM __drizzle_migrations 
            ORDER BY id;
        `)

        console.log('✅ Applied migrations:')
        if (migrationsResult.rows.length === 0) {
            console.log('  (none)')
        } else {
            migrationsResult.rows.forEach((row) => {
                console.log(`  ${row.id}. ${row.hash} (${row.created_at})`)
            })
        }
    } catch (error) {
        console.error('❌ Error:', error)
        if (error instanceof Error) {
            console.error('Message:', error.message)
            console.error('Stack:', error.stack)
        }
    } finally {
        await pool.end()
    }
}

checkMigrations()

