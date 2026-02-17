import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class PendingRecognition extends Model {
  static table = 'pending_recognition_queue';

  @field('image_path') imagePath!: string;
  @field('metadata') metadata!: string | null;
  @field('status') status!: string;
  @field('error_message') errorMessage!: string | null;
  @field('result') result!: string | null;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
