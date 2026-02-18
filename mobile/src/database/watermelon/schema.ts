import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const appSchemaWatermelon = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'atividades',
      columns: [
        { name: 'nome', type: 'string' },
        { name: 'descricao', type: 'string', isOptional: true },
        { name: 'tipo', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isOptional: true },
        { name: 'data_inicio', type: 'number', isOptional: true },
        { name: 'data_fim', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'synced', type: 'boolean' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'scouts',
      columns: [
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'accuracy', type: 'number', isOptional: true },
        { name: 'altitude', type: 'number', isOptional: true },
        { name: 'heading', type: 'number', isOptional: true },
        { name: 'speed', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'synced', type: 'boolean' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'pragas',
      columns: [
        { name: 'scout_id', type: 'string', isIndexed: true },
        { name: 'nome', type: 'string' },
        { name: 'embrapa_recomendacao_id', type: 'string', isOptional: true },
        { name: 'quantidade', type: 'number', isOptional: true },
        { name: 'severidade', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'synced', type: 'boolean' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'entity_type', type: 'string', isIndexed: true },
        { name: 'entity_id', type: 'string' },
        { name: 'operation', type: 'string' },
        { name: 'payload', type: 'string' },
        { name: 'retry_count', type: 'number' },
        { name: 'max_retries', type: 'number' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'error_message', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'next_retry_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'pending_recognition_queue',
      columns: [
        { name: 'image_path', type: 'string' },
        { name: 'metadata', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'error_message', type: 'string', isOptional: true },
        { name: 'result', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
