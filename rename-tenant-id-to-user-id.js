const pg = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const { Client } = pg

const ssl = (process.env.DB_SSL ?? 'false').toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined

const client = process.env.DATABASE_URL
    ? new Client({ connectionString: process.env.DATABASE_URL, ssl })
    : new Client({
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? '5432'),
          user: process.env.DB_USER ?? 'app_user',
          password: process.env.DB_PASSWORD ?? 'app_password',
          database: process.env.DB_NAME ?? 'app_db',
          ssl,
      })

const tablesToRename = [
    'social_accounts',
    'user_plans',
    'password_reset_tokens',
    'media_assets',
    'posts',
    'pinterest_boards',
    'tiktok_publish_jobs',
    'user_plan_usage',
    'tenant_settings',
]

async function renameTenantIdToUserId() {
    try {
        await client.connect()
        console.log('✅ Connected to database')

        for (const tableName of tablesToRename) {
            try {
                // Check if table exists and has tenant_id column
                const checkResult = await client.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = $1 AND column_name = 'tenant_id'
                `, [tableName])

                if (checkResult.rows.length === 0) {
                    console.log(`⏭️  Table ${tableName} doesn't have tenant_id column, skipping...`)
                    continue
                }

                // Check if user_id already exists
                const checkUserId = await client.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = $1 AND column_name = 'user_id'
                `, [tableName])

                if (checkUserId.rows.length > 0) {
                    console.log(`⏭️  Table ${tableName} already has user_id column, skipping...`)
                    continue
                }

                // Drop foreign key constraint if it exists
                const fkResult = await client.query(`
                    SELECT constraint_name
                    FROM information_schema.table_constraints
                    WHERE table_name = $1 
                    AND constraint_type = 'FOREIGN KEY'
                    AND constraint_name LIKE '%tenant_id%'
                `, [tableName])

                for (const fk of fkResult.rows) {
                    console.log(`   Dropping foreign key: ${fk.constraint_name}`)
                    await client.query(`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${fk.constraint_name}`)
                }

                // Drop unique constraints if they reference tenant_id
                const uniqueResult = await client.query(`
                    SELECT constraint_name
                    FROM information_schema.table_constraints
                    WHERE table_name = $1 
                    AND constraint_type = 'UNIQUE'
                    AND constraint_name LIKE '%tenant%'
                `, [tableName])

                for (const unique of uniqueResult.rows) {
                    console.log(`   Dropping unique constraint: ${unique.constraint_name}`)
                    await client.query(`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${unique.constraint_name}`)
                }

                // Rename the column
                console.log(`🔄 Renaming tenant_id to user_id in ${tableName}...`)
                await client.query(`ALTER TABLE ${tableName} RENAME COLUMN tenant_id TO user_id`)

                // Recreate foreign key constraint pointing to users table
                console.log(`   Recreating foreign key constraint...`)
                await client.query(`
                    ALTER TABLE ${tableName} 
                    ADD CONSTRAINT ${tableName}_user_id_fkey 
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                `)

                // Recreate unique constraints if needed
                if (tableName === 'social_accounts') {
                    await client.query(`
                        ALTER TABLE ${tableName}
                        ADD CONSTRAINT social_accounts_user_page_unique 
                        UNIQUE (user_id, page_id)
                    `)
                }
                if (tableName === 'pinterest_boards') {
                    await client.query(`
                        ALTER TABLE ${tableName}
                        ADD CONSTRAINT pinterest_boards_user_id_pinterest_board_id_key 
                        UNIQUE (user_id, pinterest_board_id)
                    `)
                }
                if (tableName === 'tenant_settings') {
                    await client.query(`
                        ALTER TABLE ${tableName}
                        ADD CONSTRAINT tenant_settings_user_id_key 
                        UNIQUE (user_id)
                    `)
                }

                console.log(`✅ Successfully renamed tenant_id to user_id in ${tableName}`)
            } catch (error) {
                console.error(`❌ Error processing ${tableName}:`, error.message)
                // Continue with other tables
            }
        }

        console.log('\n✅ Migration completed!')
    } catch (error) {
        console.error('❌ Migration failed:', error)
        process.exit(1)
    } finally {
        await client.end()
    }
}

renameTenantIdToUserId()

