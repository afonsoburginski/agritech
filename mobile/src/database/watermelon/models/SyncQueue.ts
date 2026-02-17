import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class SyncQueue extends Model {
  static table = 'sync_queue';

  @field('entity_type') entityType!: string;
  @field('entity_id') entityId!: string;
  @field('operation') operation!: string;
  @field('payload') payload!: string;
  @field('retry_count') retryCount!: number;
  @field('max_retries') maxRetries!: number;
  @field('status') status!: string;
  @field('error_message') errorMessage!: string | null;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @field('next_retry_at') nextRetryAt!: number | null;
}
