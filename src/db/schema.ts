import { mediaAssets, postMediaAssets, postTargets, posts } from '@/modules/post/entity/post.schema'
import { pinterestBoards, socialAccounts } from '@/modules/social/entity/social-account.schema'
import { users } from '@/modules/user/entity/user.schema'
import {
    waitlistEntries,
    waitlistReferralEvents,
    waitlistReferralRewards,
} from '@/modules/waitlist/entity/waitlist.schema'
import { workspaces } from '@/modules/workspace/entity/workspace.schema'
import {
    rawInspirations,
    inspirationType,
    inspirationStatus,
} from '@/modules/inspiration/entity/raw-inspiration.schema'
import { inspirationsExtractions } from '@/modules/inspiration/entity/inspirations-extraction.schema'
import { workspaceTags, tagCategory } from '@/modules/inspiration/entity/workspace-tag.schema'

export const schema = {
    users,
    workspaces,
    socialAccounts,
    pinterestBoards,
    posts,
    postTargets,
    mediaAssets,
    postMediaAssets,
    waitlistEntries,
    waitlistReferralEvents,
    waitlistReferralRewards,
    rawInspirations,
    inspirationsExtractions,
    workspaceTags,
}

export type DBSchema = typeof schema

export { posts, postTargets, mediaAssets, postMediaAssets } from '@/modules/post/entity/post.schema'
export { socialAccounts, pinterestBoards } from '../modules/social/entity/social-account.schema'
export { users } from '@/modules/user/entity/user.schema'
export {
    waitlistEntries,
    waitlistReferralEvents,
    waitlistReferralRewards,
} from '@/modules/waitlist/entity/waitlist.schema'
export { workspaces } from '@/modules/workspace/entity/workspace.schema'
export {
    rawInspirations,
    inspirationType,
    inspirationStatus,
} from '@/modules/inspiration/entity/raw-inspiration.schema'
export { inspirationsExtractions } from '@/modules/inspiration/entity/inspirations-extraction.schema'
export { workspaceTags, tagCategory } from '@/modules/inspiration/entity/workspace-tag.schema'
