import { Model, relation, Q } from '@nozbe/watermelondb';
import { field, date, children } from '@nozbe/watermelondb/decorators';
import Praga from './Praga';

export default class Scout extends Model {
  static table = 'scouts';

  static associations = {
    pragas: { type: 'has_many' as const, foreignKey: 'scout_id' },
  };

  @field('latitude') latitude!: number;
  @field('longitude') longitude!: number;
  @field('accuracy') accuracy!: number | null;
  @field('altitude') altitude!: number | null;
  @field('heading') heading!: number | null;
  @field('speed') speed!: number | null;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @field('synced') synced!: boolean;
  @date('deleted_at') deletedAt!: Date | null;

  @children('pragas') pragas!: Q.Query<Praga>;
}
