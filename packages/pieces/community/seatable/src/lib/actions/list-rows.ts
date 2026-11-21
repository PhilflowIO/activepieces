import { Property, createAction } from '@activepieces/pieces-framework';
import { seatableAuth, seatableConnection } from '../auth';
import { seatableClient } from '../common/client';
import { seatableProps } from '../common/props';

export const listRowsAction = createAction({
  auth: seatableAuth,
  name: 'list_rows',
  classification: 'SEARCH',
  displayName: 'List Rows',
  description: 'Lists the rows of a table or view.',
  audience: 'both',
  aiMetadata: {
    description:
      'List rows of a SeaTable table in table order, optionally only the rows and columns of a named view. Returns at most 1000 rows per call; page with Offset. To look rows up by a cell value use Find Rows instead. Read-only, safe to retry.',
    idempotent: true,
  },
  props: {
    table: seatableProps.table(),
    view: seatableProps.view(),
    limit: Property.Number({
      displayName: 'Limit',
      description: 'How many rows to return, at most 1000.',
      required: false,
      defaultValue: 100,
    }),
    offset: Property.Number({
      displayName: 'Offset',
      description: 'How many rows to skip, for paging.',
      required: false,
      defaultValue: 0,
    }),
  },
  async run(context) {
    const { table, view, limit, offset } = context.propsValue;
    const base = await seatableClient.connect(seatableConnection.toProps(context.auth));
    return seatableClient.listRows({
      base,
      table,
      view: view ?? undefined,
      start: Math.max(0, Math.floor(offset ?? 0)),
      limit: Math.min(MAX_ROWS, Math.max(1, Math.floor(limit ?? 100))),
    });
  },
});

const MAX_ROWS = 1000;
