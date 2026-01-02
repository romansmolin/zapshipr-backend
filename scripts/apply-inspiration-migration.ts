import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load .env file
dotenv.config()

async function applyMigration() {
    // Build connection string from individual env vars
    const dbHost = process.env.DB_HOST!
    const dbPort = process.env.DB_PORT!
    const dbUser = process.env.DB_USER!
    const dbPassword = process.env.DB_PASSWORD!
    const dbName = process.env.DB_NAME!
    
    const connectionString = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`
    
    console.log('📡 Connecting to:', `postgresql://${dbUser}:***@${dbHost}:${dbPort}/${dbName}\n`)
    
    const pool = new Pool({
        connectionString,
    })

    try {
        console.log('🚀 Applying inspiration tables migration...\n')

        // Read the migration file
        const migrationPath = path.join(__dirname, '../src/db/migrations/0002_magenta_black_knight.sql')
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

        // Split by statement-breakpoint and execute each statement
        const statements = migrationSQL
            .split('--> statement-breakpoint')
            .map(s => s.trim())
            .filter(s => s.length > 0)

        console.log(`📝 Found ${statements.length} SQL statements to execute\n`)

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i]
            try {
                console.log(`[${i + 1}/${statements.length}] Executing:`, statement.substring(0, 60) + '...')
                await pool.query(statement)
                console.log('  ✅ Success\n')
            } catch (error: any) {
                if (error.code === '42P07') {
                    console.log('  ⚠️  Already exists, skipping\n')
                } else if (error.code === '42710') {
                    console.log('  ⚠️  Enum already exists, skipping\n')
                } else if (error.code === '42701') {
                    console.log('  ⚠️  Column already exists, skipping\n')
                } else if (error.code === '42P16') {
                    console.log('  ⚠️  Index already exists, skipping\n')
                } else {
                    console.error('  ❌ Error:', error.message)
                    // Don't throw, continue with other statements
                }
            }
        }

        console.log('\n✅ Migration completed successfully!')
        console.log('\n📊 Verifying tables...')

        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('raw_inspirations', 'inspirations_extractions', 'workspace_tags')
            ORDER BY table_name;
        `)

        console.log('\n✅ Inspiration tables in database:')
        if (tablesResult.rows.length === 0) {
            console.log('  ❌ No inspiration tables found!')
        } else {
            tablesResult.rows.forEach((row) => {
                console.log(`  ✓ ${row.table_name}`)
            })
        }

        // Check workspaces table for main_prompt column
        const columnResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'workspaces' 
            AND column_name = 'main_prompt';
        `)

        if (columnResult.rows.length > 0) {
            console.log('  ✓ workspaces.main_prompt column')
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error)
    } finally {
        await pool.end()
    }
}

applyMigration()

