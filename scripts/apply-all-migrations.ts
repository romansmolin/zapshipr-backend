import { Client } from 'pg'
import { config } from 'dotenv'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

config() // Load environment variables

async function applyAllMigrations() {
    const dbUser = process.env.DB_USER
    const dbPassword = process.env.DB_PASSWORD
    const dbHost = process.env.DB_HOST
    const dbPort = process.env.DB_PORT
    const dbName = process.env.DB_NAME

    if (!dbUser || !dbPassword || !dbHost || !dbPort || !dbName) {
        console.error('❌ Error: Missing one or more database environment variables')
        return
    }

    const connectionString = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`
    console.log(`📡 Connecting to: postgresql://${dbUser}:***@${dbHost}:${dbPort}/${dbName}`)

    const client = new Client({ connectionString })

    try {
        await client.connect()
        console.log('✅ Connected to database\n')

        // Получаем все SQL файлы миграций
        const migrationsDir = join(__dirname, '../src/db/migrations')
        const files = readdirSync(migrationsDir)
            .filter((f) => f.endsWith('.sql'))
            .sort() // Сортируем по имени (0000, 0001, 0002...)

        console.log(`📝 Found ${files.length} migration files:\n`)

        for (const file of files) {
            console.log(`\n🚀 Applying migration: ${file}`)
            console.log('─'.repeat(60))

            const migrationPath = join(migrationsDir, file)
            const sql = readFileSync(migrationPath, 'utf-8')

            const statements = sql
                .split('--> statement-breakpoint')
                .map((s) => s.trim())
                .filter(Boolean)

            console.log(`   Found ${statements.length} SQL statements`)

            let successCount = 0
            let errorCount = 0

            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i]
                const preview = statement.substring(0, 60).replace(/\n/g, ' ')
                
                try {
                    await client.query(statement)
                    successCount++
                    console.log(`   ✅ [${i + 1}/${statements.length}] ${preview}...`)
                } catch (error: any) {
                    // Игнорируем ошибки "already exists"
                    if (
                        error.message.includes('already exists') ||
                        error.message.includes('duplicate key')
                    ) {
                        successCount++
                        console.log(`   ⚠️  [${i + 1}/${statements.length}] Already exists: ${preview}...`)
                    } else {
                        errorCount++
                        console.error(`   ❌ [${i + 1}/${statements.length}] Error: ${error.message}`)
                    }
                }
            }

            console.log(`\n   Summary: ${successCount} succeeded, ${errorCount} failed`)
        }

        console.log('\n' + '═'.repeat(60))
        console.log('📊 Verifying all tables...')
        console.log('═'.repeat(60))

        const checkQuery = `
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename;
        `
        const res = await client.query(checkQuery)
        const existingTables = res.rows.map((row) => row.tablename)

        console.log(`\n✅ Found ${existingTables.length} tables in database:`)
        existingTables.forEach((table) => {
            console.log(`   ✓ ${table}`)
        })

        const expectedTables = [
            'users',
            'workspaces',
            'social_accounts',
            'posts',
            'media_assets',
            'post_targets',
            'post_media_assets',
            'pinterest_boards',
            'waitlist_entries',
            'waitlist_referral_events',
            'waitlist_referral_rewards',
            'raw_inspirations',
            'inspirations_extractions',
            'workspace_tags',
        ]

        const missingTables = expectedTables.filter((table) => !existingTables.includes(table))

        if (missingTables.length === 0) {
            console.log('\n🎉 All expected tables verified successfully!')
        } else {
            console.error(`\n❌ Missing tables: ${missingTables.join(', ')}`)
        }
    } catch (error) {
        console.error('\n❌ Migration failed:', error)
    } finally {
        await client.end()
    }
}

applyAllMigrations()

