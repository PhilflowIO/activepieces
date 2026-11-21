import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@activepieces/pieces-common';
import { Store } from '@activepieces/pieces-framework';
import { newRowPolling } from '../src/lib/common/polling';

const auth = { serverUrl: 'https://cloud.seatable.io', apiToken: 'api-token' };
const access = {
  access_token: 'base-token',
  dtable_uuid: '650d8a0d-7e27-46a8-8b18-6cc6f3db2057',
  dtable_server: 'https://cloud.seatable.io/api-gateway/',
  dtable_name: 'CRM',
  use_api_gateway: true,
};
const T0 = Date.parse('2026-11-20T10:00:00.000Z');

function row({ id, ctime }: { id: string; ctime: string }) {
  return { _id: id, _ctime: ctime };
}

function memoryStore(): Store {
  const data = new Map<string, string>();
  return {
    put: async <T>(key: string, value: T) => {
      data.set(key, JSON.stringify(value));
      return value;
    },
    get: async (key: string) => {
      const value = data.get(key);
      return value === undefined ? null : JSON.parse(value);
    },
    delete: async (key: string) => {
      data.delete(key);
    },
  };
}

function seatable(answers: unknown[][]) {
  const queue = [...answers];
  return vi.spyOn(httpClient, 'sendRequest').mockImplementation(async (request) => ({
    status: 200,
    headers: {},
    body: request.url.endsWith('/app-access-token/') ? access : { results: queue.shift() ?? [] },
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('newRowPolling.selectFresh', () => {
  it('skips rows already emitted in the same second and rows without a creation time', () => {
    const state = { since: T0, seen: { a: T0 } };
    const rows = [row({ id: 'a', ctime: '2026-11-20T10:00:00Z' }), row({ id: 'b', ctime: '2026-11-20T10:00:00Z' }), { _id: 'c' }];
    expect(newRowPolling.selectFresh({ rows, state }).map((item) => item._id)).toEqual(['b']);
  });
});

describe('newRowPolling.advance', () => {
  it('moves to the newest creation time and remembers only the rows created at that moment', () => {
    const rows = [row({ id: 'a', ctime: '2026-11-20T10:00:00Z' }), row({ id: 'b', ctime: '2026-11-20T10:00:05Z' })];
    expect(newRowPolling.advance({ state: { since: T0, seen: { a: T0 } }, rows, full: false })).toEqual({
      since: T0 + 5000,
      seen: { b: T0 + 5000 },
    });
  });

  it('keeps the state when nothing came back', () => {
    const state = { since: T0, seen: { a: T0 } };
    expect(newRowPolling.advance({ state, rows: [], full: false })).toBe(state);
  });

  it('steps past a full page of rows that were all emitted, so the trigger never stalls on one second', () => {
    const rows = [row({ id: 'a', ctime: '2026-11-20T10:00:00Z' })];
    expect(newRowPolling.advance({ state: { since: T0, seen: { a: T0 } }, rows, full: true })).toEqual({ since: T0 + 1000, seen: {} });
  });

  it('counts creation times by the second, because SeaTable drops the milliseconds of some rows', () => {
    const rows = [row({ id: 'a', ctime: '2026-11-20T10:00:00.849Z' }), row({ id: 'b', ctime: '2026-11-20T10:00:00Z' })];
    expect(newRowPolling.advance({ state: { since: null, seen: {} }, rows, full: false })).toEqual({ since: T0, seen: { a: T0, b: T0 } });
  });
});

describe('newRowPolling end to end', () => {
  it('ignores rows that existed when enabled, even in the same second, and fires once for a row added in that second', async () => {
    const store = memoryStore();
    seatable([
      [row({ id: 'old', ctime: '2026-11-20T11:00:00+01:00' })],
      [row({ id: 'old', ctime: '2026-11-20T11:00:00+01:00' })],
    ]);
    await newRowPolling.onEnable({ auth, table: 'Contacts', store });
    vi.restoreAllMocks();
    const spy = seatable([[row({ id: 'old', ctime: '2026-11-20T11:00:00+01:00' }), row({ id: 'new', ctime: '2026-11-20T11:00:00+01:00' })]]);
    const fired = await newRowPolling.poll({ auth, table: 'Contacts', store });
    expect(fired.map((item) => item._id)).toEqual(['new']);
    expect(spy.mock.calls[1][0].body).toEqual({
      sql: 'SELECT * FROM `Contacts` WHERE _ctime >= ? ORDER BY _ctime ASC LIMIT 1000',
      parameters: ['2026-11-20T10:00:00.000Z'],
      convert_keys: true,
    });
    vi.restoreAllMocks();
    seatable([[row({ id: 'old', ctime: '2026-11-20T11:00:00+01:00' }), row({ id: 'new', ctime: '2026-11-20T11:00:00+01:00' })]]);
    expect(await newRowPolling.poll({ auth, table: 'Contacts', store })).toEqual([]);
  });

  it('fires for a row created in the same second as a row SeaTable stamped with milliseconds', async () => {
    const store = memoryStore();
    seatable([[row({ id: 'old', ctime: '2026-11-20T11:00:00.849+01:00' })], [row({ id: 'old', ctime: '2026-11-20T11:00:00.849+01:00' })]]);
    await newRowPolling.onEnable({ auth, table: 'Contacts', store });
    vi.restoreAllMocks();
    const spy = seatable([[row({ id: 'old', ctime: '2026-11-20T11:00:00.849+01:00' }), row({ id: 'new', ctime: '2026-11-20T11:00:00+01:00' })]]);
    const fired = await newRowPolling.poll({ auth, table: 'Contacts', store });
    expect(fired.map((item) => item._id)).toEqual(['new']);
    expect(spy.mock.calls[1][0].body).toMatchObject({ parameters: ['2026-11-20T10:00:00.000Z'] });
  });

  it('fires for every row of a table that was empty when enabled', async () => {
    const store = memoryStore();
    seatable([[]]);
    await newRowPolling.onEnable({ auth, table: 'Contacts', store });
    vi.restoreAllMocks();
    seatable([[row({ id: 'first', ctime: '2026-11-20T11:00:00+01:00' })]]);
    expect((await newRowPolling.poll({ auth, table: 'Contacts', store })).map((item) => item._id)).toEqual(['first']);
  });

  it('keeps the stored position on republish', async () => {
    const store = memoryStore();
    await store.put('new_row_state', { since: T0, seen: {} });
    const spy = seatable([]);
    await newRowPolling.onEnable({ auth, table: 'Contacts', store, isRepublish: true });
    expect(spy).not.toHaveBeenCalled();
    expect(await store.get('new_row_state')).toEqual({ since: T0, seen: {} });
  });
});
