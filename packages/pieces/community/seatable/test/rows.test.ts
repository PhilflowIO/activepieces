import { describe, expect, it } from 'vitest';
import { seatableRows } from '../src/lib/common/rows';

const columns = [
  { key: '0000', name: 'Name', type: 'text' },
  { key: 'a1', name: 'Age', type: 'number' },
  { key: 'a2', name: 'Active', type: 'checkbox' },
  { key: 'a3', name: 'Company', type: 'link' },
  { key: 'a4', name: 'Total', type: 'formula' },
  { key: 'a5', name: 'Status', type: 'single-select', data: { options: [{ id: '1', name: 'Lead' }] } },
];

describe('seatableRows.toWritableValues', () => {
  it('keeps filled writable columns, including false and zero, and drops the rest', () => {
    expect(
      seatableRows.toWritableValues({
        columns,
        values: { Name: 'Ada', Age: 0, Active: false, Company: ['row'], Total: 3, Status: '', Unknown: 'x', Notes: undefined },
      }),
    ).toEqual({ Name: 'Ada', Age: 0, Active: false });
  });
});

describe('seatableRows.searchableColumns', () => {
  it('offers only columns an equality search can match', () => {
    expect(seatableRows.searchableColumns(columns).map((column) => column.name)).toEqual(['Name', 'Age', 'Status']);
  });
});

describe('seatableRows.toFilterValue', () => {
  it('sends numbers for number columns and text for the others', () => {
    expect(seatableRows.toFilterValue({ column: columns[1], value: ' 41 ' })).toBe(41);
    expect(seatableRows.toFilterValue({ column: columns[0], value: '41' })).toBe('41');
  });

  it('rejects a non-numeric value for a number column', () => {
    expect(() => seatableRows.toFilterValue({ column: columns[1], value: 'forty' })).toThrow('must be a number');
  });
});

describe('seatableRows.quoteIdentifier', () => {
  it('quotes names with spaces and refuses backticks', () => {
    expect(seatableRows.quoteIdentifier('Sales Leads')).toBe('`Sales Leads`');
    expect(() => seatableRows.quoteIdentifier('a`b')).toThrow('backtick');
  });
});

describe('seatableRows.findTable', () => {
  it('names the missing table', () => {
    expect(() => seatableRows.findTable({ tables: [], name: 'Contacts' })).toThrow('Table "Contacts" was not found');
  });
});
