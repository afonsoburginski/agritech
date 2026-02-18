import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'pragas',
          columns: [{ name: 'embrapa_recomendacao_id', type: 'string', isOptional: true }],
        }),
      ],
    },
  ],
});
