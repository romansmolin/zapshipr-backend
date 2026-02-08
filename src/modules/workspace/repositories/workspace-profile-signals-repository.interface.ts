import type {
    WorkspaceProfileSignal,
    InsertWorkspaceProfileSignal,
} from '../entity/workspace-profile-signal.schema'
import type { AggregateOptions, AggregateResult } from '../entity/workspace-profile.types'

export interface IWorkspaceProfileSignalsRepository {
    create(data: InsertWorkspaceProfileSignal): Promise<WorkspaceProfileSignal>
    findRecent(
        workspaceId: string,
        options: {
            daysBack: number
            limit: number
            signalType?: string
        }
    ): Promise<WorkspaceProfileSignal[]>
    countByType(workspaceId: string, signalType: string, daysBack: number): Promise<number>
    aggregateByType(workspaceId: string, options: AggregateOptions): Promise<AggregateResult[]>
    deleteOlderThan(workspaceId: string, days: number): Promise<number>
}
