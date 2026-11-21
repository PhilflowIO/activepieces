import { Store, isNil } from '@activepieces/pieces-framework';
import { SeaTableAuthProps, SeaTableBase, SeaTableRow, seatableClient } from './client';
import { seatableRows } from './rows';

export const newRowPolling = {
  onEnable,
  poll,
  test,
  initialState,
  selectFresh,
  advance,
};

async function onEnable({ auth, table, store, isRepublish }: EnableParams): Promise<void> {
  if (isRepublish && !isNil(await store.get<PollingState>(STATE_KEY))) {
    return;
  }
  const base = await seatableClient.connect(auth);
  await store.put(STATE_KEY, await currentState({ base, table }));
}

async function poll({ auth, table, store }: PollParams): Promise<SeaTableRow[]> {
  const base = await seatableClient.connect(auth);
  const state = await store.get<PollingState>(STATE_KEY);
  if (isNil(state)) {
    await store.put(STATE_KEY, await currentState({ base, table }));
    return [];
  }
  const rows = await seatableClient.query(
    isNil(state.since)
      ? { base, sql: `SELECT * FROM ${seatableRows.quoteIdentifier(table)} ORDER BY _ctime ASC LIMIT ${MAX_ROWS}`, parameters: [] }
      : {
          base,
          sql: `SELECT * FROM ${seatableRows.quoteIdentifier(table)} WHERE _ctime >= ? ORDER BY _ctime ASC LIMIT ${MAX_ROWS}`,
          parameters: [new Date(state.since).toISOString()],
        },
  );
  const fresh = selectFresh({ rows, state });
  await store.put(STATE_KEY, advance({ state, rows, full: rows.length >= MAX_ROWS }));
  return fresh;
}

async function test({ auth, table }: { auth: SeaTableAuthProps; table: string }): Promise<SeaTableRow[]> {
  const base = await seatableClient.connect(auth);
  return seatableClient.query({
    base,
    sql: `SELECT * FROM ${seatableRows.quoteIdentifier(table)} ORDER BY _ctime DESC LIMIT ${TEST_ROWS}`,
    parameters: [],
  });
}

async function currentState({ base, table }: { base: SeaTableBase; table: string }): Promise<PollingState> {
  const quoted = seatableRows.quoteIdentifier(table);
  const newest = await seatableClient.query({ base, sql: `SELECT _id, _ctime FROM ${quoted} ORDER BY _ctime DESC LIMIT 1`, parameters: [] });
  const since = createdAt(newest[0]);
  if (isNil(since)) {
    return initialState({ rows: [] });
  }
  const sameMoment = await seatableClient.query({
    base,
    sql: `SELECT _id, _ctime FROM ${quoted} WHERE _ctime >= ? ORDER BY _ctime ASC LIMIT ${MAX_ROWS}`,
    parameters: [new Date(since).toISOString()],
  });
  return initialState({ rows: sameMoment });
}

function initialState({ rows }: { rows: SeaTableRow[] }): PollingState {
  return advance({ state: { since: null, seen: {} }, rows, full: false });
}

function selectFresh({ rows, state }: { rows: SeaTableRow[]; state: PollingState }): SeaTableRow[] {
  return rows.filter((row) => {
    const created = createdAt(row);
    return !isNil(created) && isNil(state.seen[row._id]) && (isNil(state.since) || created >= state.since);
  });
}

function advance({ state, rows, full }: { state: PollingState; rows: SeaTableRow[]; full: boolean }): PollingState {
  const stamped = rows.flatMap((row) => {
    const created = createdAt(row);
    return isNil(created) ? [] : [{ id: row._id, created }];
  });
  if (stamped.length === 0) {
    return state;
  }
  const newest = stamped.reduce((latest, row) => Math.max(latest, row.created), state.since ?? Number.NEGATIVE_INFINITY);
  const nothingNew = stamped.every((row) => !isNil(state.seen[row.id]));
  if (full && nothingNew) {
    return { since: newest + 1, seen: {} };
  }
  const known = { ...state.seen, ...Object.fromEntries(stamped.map((row) => [row.id, row.created])) };
  const seen = Object.fromEntries(Object.entries(known).filter(([, created]) => created === newest));
  return { since: newest, seen };
}

function createdAt(row: SeaTableRow | undefined): number | undefined {
  const value = row?.['_ctime'];
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

const STATE_KEY = 'new_row_state';
const MAX_ROWS = 1000;
const TEST_ROWS = 5;

export type PollingState = {
  since: number | null;
  seen: Record<string, number>;
};

type EnableParams = {
  auth: SeaTableAuthProps;
  table: string;
  store: Store;
  isRepublish?: boolean;
};

type PollParams = {
  auth: SeaTableAuthProps;
  table: string;
  store: Store;
};
