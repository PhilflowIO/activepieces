import { createAction } from '@activepieces/pieces-framework';
import { seatableAuth, seatableConnection } from '../auth';
import { seatableClient } from '../common/client';
import { seatableProps } from '../common/props';

export const deleteRowAction = createAction({
  auth: seatableAuth,
  name: 'delete_row',
  classification: 'DESTRUCTIVE',
  displayName: 'Delete Row',
  description: 'Deletes a row from a table.',
  audience: 'both',
  aiMetadata: {
    description:
      'Delete one row of a SeaTable table by its row ID. Not idempotent: a retry after success reports that nothing was deleted.',
    idempotent: false,
  },
  props: {
    table: seatableProps.table(),
    rowId: seatableProps.rowId(),
  },
  async run(context) {
    const { table, rowId } = context.propsValue;
    const id = rowId.trim();
    const base = await seatableClient.connect(seatableConnection.toProps(context.auth));
    const deleted = await base.deleteRow({ table, rowId: id });
    return { row_id: id, deleted: deleted > 0 };
  },
});
