import { isNil } from '@activepieces/pieces-framework';
import { SeaTableColumn, SeaTableTable } from './client';

export const seatableRows = {
  findTable,
  writableColumns,
  searchableColumns,
  toWritableValues,
  quoteIdentifier,
  toFilterValue,
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

function searchableColumns(columns: SeaTableColumn[]): SeaTableColumn[] {
  return columns.filter((column) => SEARCHABLE_TYPES.includes(column.type));
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

function quoteIdentifier(name: string): string {
  if (name.includes('`')) {
    throw new Error(`Names with a backtick cannot be searched: ${name}`);
  }
  return `\`${name}\``;
}

function toFilterValue({ column, value }: { column: SeaTableColumn; value: string }): string | number {
  if (!NUMBER_TYPES.includes(column.type)) {
    return value;
  }
  const parsed = Number(value.trim());
  if (value.trim() === '' || Number.isNaN(parsed)) {
    throw new Error(`Column "${column.name}" holds numbers, so the search value must be a number.`);
  }
  return parsed;
}

const NUMBER_TYPES = ['number', 'duration', 'rate'];
const SEARCHABLE_TYPES = ['text', 'long-text', 'number', 'duration', 'rate', 'single-select', 'email', 'url', 'auto-number'];

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
