import { Client } from 'pg'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

config()

async function applyDefaultWorkspaceMigration() {
    const dbUser = process.env.DB_USER
    const dbPassword = process.env.DB_PASSWORD
    const dbHost = process.env.DB_HOST
    const dbPort = process.env.DB_PORT
    const dbName = process.env.DB_NAME

    if (!dbUser || !dbPassword || !dbHost || !dbPort || !dbName) {
        console.error('❌ Missing database environment variables')
        return
    }

    const connectionString = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`
    console.log(`📡 Connecting to: postgresql://${dbUser}:***@${dbHost}:${dbPort}/${dbName}\n`)

    const client = new Client({ connectionString })

    try {
        await client.connect()
        console.log('🚀 Applying default workspace migration...\n')

        const migrationSqlPath = join(__dirname, '../src/db/migrations/0003_familiar_aaron_stack.sql')
        const sql = readFileSync(migrationSqlPath, 'utf-8')

        const statements = sql
            .split('--> statement-breakpoint')
            .map((s) => s.trim())
            .filter(Boolean)

        console.log(`📝 Found ${statements.length} SQL statements\n`)

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i]
            const preview = statement.substring(0, 70).replace(/\n/g, ' ')
            
            try {
                await client.query(statement)
                console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`)
            } catch (error: any) {
                if (error.message.includes('already exists') || error.message.includes('does not exist')) {
                    console.log(`⚠️  [${i + 1}/${statements.length}] Already applied: ${preview}...`)
                } else {
                    console.error(`❌ [${i + 1}/${statements.length}] Error: ${error.message}`)
                }
            }
        }

        console.log('\n' + '═'.repeat(60))
        console.log('✅ Migration completed!')
        console.log('═'.repeat(60))

        // Проверяем результат
        console.log('\n📊 Verifying workspaces schema...')
        const columnsCheck = await client.query(`
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'workspaces' 
            ORDER BY ordinal_position;
        `)
        
        console.log('   Workspaces columns:')
        columnsCheck.rows.forEach((col) => {
            const defaultVal = col.column_default ? ` (default: ${col.column_default})` : ''
            console.log(`   ✓ ${col.column_name}: ${col.data_type}${defaultVal}`)
        })

    } catch (error) {
        console.error('\n❌ Migration failed:', error)
    } finally {
        await client.end()
    }
}

applyDefaultWorkspaceMigration()


