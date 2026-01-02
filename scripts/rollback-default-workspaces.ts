import { Client } from 'pg'
import { config } from 'dotenv'

config()

async function rollbackDefaultWorkspaces() {
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

        console.log('🔄 Rolling back default workspace creation...\n')

        // Step 1: Удаляем foreign key constraints
        console.log('🛠️  Step 1: Dropping foreign key constraints...')
        
        try {
            await client.query(`
                ALTER TABLE posts 
                DROP CONSTRAINT IF EXISTS posts_workspace_id_workspaces_id_fk;
            `)
            console.log('   ✅ Dropped posts → workspaces constraint')
        } catch (error: any) {
            console.log(`   ⚠️  ${error.message}`)
        }

        try {
            await client.query(`
                ALTER TABLE social_accounts 
                DROP CONSTRAINT IF EXISTS social_accounts_workspace_id_workspaces_id_fk;
            `)
            console.log('   ✅ Dropped social_accounts → workspaces constraint\n')
        } catch (error: any) {
            console.log(`   ⚠️  ${error.message}\n`)
        }

        // Step 2: Делаем workspace_id nullable
        console.log('🛠️  Step 2: Making workspace_id columns nullable...')
        
        try {
            await client.query('ALTER TABLE posts ALTER COLUMN workspace_id DROP NOT NULL;')
            console.log('   ✅ posts.workspace_id is now nullable')
        } catch (error: any) {
            console.log(`   ⚠️  ${error.message}`)
        }

        try {
            await client.query('ALTER TABLE social_accounts ALTER COLUMN workspace_id DROP NOT NULL;')
            console.log('   ✅ social_accounts.workspace_id is now nullable\n')
        } catch (error: any) {
            console.log(`   ⚠️  ${error.message}\n`)
        }

        // Step 3: Очищаем workspace_id в существующих записях
        console.log('🛠️  Step 3: Clearing workspace_id from existing records...')
        
        const postsUpdated = await client.query(`
            UPDATE posts SET workspace_id = NULL WHERE workspace_id IS NOT NULL RETURNING id;
        `)
        console.log(`   ✅ Cleared workspace_id from ${postsUpdated.rowCount || 0} posts`)

        const socialAccountsUpdated = await client.query(`
            UPDATE social_accounts SET workspace_id = NULL WHERE workspace_id IS NOT NULL RETURNING id;
        `)
        console.log(`   ✅ Cleared workspace_id from ${socialAccountsUpdated.rowCount || 0} social accounts\n`)

        // Step 4: Удаляем автоматически созданные workspace
        console.log('🛠️  Step 4: Deleting auto-created workspaces...')
        
        const workspacesDeleted = await client.query(`
            DELETE FROM workspaces 
            WHERE description = 'Default workspace'
            RETURNING id, name, user_id;
        `)
        
        if (workspacesDeleted.rowCount && workspacesDeleted.rowCount > 0) {
            console.log(`   ✅ Deleted ${workspacesDeleted.rowCount} auto-created workspaces:`)
            workspacesDeleted.rows.forEach((ws) => {
                console.log(`      - "${ws.name}" (${ws.id})`)
            })
        } else {
            console.log('   ℹ️  No auto-created workspaces found')
        }

        // Step 5: Проверяем результат
        console.log('\n📊 Final state:')
        
        const workspacesCount = await client.query('SELECT COUNT(*) as count FROM workspaces;')
        console.log(`   Workspaces: ${workspacesCount.rows[0].count}`)
        
        const postsWithWorkspace = await client.query('SELECT COUNT(*) as count FROM posts WHERE workspace_id IS NOT NULL;')
        console.log(`   Posts with workspace_id: ${postsWithWorkspace.rows[0].count}`)
        
        const socialAccountsWithWorkspace = await client.query('SELECT COUNT(*) as count FROM social_accounts WHERE workspace_id IS NOT NULL;')
        console.log(`   Social accounts with workspace_id: ${socialAccountsWithWorkspace.rows[0].count}`)

        console.log('\n' + '═'.repeat(60))
        console.log('✅ Rollback completed successfully!')
        console.log('═'.repeat(60))
        console.log('\n💡 Next steps:')
        console.log('   1. Users will create workspaces during onboarding')
        console.log('   2. After workspace creation, they can create posts & connect accounts')

    } catch (error) {
        console.error('\n❌ Error:', error)
    } finally {
        await client.end()
    }
}

rollbackDefaultWorkspaces()

