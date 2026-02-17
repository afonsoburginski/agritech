import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class Atividade extends Model {
  static table = 'atividades';

  @field('nome') nome!: string;
  @field('descricao') descricao!: string | null;
  @field('tipo') tipo!: string | null;
  @field('status') status!: string | null;
  @field('data_inicio') dataInicio!: number | null;
  @field('data_fim') dataFim!: number | null;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @field('synced') synced!: boolean;
  @date('deleted_at') deletedAt!: Date | null;
}
