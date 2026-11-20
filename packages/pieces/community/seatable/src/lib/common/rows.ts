import { isNil } from '@activepieces/pieces-framework';
import { SeaTableColumn, SeaTableTable } from './client';

export const seatableRows = {
  findTable,
  writableColumns,
  toWritableValues,
};

function findTable({ tables, name }: { tables: SeaTableTable[]; name: string }): SeaTableTable {
  const table = tables.find((candidate) => candidate.name === name);
  if (isNil(table)) {
    throw new Error(`Table "${name}" was not found in this base.`);
  }
  return table;
}

function writableColumns(columns: SeaTableColumn[]): SeaTableColumn[] {
  return columns.filter((column) => WRITABLE_TYPES.includes(column.type));
}

function toWritableValues({ columns, values }: { columns: SeaTableColumn[]; values: Record<string, unknown> }): Record<string, unknown> {
  const writable = new Set(writableColumns(columns).map((column) => column.name));
  return Object.entries(values).reduce<Record<string, unknown>>((acc, [name, value]) => {
    if (!writable.has(name) || isNil(value) || value === '') {
      return acc;
    }
    return { ...acc, [name]: value };
  }, {});
}

export const WRITABLE_TYPES = [
  'text',
  'long-text',
  'number',
  'duration',
  'rate',
  'checkbox',
  'date',
  'single-select',
  'multiple-select',
  'email',
  'url',
];
