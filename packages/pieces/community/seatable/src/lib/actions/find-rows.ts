import { Property, createAction } from '@activepieces/pieces-framework';
import { seatableAuth, seatableConnection } from '../auth';
import { seatableClient } from '../common/client';
import { seatableProps } from '../common/props';
import { seatableRows } from '../common/rows';

export const findRowsAction = createAction({
  auth: seatableAuth,
  name: 'find_rows',
  classification: 'SEARCH',
  displayName: 'Find Rows',
  description: 'Finds the rows whose column has a given value.',
  audience: 'both',
  aiMetadata: {
    description:
      'Find rows of a SeaTable table whose cell in one column equals a value exactly, for example the row with a given email. Returns an empty list when nothing matches. Use Get Row when you already have the row ID. Read-only, safe to retry.',
    idempotent: true,
  },
  props: {
    table: seatableProps.table(),
    column: seatableProps.searchColumn(),
    value: Property.ShortText({
      displayName: 'Value',
      description: 'The value the cell must be equal to.',
      required: true,
    }),
    limit: Property.Number({
      displayName: 'Limit',
      description: 'How many rows to return, at most 1000.',
      required: false,
      defaultValue: 10,
    }),
  },
  async run(context) {
    const { table, column, value, limit } = context.propsValue;
    const base = await seatableClient.connect(seatableConnection.toProps(context.auth));
    const columns = seatableRows.findTable({ tables: await base.listTables(), name: table }).columns;
    const target = columns.find((candidate) => candidate.name === column);
    if (!target) {
      throw new Error(`Column "${column}" was not found in table "${table}".`);
    }
    const count = Math.min(MAX_ROWS, Math.max(1, Math.floor(limit ?? 10)));
    return base.query({
      sql: `SELECT * FROM ${seatableRows.quoteIdentifier(table)} WHERE ${seatableRows.quoteIdentifier(target.name)} = ? LIMIT ${count}`,
      parameters: [seatableRows.toFilterValue({ column: target, value })],
    });
  },
});

const MAX_ROWS = 1000;
