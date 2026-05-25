import 'dotenv/config'

import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

import { db } from '@/db/client'
import { posts, postTargets } from '@/modules/post/entity/post.schema'
import { PostStatus } from '@/modules/post/types/posts.types'
import { socialAccounts } from '@/modules/social/entity/social-account.schema'
import { workspaces } from '@/modules/workspace/entity/workspace.schema'
import { BullMqPostScheduler } from '@/shared/queue/scheduler/post-scheduler/bullmq-post-scheduler'
import { parseDateWithTimeZone } from '@/shared/utils/timezone'
import type { PostPlatform } from '@/modules/post/schemas/posts.schemas'

const USER_ID = 'd5af828f-540d-4a3c-8e8a-79f8d1a5734c'
const ACCOUNT_IDS = [
    'b9ca730f-e71c-4425-9ac9-f11dd11111e6',
    'b9d39f1d-a403-4336-bb66-5a44f9fa38f4',
]

const SCHEDULE_START = '2026-03-13'
const SCHEDULE_END = '2026-05-01'
const POSTING_TIMES = ['19:00', '22:00']
const TIMEZONE = 'Asia/Saigon'
const START_POST_INDEX = 4

const BLUESKY_HASHTAGS = ['#SaaS', '#DigitalMarketing', '#Solopreneur', '#IndieHackers', '#Solofounder']

interface ContentRow {
    num: number
    hook: string
    post: string
    cta: string
}

const CONTENT_TABLE: ContentRow[] = [
    { num: 1, hook: 'Hot take:', post: "Most SaaS founders don't fail because of product.", cta: 'They fail because no one knows the product exists. Agree?' },
    { num: 2, hook: 'Unpopular opinion:', post: "Content marketing isn't creativity.", cta: "It's consistency. Thoughts?" },
    { num: 3, hook: 'Reality check:', post: 'Most startups post content randomly.', cta: 'Then wonder why nothing grows.' },
    { num: 4, hook: 'Truth about marketing:', post: "The hardest part of content isn't writing.", cta: "It's deciding *what to write*." },
    { num: 5, hook: 'Simple rule:', post: 'If content lives in 5 tools, it lives nowhere.', cta: 'Where do you store ideas?' },
    { num: 6, hook: 'Founder insight:', post: 'Every bug fix is a story.', cta: 'Every feature is a post.' },
    { num: 7, hook: 'This changed my thinking:', post: 'Building a product creates content.', cta: 'Ignoring it wastes content.' },
    { num: 8, hook: 'Hard lesson:', post: 'Great product + zero distribution = invisible startup.', cta: 'Where do you distribute?' },
    { num: 9, hook: 'Observation:', post: 'Most marketers post when they panic.', cta: 'Not when they plan.' },
    { num: 10, hook: 'Idea:', post: 'Content calendar = peace of mind.', cta: 'Do you use one?' },
    { num: 11, hook: 'Hot take:', post: 'Marketing chaos is usually a system problem.', cta: 'Not a discipline problem.' },
    { num: 12, hook: 'Founder thought:', post: 'Your daily work already contains 10 posts.', cta: "You just don't capture them." },
    { num: 13, hook: 'Truth:', post: 'Content gets easier when ideas are stored somewhere.', cta: 'Where do you capture ideas?' },
    { num: 14, hook: 'Reality:', post: 'Most SaaS founders know their product.', cta: 'But not their story.' },
    { num: 15, hook: 'Reminder:', post: 'People follow journeys.', cta: 'Not dashboards.' },
    { num: 16, hook: 'Simple content formula:', post: 'Build → Learn → Write.', cta: 'Repeat.' },
    { num: 17, hook: 'Content secret:', post: 'Lessons outperform tips.', cta: 'Every time.' },
    { num: 18, hook: 'One powerful post:', post: '"Today I realized something."', cta: 'Try it.' },
    { num: 19, hook: 'Most relatable content:', post: 'Mistakes.', cta: 'Share one recently?' },
    { num: 20, hook: 'Hard truth:', post: 'No one cares about your feature list.', cta: 'They care about your story.' },
    { num: 21, hook: 'Observation:', post: 'Founders think content must be educational.', cta: 'But stories perform better.' },
    { num: 22, hook: 'Question:', post: "What's harder for you?", cta: 'Writing posts or building features?' },
    { num: 23, hook: 'Insight:', post: 'Marketing without systems becomes stress.', cta: 'Ever felt that?' },
    { num: 24, hook: 'Reality:', post: 'The worst marketing moment is this:', cta: '"We need a post right now."' },
    { num: 25, hook: 'Better approach:', post: 'Plan content once.', cta: 'Relax the rest of the month.' },
    { num: 26, hook: 'Founder trick:', post: 'Turn every daily insight into a post.', cta: 'Easy content pipeline.' },
    { num: 27, hook: 'Marketing mistake:', post: 'Waiting for inspiration.', cta: 'Systems beat inspiration.' },
    { num: 28, hook: 'Content rule:', post: 'Capture ideas immediately.', cta: 'Or lose them forever.' },
    { num: 29, hook: 'Simple framework:', post: 'Capture → Plan → Publish.', cta: 'Nothing more.' },
    { num: 30, hook: 'Reminder:', post: 'Content is a process.', cta: 'Not a moment.' },
    { num: 31, hook: 'Founder reality:', post: 'You are the marketing team.', cta: 'And the product team.' },
    { num: 32, hook: 'Hot take:', post: 'Build in public is the most honest marketing.', cta: 'Do you follow anyone doing it well?' },
    { num: 33, hook: 'Observation:', post: 'Founders underestimate personal brand.', cta: 'But audiences follow people first.' },
    { num: 34, hook: 'Truth:', post: 'Marketing works when people trust you.', cta: 'Trust comes from transparency.' },
    { num: 35, hook: 'Reality:', post: 'People love progress updates.', cta: 'Not polished ads.' },
    { num: 36, hook: 'Question:', post: 'Do you document your building journey?', cta: 'Why or why not?' },
    { num: 37, hook: 'Thought:', post: 'One insight per day = 365 posts per year.', cta: 'Content solved.' },
    { num: 38, hook: 'Hot take:', post: 'Consistency beats virality.', cta: 'Agree?' },
    { num: 39, hook: 'Lesson learned:', post: 'Your first audience is tiny.', cta: 'But it compounds.' },
    { num: 40, hook: 'Marketing insight:', post: 'Old posts keep bringing attention.', cta: 'Content is an asset.' },
    { num: 41, hook: 'Reminder:', post: 'Ads stop working when you stop paying.', cta: 'Content keeps working.' },
    { num: 42, hook: 'Observation:', post: 'Many founders ignore distribution.', cta: 'Until launch day.' },
    { num: 43, hook: 'Hard truth:', post: "Launch day doesn't create traction.", cta: 'Audience does.' },
    { num: 44, hook: 'Founder lesson:', post: 'Start building audience before product.', cta: 'Did you?' },
    { num: 45, hook: 'Content trick:', post: 'Write posts while solving problems.', cta: 'Natural content flow.' },
    { num: 46, hook: 'Marketing rule:', post: 'Teach what you learn.', cta: 'People follow learning.' },
    { num: 47, hook: 'Founder question:', post: 'What did you learn today?', cta: 'Write a post about it.' },
    { num: 48, hook: 'Simple content idea:', post: '"Here\'s what went wrong today."', cta: 'Honest posts win.' },
    { num: 49, hook: 'Hot take:', post: 'Authenticity beats perfection.', cta: 'Always.' },
    { num: 50, hook: 'Observation:', post: 'People engage with real thoughts.', cta: 'Not polished marketing.' },
    { num: 51, hook: 'Reminder:', post: 'Your first posts will feel awkward.', cta: 'Everyone starts there.' },
    { num: 52, hook: 'Truth:', post: 'Most people quit before content compounds.', cta: 'Keep going.' },
    { num: 53, hook: 'Founder thought:', post: 'Your build journey is unique.', cta: 'Share it.' },
    { num: 54, hook: 'Question:', post: 'How many posts ahead are you planned?', cta: '0 / 3 / 10 / 30' },
    { num: 55, hook: 'Idea:', post: 'Weekly content themes simplify writing.', cta: 'Do you use themes?' },
    { num: 56, hook: 'Insight:', post: 'One good idea can create 5 posts.', cta: 'Repurpose it.' },
    { num: 57, hook: 'Content trick:', post: 'Turn one lesson into multiple angles.', cta: 'Endless content.' },
    { num: 58, hook: 'Hot take:', post: 'Short posts outperform long essays.', cta: 'Agree?' },
    { num: 59, hook: 'Observation:', post: 'Threads feels like conversations.', cta: 'Not publications.' },
    { num: 60, hook: 'Rule:', post: 'Write like you text a friend.', cta: 'Simple wins.' },
    { num: 61, hook: 'Reminder:', post: 'If a post takes too long to read, people skip.', cta: 'Keep it simple.' },
    { num: 62, hook: 'Founder insight:', post: 'Your struggles resonate more than success.', cta: 'Share both.' },
    { num: 63, hook: 'Content idea:', post: 'Explain one feature decision.', cta: 'Great story.' },
    { num: 64, hook: 'Question:', post: 'What feature took the longest to build?', cta: 'Why?' },
    { num: 65, hook: 'Hot take:', post: 'Startup lessons are underrated content.', cta: 'Share them.' },
    { num: 66, hook: 'Reality:', post: 'Most founders are learning in public anyway.', cta: 'Just write about it.' },
    { num: 67, hook: 'Observation:', post: 'People follow curiosity.', cta: 'Not perfection.' },
    { num: 68, hook: 'Founder thought:', post: 'Progress posts build trust.', cta: 'Agree?' },
    { num: 69, hook: 'Content trick:', post: 'Ask more questions.', cta: 'People answer.' },
    { num: 70, hook: 'Reminder:', post: 'Replies boost reach.', cta: 'Start conversations.' },
    { num: 71, hook: 'Idea:', post: 'End every post with a question.', cta: 'Simple growth tactic.' },
    { num: 72, hook: 'Insight:', post: 'Discussion beats broadcast.', cta: 'Always.' },
    { num: 73, hook: 'Founder reality:', post: 'Your audience is small today.', cta: 'Huge tomorrow.' },
    { num: 74, hook: 'Marketing lesson:', post: 'Growth compounds slowly.', cta: 'Then suddenly.' },
    { num: 75, hook: 'Observation:', post: 'Content momentum is real.', cta: 'Keep posting.' },
    { num: 76, hook: 'Hot take:', post: 'Most SaaS growth comes from distribution.', cta: 'Not features.' },
    { num: 77, hook: 'Founder insight:', post: 'Shipping product is exciting.', cta: 'Shipping content is scary.' },
    { num: 78, hook: 'Truth:', post: 'Both matter equally.', cta: '50/50 effort.' },
    { num: 79, hook: 'Reality:', post: 'Building audience early changes everything.', cta: 'Did you start early?' },
    { num: 80, hook: 'Question:', post: 'Where do you publish most content?', cta: 'X / Threads / LinkedIn' },
    { num: 81, hook: 'Content idea:', post: 'Share your daily workflow.', cta: 'People love systems.' },
    { num: 82, hook: 'Observation:', post: 'Founders search for systems constantly.', cta: 'Content about systems performs well.' },
    { num: 83, hook: 'Simple thought:', post: 'Clarity beats complexity.', cta: 'Always.' },
    { num: 84, hook: 'Founder lesson:', post: 'If something feels chaotic, build a system.', cta: 'Marketing included.' },
    { num: 85, hook: 'Reminder:', post: 'Content stress disappears with planning.', cta: 'Plan ahead.' },
    { num: 86, hook: 'Question:', post: 'Do you batch content or write daily?', cta: 'Curious.' },
    { num: 87, hook: 'Observation:', post: 'Many marketers batch content weekly.', cta: 'Do you?' },
    { num: 88, hook: 'Insight:', post: 'Planning once saves hours later.', cta: 'Worth it.' },
    { num: 89, hook: 'Founder thought:', post: 'Content becomes easier after 30 posts.', cta: 'Momentum.' },
    { num: 90, hook: 'Truth:', post: 'The first 10 posts are the hardest.', cta: 'Push through.' },
    { num: 91, hook: 'Hot take:', post: 'Your audience grows quietly at first.', cta: 'Then fast.' },
    { num: 92, hook: 'Reminder:', post: 'Every post is a door.', cta: 'Someone new walks in.' },
    { num: 93, hook: 'Observation:', post: 'Consistency builds familiarity.', cta: 'Familiarity builds trust.' },
    { num: 94, hook: 'Insight:', post: 'Trust builds product adoption.', cta: "That's the loop." },
    { num: 95, hook: 'Founder question:', post: "What's your main growth channel today?", cta: '' },
    { num: 96, hook: 'Idea:', post: 'Document your weekly learnings.', cta: 'Great content.' },
    { num: 97, hook: 'Reality:', post: 'People follow progress.', cta: 'Not perfection.' },
    { num: 98, hook: 'Reminder:', post: 'Share what you learn today.', cta: 'Not what you mastered years ago.' },
    { num: 99, hook: 'Thought:', post: 'Building in public is uncomfortable.', cta: 'But powerful.' },
    { num: 100, hook: 'Final question:', post: 'If your content system worked perfectly…', cta: 'What would change?' },
]

function buildPostText(row: ContentRow, platform: string): string {
    const base = `${row.hook}\n\n${row.post}\n\n${row.cta}`.trim()

    if (platform === 'bluesky') {
        return `${base}\n\n${BLUESKY_HASHTAGS.join(' ')}`
    }

    return base
}

function generateSlots(startDate: string, endDate: string, times: string[]): { date: string; time: string }[] {
    const slots: { date: string; time: string }[] = []
    const end = new Date(endDate)
    const current = new Date(startDate)

    while (current <= end) {
        const dateStr = current.toISOString().slice(0, 10)
        for (const time of times) {
            slots.push({ date: dateStr, time })
        }
        current.setDate(current.getDate() + 1)
    }

    return slots
}

const run = async (): Promise<void> => {
    const scheduler = new BullMqPostScheduler()

    // 1. Resolve workspace
    const [workspace] = await db
        .select({ id: workspaces.id, userId: workspaces.userId })
        .from(workspaces)
        .where(eq(workspaces.userId, USER_ID))
        .limit(1)

    if (!workspace) {
        throw new Error(`No workspace found for user ${USER_ID}`)
    }

    // 2. Fetch account platforms from DB
    const accounts = await db
        .select({ id: socialAccounts.id, platform: socialAccounts.platform })
        .from(socialAccounts)
        .where(
            and(
                eq(socialAccounts.userId, USER_ID),
                inArray(socialAccounts.id, ACCOUNT_IDS),
                or(eq(socialAccounts.workspaceId, workspace.id), isNull(socialAccounts.workspaceId))
            )
        )

    if (accounts.length === 0) {
        throw new Error('No matching social accounts found')
    }

    const accountMap = new Map(accounts.map((a) => [a.id, a.platform]))
    console.log(`[schedule] Found ${accounts.length} accounts:`)
    accounts.forEach((a) => console.log(`  - ${a.id} (${a.platform})`))

    // 3. Delete previously inserted unqueued posts from the first run (Mar 11-12 and beyond)
    // Find all PENDING posts by this user that were created by the previous script run
    const previousPosts = await db
        .select({ id: posts.id, scheduledAtLocal: posts.scheduledAtLocal })
        .from(posts)
        .where(
            and(
                eq(posts.userId, USER_ID),
                eq(posts.workspaceId, workspace.id),
                eq(posts.status, PostStatus.PENDING)
            )
        )

    // Delete posts scheduled between old start (2026-03-11) and end (2026-05-01) that came from the first run
    const previousPostIds = previousPosts
        .filter((p) => {
            if (!p.scheduledAtLocal) return false
            const date = p.scheduledAtLocal.slice(0, 10)
            return date >= '2026-03-11' && date <= '2026-05-01'
        })
        .map((p) => p.id)

    if (previousPostIds.length > 0) {
        console.log(`[schedule] Deleting ${previousPostIds.length} previously inserted (unqueued) posts...`)
        // Cascade will delete post_targets too
        const BATCH = 50
        for (let i = 0; i < previousPostIds.length; i += BATCH) {
            await db.delete(posts).where(inArray(posts.id, previousPostIds.slice(i, i + BATCH)))
        }
        console.log(`[schedule] Deleted.`)
    }

    // 4. Get content starting from post index
    const contentToSchedule = CONTENT_TABLE.filter((row) => row.num >= START_POST_INDEX)
    console.log(`[schedule] Content rows to schedule: ${contentToSchedule.length} (posts #${START_POST_INDEX}-#${CONTENT_TABLE[CONTENT_TABLE.length - 1].num})`)

    // 5. Generate time slots
    const allSlots = generateSlots(SCHEDULE_START, SCHEDULE_END, POSTING_TIMES)
    console.log(`[schedule] Available time slots: ${allSlots.length} (${SCHEDULE_START} to ${SCHEDULE_END})`)

    // 6. Check for existing posts to avoid collisions
    const existingPosts = await db
        .select({
            scheduledAtLocal: posts.scheduledAtLocal,
            socialAccountId: postTargets.socialAccountId,
        })
        .from(posts)
        .innerJoin(postTargets, eq(posts.id, postTargets.postId))
        .where(
            and(
                eq(posts.userId, USER_ID),
                eq(posts.workspaceId, workspace.id)
            )
        )

    // Build a set of occupied slots per account: "accountId|date|time"
    const occupiedSlots = new Set<string>()
    for (const ep of existingPosts) {
        if (!ep.scheduledAtLocal) continue
        const datePart = ep.scheduledAtLocal.slice(0, 10)
        const timePart = ep.scheduledAtLocal.slice(11, 16)
        occupiedSlots.add(`${ep.socialAccountId}|${datePart}|${timePart}`)
    }

    console.log(`[schedule] Existing occupied slots: ${occupiedSlots.size}`)

    // 7. Assign content to slots, one post per slot, both accounts per post
    const preparedPosts: (typeof posts.$inferInsert)[] = []
    const preparedTargets: (typeof postTargets.$inferInsert)[] = []

    let slotIndex = 0
    let scheduledCount = 0
    let skippedCollisions = 0

    for (const content of contentToSchedule) {
        let foundSlot = false
        while (slotIndex < allSlots.length) {
            const slot = allSlots[slotIndex]
            const allFree = ACCOUNT_IDS.every((accountId) => {
                const platform = accountMap.get(accountId)
                if (!platform) return false
                return !occupiedSlots.has(`${accountId}|${slot.date}|${slot.time}`)
            })

            if (allFree) {
                foundSlot = true
                break
            }

            slotIndex++
            skippedCollisions++
        }

        if (!foundSlot) {
            console.log(`[schedule] Ran out of available slots at post #${content.num}. Scheduled ${scheduledCount} posts.`)
            break
        }

        const slot = allSlots[slotIndex]
        const postId = uuidv4()
        const scheduledAtLocal = `${slot.date}T${slot.time}:00`

        const firstPlatform = accountMap.get(ACCOUNT_IDS[0]) ?? 'unknown'
        const mainCaption = buildPostText(content, firstPlatform)

        preparedPosts.push({
            id: postId,
            userId: USER_ID,
            workspaceId: workspace.id,
            status: PostStatus.PENDING,
            type: 'text',
            scheduledAtLocal,
            scheduledTimezone: TIMEZONE,
            mainCaption,
        })

        for (const accountId of ACCOUNT_IDS) {
            const platform = accountMap.get(accountId)
            if (!platform) continue

            const text = buildPostText(content, platform)
            const tags = platform === 'bluesky' ? BLUESKY_HASHTAGS.map((h) => h.replace('#', '')) : []

            preparedTargets.push({
                postId,
                socialAccountId: accountId,
                platform,
                status: PostStatus.PENDING,
                text,
                tags,
                links: [],
                mediaIndices: null,
                errorMessage: null,
            })

            occupiedSlots.add(`${accountId}|${slot.date}|${slot.time}`)
        }

        scheduledCount++
        slotIndex++
    }

    if (preparedPosts.length === 0) {
        console.log('[schedule] No posts to insert.')
        return
    }

    // 8. Insert in batches within a transaction
    console.log(`[schedule] Inserting ${preparedPosts.length} posts with ${preparedTargets.length} targets...`)

    await db.transaction(async (tx) => {
        const BATCH = 50
        for (let i = 0; i < preparedPosts.length; i += BATCH) {
            await tx.insert(posts).values(preparedPosts.slice(i, i + BATCH))
        }
        for (let i = 0; i < preparedTargets.length; i += BATCH) {
            await tx.insert(postTargets).values(preparedTargets.slice(i, i + BATCH))
        }
    })

    console.log(`[schedule] DB insert complete.`)

    // 9. Enqueue each post into BullMQ via the scheduler
    console.log(`[schedule] Enqueuing ${preparedPosts.length} posts into BullMQ...`)

    let enqueuedCount = 0
    for (const post of preparedPosts) {
        const scheduledUtc = parseDateWithTimeZone(post.scheduledAtLocal!, TIMEZONE)
        if (!scheduledUtc) {
            console.log(`[schedule] WARNING: Could not parse date ${post.scheduledAtLocal} with tz ${TIMEZONE}, skipping queue`)
            continue
        }

        // Find all targets for this post
        const targets = preparedTargets.filter((t) => t.postId === post.id)
        for (const target of targets) {
            await scheduler.schedulePost(
                target.platform as PostPlatform,
                post.id!,
                USER_ID,
                scheduledUtc,
                target.socialAccountId
            )
        }
        enqueuedCount++
    }

    console.log(`[schedule] Enqueued ${enqueuedCount} posts (${enqueuedCount * accounts.length} jobs) into BullMQ.`)
    if (skippedCollisions > 0) {
        console.log(`[schedule] Skipped ${skippedCollisions} slots due to collisions.`)
    }

    const firstPost = preparedPosts[0]
    const lastPost = preparedPosts[preparedPosts.length - 1]
    console.log(`[schedule] First post: ${firstPost.scheduledAtLocal}`)
    console.log(`[schedule] Last post:  ${lastPost.scheduledAtLocal}`)
}

run()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        console.error('[schedule] Failed:', error instanceof Error ? error.message : String(error))
        process.exit(1)
    })
