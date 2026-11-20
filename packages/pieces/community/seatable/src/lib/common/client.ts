import { HttpError, HttpMethod, httpClient } from '@activepieces/pieces-common';
import { isNil } from '@activepieces/pieces-framework';

export class SeaTableApiError extends Error {
  readonly status: number;

  constructor({ status, message }: { status: number; message: string }) {
    super(message);
    this.name = 'SeaTableApiError';
    this.status = status;
  }
}

export const seatableClient = {
  serverUrl,
  connect,
};

function serverUrl(auth: SeaTableAuthProps): string {
  const trimmed = auth.serverUrl.trim().replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : DEFAULT_SERVER_URL;
}

async function connect(auth: SeaTableAuthProps): Promise<SeaTableBase> {
  const access = await send<AppAccessToken>({
    method: HttpMethod.GET,
    url: `${serverUrl(auth)}/api/v2.1/dtable/app-access-token/`,
    token: auth.apiToken.trim(),
  });
  if (access.use_api_gateway === false) {
    throw new Error('This SeaTable server is older than version 5.0. Upgrade it to use this piece.');
  }
  const gatewayUrl = `${access.dtable_server.replace(/\/+$/, '')}/api/v2/dtables/${access.dtable_uuid}`;
  const call = <T>({ method, path, query, body }: CallParams): Promise<T> =>
    send<T>({ method, url: `${gatewayUrl}${path}`, token: access.access_token, query, body });

  return {
    accessToken: access.access_token,
    baseUuid: access.dtable_uuid,
    baseName: access.dtable_name,
    call,
    listTables: async () => {
      const response = await call<{ metadata: { tables: SeaTableTable[] } }>({
        method: HttpMethod.GET,
        path: '/metadata/',
      });
      return response.metadata.tables;
    },
    getRow: ({ table, rowId }) =>
      call<SeaTableRow>({
        method: HttpMethod.GET,
        path: `/rows/${encodeURIComponent(rowId)}/`,
        query: { table_name: table, convert_keys: 'true' },
      }),
    listRows: async ({ table, view, start, limit }) => {
      const response = await call<{ rows: SeaTableRow[] }>({
        method: HttpMethod.GET,
        path: '/rows/',
        query: {
          table_name: table,
          convert_keys: 'true',
          start: String(start),
          limit: String(limit),
          ...(isNil(view) || view === '' ? {} : { view_name: view }),
        },
      });
      return response.rows;
    },
    appendRow: async ({ table, row }) => {
      const response = await call<{ row_ids: { _id: string }[] }>({
        method: HttpMethod.POST,
        path: '/rows/',
        body: { table_name: table, rows: [row] },
      });
      const created = response.row_ids[0];
      if (isNil(created)) {
        throw new Error('SeaTable did not return the ID of the new row.');
      }
      return created._id;
    },
    updateRow: async ({ table, rowId, row }) => {
      await call<unknown>({
        method: HttpMethod.PUT,
        path: '/rows/',
        body: { table_name: table, updates: [{ row_id: rowId, row }] },
      });
    },
    deleteRow: async ({ table, rowId }) => {
      const response = await call<{ deleted_rows: number }>({
        method: HttpMethod.DELETE,
        path: '/rows/',
        body: { table_name: table, row_ids: [rowId] },
      });
      return response.deleted_rows;
    },
    query: async ({ sql, parameters }) => {
      const response = await call<{ results: SeaTableRow[] }>({
        method: HttpMethod.POST,
        path: '/sql/',
        body: { sql, parameters, convert_keys: true },
      });
      return response.results;
    },
  };
}

async function send<T>({ method, url, token, query, body }: SendParams): Promise<T> {
  try {
    const response = await httpClient.sendRequest<T>({
      method,
      url,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      queryParams: query,
      body,
    });
    return response.body;
  } catch (error) {
    if (error instanceof HttpError) {
      const status = error.response.status;
      throw new SeaTableApiError({ status, message: describeFailure({ status, body: error.response.body }) });
    }
    throw error;
  }
}

function describeFailure({ status, body }: { status: number; body: unknown }): string {
  const detail = vendorMessage(body)?.replace(/\.+$/, '');
  const hint = STATUS_HINTS[status];
  return [`SeaTable returned an error (${status})`, detail, hint]
    .filter((part): part is string => !isNil(part) && part.length > 0)
    .join('. ');
}

function vendorMessage(body: unknown): string | undefined {
  if (typeof body === 'string') {
    const text = body.trim();
    return text.length === 0 || text.startsWith('<') ? undefined : text.slice(0, 500);
  }
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }
  const message = Object.entries(body).find(
    ([key, value]) => (key === 'error_message' || key === 'error_msg' || key === 'detail') && typeof value === 'string' && value.length > 0,
  );
  return isNil(message) ? undefined : String(message[1]);
}

const DEFAULT_SERVER_URL = 'https://cloud.seatable.io';
const STATUS_HINTS: Record<number, string> = {
  401: 'Check the server URL and API token in your connection',
  403: 'Check the API token in your connection, and that it has read-write permission for changes',
  404: 'Check that the table and row exist in the base of this connection',
  429: 'SeaTable is rate limiting this base. Wait a minute and try again',
};

export type SeaTableAuthProps = {
  serverUrl: string;
  apiToken: string;
};

export type SeaTableRow = Record<string, unknown> & { _id: string };

export type SeaTableColumn = {
  key: string;
  name: string;
  type: string;
  data?: { options?: { id: string; name: string }[] } | null;
};

export type SeaTableTable = {
  _id: string;
  name: string;
  columns: SeaTableColumn[];
  views?: { _id: string; name: string }[];
};

export type SeaTableBase = {
  accessToken: string;
  baseUuid: string;
  baseName: string;
  call: <T>(params: CallParams) => Promise<T>;
  listTables: () => Promise<SeaTableTable[]>;
  getRow: (params: { table: string; rowId: string }) => Promise<SeaTableRow>;
  listRows: (params: { table: string; view?: string; start: number; limit: number }) => Promise<SeaTableRow[]>;
  appendRow: (params: { table: string; row: Record<string, unknown> }) => Promise<string>;
  updateRow: (params: { table: string; rowId: string; row: Record<string, unknown> }) => Promise<void>;
  deleteRow: (params: { table: string; rowId: string }) => Promise<number>;
  query: (params: { sql: string; parameters: (string | number)[] }) => Promise<SeaTableRow[]>;
};

type CallParams = {
  method: HttpMethod;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
};

type SendParams = Omit<CallParams, 'path'> & {
  url: string;
  token: string;
};

type AppAccessToken = {
  access_token: string;
  dtable_uuid: string;
  dtable_server: string;
  dtable_name: string;
  use_api_gateway?: boolean;
};
