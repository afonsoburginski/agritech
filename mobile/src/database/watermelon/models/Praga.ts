import { Model, Relation } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';
import Scout from './Scout';

export default class Praga extends Model {
  static table = 'pragas';

  static associations = {
    scouts: { type: 'belongs_to' as const, key: 'scout_id' },
  };

  @field('scout_id') scoutId!: string;
  @field('nome') nome!: string;
  @field('embrapa_recomendacao_id') embrapaRecomendacaoId!: string | null;
  @field('quantidade') quantidade!: number | null;
  @field('severidade') severidade!: string | null;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @field('synced') synced!: boolean;
  @date('deleted_at') deletedAt!: Date | null;

  @relation('scouts', 'scout_id') scout!: Relation<Scout>;
}
