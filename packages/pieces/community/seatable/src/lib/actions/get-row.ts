import { createAction } from '@activepieces/pieces-framework';
import { seatableAuth, seatableConnection } from '../auth';
import { seatableClient } from '../common/client';
import { seatableProps } from '../common/props';

export const getRowAction = createAction({
  auth: seatableAuth,
  name: 'get_row',
  classification: 'READ',
  displayName: 'Get Row',
  description: 'Gets one row by its ID.',
  audience: 'both',
  aiMetadata: {
    description:
      'Fetch one row of a SeaTable table by its row ID, with every cell keyed by column name. Use when you already have the row ID; to look a row up by a cell value use Find Rows. Read-only, safe to retry.',
    idempotent: true,
  },
  props: {
    table: seatableProps.table(),
    rowId: seatableProps.rowId(),
  },
  async run(context) {
    const { table, rowId } = context.propsValue;
    const base = await seatableClient.connect(seatableConnection.toProps(context.auth));
    return base.getRow({ table, rowId: rowId.trim() });
  },
});
