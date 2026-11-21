import { createAction } from '@activepieces/pieces-framework';
import { seatableAuth, seatableConnection } from '../auth';
import { seatableClient } from '../common/client';
import { seatableProps } from '../common/props';
import { seatableRows } from '../common/rows';

export const updateRowAction = createAction({
  auth: seatableAuth,
  name: 'update_row',
  classification: 'WRITE',
  displayName: 'Update Row',
  description: 'Changes cells of an existing row.',
  audience: 'both',
  aiMetadata: {
    description:
      'Change cells of one existing SeaTable row, identified by table and row ID. Only the columns you pass are changed; empty values leave a cell as it is. Sets the cells to the given values, so retries are safe.',
    idempotent: true,
  },
  props: {
    table: seatableProps.table(),
    rowId: seatableProps.rowId(),
    fields: seatableProps.rowFields({ displayName: 'New Values' }),
  },
  async run(context) {
    const { table, rowId, fields } = context.propsValue;
    const id = rowId.trim();
    const base = await seatableClient.connect(seatableConnection.toProps(context.auth));
    const columns = seatableRows.findTable({ tables: await seatableClient.listTables({ base }), name: table }).columns;
    const row = seatableRows.toWritableValues({ columns, values: fields ?? {} });
    if (Object.keys(row).length > 0) {
      await seatableClient.updateRow({ base, table, rowId: id, row });
    }
    return seatableClient.getRow({ base, table, rowId: id });
  },
});
