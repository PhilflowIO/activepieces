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

describe('seatableRows.findTable', () => {
  it('names the missing table', () => {
    expect(() => seatableRows.findTable({ tables: [], name: 'Contacts' })).toThrow('Table "Contacts" was not found');
  });
});
