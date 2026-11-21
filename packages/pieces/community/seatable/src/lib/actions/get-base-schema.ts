import { createAction } from '@activepieces/pieces-framework';
import { seatableAuth, seatableConnection } from '../auth';
import { seatableClient } from '../common/client';

export const getBaseSchemaAction = createAction({
  auth: seatableAuth,
  name: 'get_base_schema',
  classification: 'READ',
  displayName: 'Get Base Schema',
  description: 'Lists the tables, columns and views of the base.',
  audience: 'both',
  aiMetadata: {
    description:
      'List every table of the connected SeaTable base with its columns (name, type, select options) and views. Call this first to learn the exact table and column names the row actions expect. Read-only, safe to retry.',
    idempotent: true,
  },
  props: {},
  async run(context) {
    const base = await seatableClient.connect(seatableConnection.toProps(context.auth));
    const tables = await seatableClient.listTables({ base });
    return {
      base_uuid: base.baseUuid,
      base_name: base.baseName,
      tables: tables.map((table) => ({
        name: table.name,
        columns: table.columns.map((column) => ({
          name: column.name,
          type: column.type,
          options: (column.data?.options ?? []).map((option) => option.name),
        })),
        views: (table.views ?? []).map((view) => view.name),
      })),
    };
  },
});
