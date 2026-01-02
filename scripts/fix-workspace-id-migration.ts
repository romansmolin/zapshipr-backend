import { Client } from 'pg'
import { config } from 'dotenv'

config()

async function fixWorkspaceIdMigration() {
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

        console.log('🔍 Step 1: Checking if workspace_id columns exist...')
        
        // Проверяем наличие колонки workspace_id в posts
        const postsCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'posts' AND column_name = 'workspace_id';
        `)
        
        // Проверяем наличие колонки workspace_id в social_accounts
        const socialAccountsCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'social_accounts' AND column_name = 'workspace_id';
        `)

        const postsHasWorkspaceId = postsCheck.rows.length > 0
        const socialAccountsHasWorkspaceId = socialAccountsCheck.rows.length > 0

        console.log(`   posts.workspace_id: ${postsHasWorkspaceId ? '✅ exists' : '❌ missing'}`)
        console.log(`   social_accounts.workspace_id: ${socialAccountsHasWorkspaceId ? '✅ exists' : '❌ missing'}\n`)

        // Step 2: Добавляем колонки как NULLABLE, если их нет
        if (!postsHasWorkspaceId) {
            console.log('🛠️  Step 2a: Adding workspace_id to posts as NULLABLE...')
            await client.query('ALTER TABLE posts ADD COLUMN workspace_id uuid;')
            console.log('   ✅ Added\n')
        }

        if (!socialAccountsHasWorkspaceId) {
            console.log('🛠️  Step 2b: Adding workspace_id to social_accounts as NULLABLE...')
            await client.query('ALTER TABLE social_accounts ADD COLUMN workspace_id uuid;')
            console.log('   ✅ Added\n')
        }

        // Step 3: Создаём дефолтный workspace для пользователей без workspace
        console.log('🛠️  Step 3: Creating default workspaces for users...')
        
        const usersWithoutWorkspace = await client.query(`
            SELECT DISTINCT u.id, u.name, u.email
            FROM users u
            LEFT JOIN workspaces w ON w.user_id = u.id
            WHERE w.id IS NULL;
        `)

        if (usersWithoutWorkspace.rows.length > 0) {
            console.log(`   Found ${usersWithoutWorkspace.rows.length} users without workspaces`)
            
            for (const user of usersWithoutWorkspace.rows) {
                const workspaceName = `${user.name}'s Workspace` || 'My Workspace'
                const result = await client.query(
                    `INSERT INTO workspaces (user_id, name, description) 
                     VALUES ($1, $2, $3) 
                     RETURNING id`,
                    [user.id, workspaceName, 'Default workspace']
                )
                console.log(`   ✅ Created workspace "${workspaceName}" for user ${user.email}`)
            }
        } else {
            console.log('   ✅ All users already have workspaces\n')
        }

        // Step 4: Устанавливаем workspace_id для существующих posts
        console.log('\n🛠️  Step 4: Setting workspace_id for existing posts...')
        
        const postsWithoutWorkspace = await client.query(`
            SELECT COUNT(*) as count 
            FROM posts 
            WHERE workspace_id IS NULL;
        `)
        
        if (parseInt(postsWithoutWorkspace.rows[0].count) > 0) {
            await client.query(`
                UPDATE posts p
                SET workspace_id = (
                    SELECT w.id 
                    FROM workspaces w 
                    WHERE w.user_id = p.user_id 
                    LIMIT 1
                )
                WHERE p.workspace_id IS NULL;
            `)
            console.log(`   ✅ Updated ${postsWithoutWorkspace.rows[0].count} posts\n`)
        } else {
            console.log('   ✅ All posts already have workspace_id\n')
        }

        // Step 5: Устанавливаем workspace_id для существующих social_accounts
        console.log('🛠️  Step 5: Setting workspace_id for existing social_accounts...')
        
        const socialAccountsWithoutWorkspace = await client.query(`
            SELECT COUNT(*) as count 
            FROM social_accounts 
            WHERE workspace_id IS NULL;
        `)
        
        if (parseInt(socialAccountsWithoutWorkspace.rows[0].count) > 0) {
            await client.query(`
                UPDATE social_accounts sa
                SET workspace_id = (
                    SELECT w.id 
                    FROM workspaces w 
                    WHERE w.user_id = sa.user_id 
                    LIMIT 1
                )
                WHERE sa.workspace_id IS NULL;
            `)
            console.log(`   ✅ Updated ${socialAccountsWithoutWorkspace.rows[0].count} social accounts\n`)
        } else {
            console.log('   ✅ All social accounts already have workspace_id\n')
        }

        // Step 6: Делаем колонки NOT NULL
        console.log('🛠️  Step 6: Making workspace_id columns NOT NULL...')
        
        try {
            await client.query('ALTER TABLE posts ALTER COLUMN workspace_id SET NOT NULL;')
            console.log('   ✅ posts.workspace_id is now NOT NULL')
        } catch (error: any) {
            if (error.message.includes('not-null constraint')) {
                console.log('   ⚠️  posts.workspace_id already NOT NULL')
            } else {
                throw error
            }
        }

        try {
            await client.query('ALTER TABLE social_accounts ALTER COLUMN workspace_id SET NOT NULL;')
            console.log('   ✅ social_accounts.workspace_id is now NOT NULL\n')
        } catch (error: any) {
            if (error.message.includes('not-null constraint')) {
                console.log('   ⚠️  social_accounts.workspace_id already NOT NULL\n')
            } else {
                throw error
            }
        }

        // Step 7: Добавляем foreign key constraints
        console.log('🛠️  Step 7: Adding foreign key constraints...')
        
        try {
            await client.query(`
                ALTER TABLE posts 
                ADD CONSTRAINT posts_workspace_id_workspaces_id_fk 
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) 
                ON DELETE CASCADE;
            `)
            console.log('   ✅ posts → workspaces constraint added')
        } catch (error: any) {
            if (error.message.includes('already exists')) {
                console.log('   ⚠️  posts → workspaces constraint already exists')
            } else {
                throw error
            }
        }

        try {
            await client.query(`
                ALTER TABLE social_accounts 
                ADD CONSTRAINT social_accounts_workspace_id_workspaces_id_fk 
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) 
                ON DELETE CASCADE;
            `)
            console.log('   ✅ social_accounts → workspaces constraint added\n')
        } catch (error: any) {
            if (error.message.includes('already exists')) {
                console.log('   ⚠️  social_accounts → workspaces constraint already exists\n')
            } else {
                throw error
            }
        }

        console.log('═'.repeat(60))
        console.log('🎉 Migration fix completed successfully!')
        console.log('═'.repeat(60))

    } catch (error) {
        console.error('\n❌ Error:', error)
    } finally {
        await client.end()
    }
}

fixWorkspaceIdMigration()



