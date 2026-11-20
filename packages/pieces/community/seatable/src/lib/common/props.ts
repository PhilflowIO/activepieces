import { DropdownState, DynamicPropsValue, Property } from '@activepieces/pieces-framework';
import { seatableAuth, seatableConnection } from '../auth';
import { SeaTableAuthProps, SeaTableColumn, SeaTableTable, seatableClient } from './client';
import { seatableRows } from './rows';

export const seatableProps = {
  table,
  rowId,
  rowFields,
};

function table() {
  return Property.Dropdown({
    auth: seatableAuth,
    displayName: 'Table',
    description: 'A table of the base this connection belongs to.',
    required: true,
    refreshers: [],
    options: async ({ auth }) => {
      if (!auth) {
        return disabled('Connect your SeaTable base first');
      }
      return loadOptions(async () => {
        const tables = await listTables(seatableConnection.toProps(auth));
        return tables.map((candidate) => ({ label: candidate.name, value: candidate.name }));
      });
    },
  });
}

function rowId() {
  return Property.ShortText({
    displayName: 'Row ID',
    description: 'The `_id` of the row, for example from Find Rows, List Rows or the New Row trigger.',
    required: true,
  });
}

function rowFields({ displayName }: { displayName: string }) {
  return Property.DynamicProperties({
    auth: seatableAuth,
    displayName,
    description: 'Only the columns you fill in are written. Link, file, image, formula and automatic columns are not shown.',
    required: false,
    refreshers: ['table'],
    props: async ({ auth, table }) => {
      if (!auth || typeof table !== 'string' || table === '') {
        return {};
      }
      const tables = await listTables(seatableConnection.toProps(auth));
      const columns = seatableRows.writableColumns(seatableRows.findTable({ tables, name: table }).columns);
      return columns.reduce<DynamicPropsValue>((acc, column) => ({ ...acc, [column.name]: columnProperty(column) }), {});
    },
  });
}

function columnProperty(column: SeaTableColumn) {
  const base = { displayName: column.name, required: false };
  const options = (column.data?.options ?? []).map((option) => ({ label: option.name, value: option.name }));
  switch (column.type) {
    case 'long-text':
      return Property.LongText(base);
    case 'number':
    case 'rate':
      return Property.Number(base);
    case 'duration':
      return Property.Number({ ...base, description: 'Duration in seconds.' });
    case 'checkbox':
      return Property.Checkbox(base);
    case 'date':
      return Property.DateTime(base);
    case 'single-select':
      return Property.StaticDropdown({ ...base, options: { disabled: false, options } });
    case 'multiple-select':
      return Property.StaticMultiSelectDropdown({ ...base, options: { disabled: false, options } });
    default:
      return Property.ShortText(base);
  }
}

async function listTables(auth: SeaTableAuthProps): Promise<SeaTableTable[]> {
  const base = await seatableClient.connect(auth);
  return base.listTables();
}

async function loadOptions(load: () => Promise<{ label: string; value: string }[]>): Promise<DropdownState<string>> {
  try {
    return { disabled: false, options: await load() };
  } catch (error) {
    return disabled(error instanceof Error ? error.message : 'Could not load the tables of this base');
  }
}

function disabled(placeholder: string): DropdownState<string> {
  return { disabled: true, options: [], placeholder };
}
