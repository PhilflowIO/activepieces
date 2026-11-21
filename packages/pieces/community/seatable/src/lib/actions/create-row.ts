import { createAction } from '@activepieces/pieces-framework';
import { seatableAuth, seatableConnection } from '../auth';
import { seatableClient } from '../common/client';
import { seatableProps } from '../common/props';
import { seatableRows } from '../common/rows';

export const createRowAction = createAction({
  auth: seatableAuth,
  name: 'create_row',
  classification: 'WRITE',
  displayName: 'Create Row',
  description: 'Adds a new row to a table.',
  audience: 'both',
  aiMetadata: {
    description:
      'Add one new row to a SeaTable table, setting cells by column name. Values for link, file, image, formula and automatic columns are ignored. Use Update Row to change an existing row. Each call adds another row, so retries create duplicates.',
    idempotent: false,
  },
  props: {
    table: seatableProps.table(),
    fields: seatableProps.rowFields({ displayName: 'Row Values' }),
  },
  async run(context) {
    const { table, fields } = context.propsValue;
    const base = await seatableClient.connect(seatableConnection.toProps(context.auth));
    const columns = seatableRows.findTable({ tables: await seatableClient.listTables({ base }), name: table }).columns;
    const rowId = await seatableClient.appendRow({ base, table, row: seatableRows.toWritableValues({ columns, values: fields ?? {} }) });
    return seatableClient.getRow({ base, table, rowId });
  },
});
