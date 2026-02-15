import 'dotenv/config'

import { and, asc, eq, isNull, or } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

import { db } from '@/db/client'
import { posts, postTargets } from '@/modules/post/entity/post.schema'
import { PostStatus } from '@/modules/post/types/posts.types'
import { socialAccounts } from '@/modules/social/entity/social-account.schema'
import { workspaces } from '@/modules/workspace/entity/workspace.schema'

const parseArg = (name: string): string | undefined => {
    const prefixed = `--${name}=`
    const withEquals = process.argv.find((arg) => arg.startsWith(prefixed))
    if (withEquals) {
        return withEquals.slice(prefixed.length)
    }

    const index = process.argv.findIndex((arg) => arg === `--${name}`)
    if (index === -1) {
        return undefined
    }

    return process.argv[index + 1]
}

const pickTargetStatuses = (status: PostStatus, targetCount: number): PostStatus[] => {
    if (status === PostStatus.PARTIALLY_DONE && targetCount >= 2) {
        return [PostStatus.DONE, PostStatus.FAILED]
    }

    switch (status) {
        case PostStatus.DONE:
            return Array.from({ length: targetCount }, () => PostStatus.DONE)
        case PostStatus.FAILED:
            return Array.from({ length: targetCount }, () => PostStatus.FAILED)
        case PostStatus.POSTING:
            return Array.from({ length: targetCount }, () => PostStatus.POSTING)
        case PostStatus.DRAFT:
            return Array.from({ length: targetCount }, () => PostStatus.PENDING)
        case PostStatus.PENDING:
        case PostStatus.PARTIALLY_DONE:
        default:
            return Array.from({ length: targetCount }, () => PostStatus.PENDING)
    }
}

const run = async (): Promise<void> => {
    const requestedWorkspaceId = parseArg('workspaceId')
    const requestedUserId = parseArg('userId')
    const countArg = Number.parseInt(parseArg('count') ?? '12', 10)
    const count = Number.isFinite(countArg) && countArg > 0 ? Math.min(countArg, 200) : 12

    let workspace = null as { id: string; userId: string } | null

    if (requestedWorkspaceId) {
        const [foundWorkspace] = await db
            .select({ id: workspaces.id, userId: workspaces.userId })
            .from(workspaces)
            .where(eq(workspaces.id, requestedWorkspaceId))
            .limit(1)

        workspace = foundWorkspace ?? null
    } else if (requestedUserId) {
        const [foundWorkspace] = await db
            .select({ id: workspaces.id, userId: workspaces.userId })
            .from(workspaces)
            .where(eq(workspaces.userId, requestedUserId))
            .orderBy(asc(workspaces.createdAt))
            .limit(1)

        workspace = foundWorkspace ?? null
    } else {
        const [foundWorkspace] = await db
            .select({ id: workspaces.id, userId: workspaces.userId })
            .from(workspaces)
            .orderBy(asc(workspaces.createdAt))
            .limit(1)

        workspace = foundWorkspace ?? null
    }

    if (!workspace) {
        throw new Error('Workspace not found. Pass --workspaceId=<id> or --userId=<id>.')
    }

    if (requestedUserId && requestedUserId !== workspace.userId) {
        throw new Error('Provided --userId does not match workspace owner.')
    }

    const userId = workspace.userId
    const workspaceId = workspace.id

    const accounts = await db
        .select({
            id: socialAccounts.id,
            platform: socialAccounts.platform,
        })
        .from(socialAccounts)
        .where(
            and(
                eq(socialAccounts.userId, userId),
                or(eq(socialAccounts.workspaceId, workspaceId), isNull(socialAccounts.workspaceId))
            )
        )

    if (accounts.length === 0) {
        throw new Error(
            `No social accounts found for user ${userId} in workspace ${workspaceId}. Connect at least one account first.`
        )
    }

    const seedStatuses: PostStatus[] = [
        PostStatus.DRAFT,
        PostStatus.PENDING,
        PostStatus.FAILED,
        PostStatus.DONE,
        PostStatus.PARTIALLY_DONE,
        PostStatus.POSTING,
    ]

    const preparedPosts: (typeof posts.$inferInsert)[] = []
    const preparedTargets: (typeof postTargets.$inferInsert)[] = []

    for (let index = 0; index < count; index += 1) {
        const id = uuidv4()
        const status = seedStatuses[index % seedStatuses.length]
        const createdAt = new Date(Date.now() - index * 60 * 60 * 1000)
        const shouldHaveTwoTargets = accounts.length > 1 && index % 2 === 0
        const selectedAccounts = shouldHaveTwoTargets
            ? [accounts[index % accounts.length], accounts[(index + 1) % accounts.length]]
            : [accounts[index % accounts.length]]
        const targetStatuses = pickTargetStatuses(status, selectedAccounts.length)

        preparedPosts.push({
            id,
            userId,
            workspaceId,
            status,
            type: 'text',
            scheduledAtLocal: status === PostStatus.PENDING ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
            scheduledTimezone: status === PostStatus.PENDING ? 'UTC' : null,
            mainCaption: `Fake post #${index + 1} (${status})`,
            createdAt,
            updatedAt: createdAt,
        })

        selectedAccounts.forEach((account, accountIndex) => {
            const targetStatus = targetStatuses[accountIndex] ?? PostStatus.PENDING

            preparedTargets.push({
                postId: id,
                socialAccountId: account.id,
                platform: account.platform,
                status: targetStatus,
                text: `Fake target text #${index + 1}`,
                tags: ['fake', 'seed'],
                links: [],
                mediaIndices: null,
                errorMessage: targetStatus === PostStatus.FAILED ? 'Seeded failure for CRUD testing' : null,
            })
        })
    }

    await db.transaction(async (tx) => {
        await tx.insert(posts).values(preparedPosts)
        await tx.insert(postTargets).values(preparedTargets)
    })

    const insertedIds = preparedPosts.map((post) => post.id).filter((id): id is string => typeof id === 'string')

    console.log(
        `[seed-fake-posts] Inserted ${preparedPosts.length} posts and ${preparedTargets.length} targets for workspace ${workspaceId}.`
    )
    console.log(`[seed-fake-posts] Post IDs: ${insertedIds.join(', ')}`)
}

run()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        console.error('[seed-fake-posts] Failed:', error instanceof Error ? error.message : String(error))
        process.exit(1)
    })
