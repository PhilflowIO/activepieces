import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError, HttpMethod, httpClient } from '@activepieces/pieces-common';
import { SeaTableApiError, seatableClient } from '../src/lib/common/client';

const auth = { serverUrl: 'https://seatable.acme.test/', apiToken: ' api-token \n' };
const access = {
  app_name: 'activepieces',
  access_token: 'base-token',
  dtable_uuid: '650d8a0d-7e27-46a8-8b18-6cc6f3db2057',
  dtable_server: 'https://seatable.acme.test/api-gateway/',
  dtable_name: 'CRM',
  use_api_gateway: true,
};

function ok(body: unknown) {
  return { status: 200, headers: {}, body };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('seatableClient.serverUrl', () => {
  it('drops trailing slashes and falls back to SeaTable Cloud when empty', () => {
    expect(seatableClient.serverUrl(auth)).toBe('https://seatable.acme.test');
    expect(seatableClient.serverUrl({ ...auth, serverUrl: '  ' })).toBe('https://cloud.seatable.io');
  });
});

describe('seatableClient.connect', () => {
  it('exchanges the trimmed API token for a base token and calls the gateway of that base', async () => {
    const spy = vi
      .spyOn(httpClient, 'sendRequest')
      .mockResolvedValueOnce(ok(access))
      .mockResolvedValueOnce(ok({ _id: 'row1', Name: 'Ada' }));
    const base = await seatableClient.connect(auth);
    const row = await seatableClient.getRow({ base, table: 'Contacts', rowId: 'row 1' });
    expect(row).toEqual({ _id: 'row1', Name: 'Ada' });
    expect(spy.mock.calls[0][0]).toMatchObject({
      method: HttpMethod.GET,
      url: 'https://seatable.acme.test/api/v2.1/dtable/app-access-token/',
      headers: { Authorization: 'Bearer api-token' },
    });
    expect(spy.mock.calls[1][0]).toMatchObject({
      url: 'https://seatable.acme.test/api-gateway/api/v2/dtables/650d8a0d-7e27-46a8-8b18-6cc6f3db2057/rows/row%201/',
      headers: { Authorization: 'Bearer base-token' },
      queryParams: { table_name: 'Contacts', convert_keys: 'true' },
    });
  });

  it('refuses servers without the API gateway', async () => {
    vi.spyOn(httpClient, 'sendRequest').mockResolvedValueOnce(ok({ ...access, use_api_gateway: false }));
    await expect(seatableClient.connect(auth)).rejects.toThrow('older than version 5.0');
  });

  it('turns a SeaTable error body into a readable message with a hint', async () => {
    vi.spyOn(httpClient, 'sendRequest').mockRejectedValueOnce(
      new HttpError({}, { status: 403, responseBody: { error_msg: 'Permission denied.' } }),
    );
    const failure = await seatableClient.connect(auth).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SeaTableApiError);
    expect(failure).toMatchObject({ status: 403 });
    expect(String(failure)).toContain('SeaTable returned an error (403). Permission denied. Check the API token');
  });

  it('returns the id of an appended row and sends one row per call', async () => {
    const spy = vi
      .spyOn(httpClient, 'sendRequest')
      .mockResolvedValueOnce(ok(access))
      .mockResolvedValueOnce(ok({ inserted_row_count: 1, row_ids: [{ _id: 'new-row' }] }));
    const base = await seatableClient.connect(auth);
    expect(await seatableClient.appendRow({ base, table: 'Contacts', row: { Name: 'Ada' } })).toBe('new-row');
    expect(spy.mock.calls[1][0]).toMatchObject({
      method: HttpMethod.POST,
      body: { table_name: 'Contacts', rows: [{ Name: 'Ada' }] },
    });
  });
});

describe('seatableClient row calls', () => {
  const base = {
    accessToken: 'base-token',
    baseUuid: access.dtable_uuid,
    baseName: 'CRM',
    gatewayUrl: 'https://seatable.acme.test/api-gateway/api/v2/dtables/650d8a0d-7e27-46a8-8b18-6cc6f3db2057',
  };

  it('reads with GET only', async () => {
    const spy = vi
      .spyOn(httpClient, 'sendRequest')
      .mockResolvedValueOnce(ok({ metadata: { tables: [] } }))
      .mockResolvedValueOnce(ok({ _id: 'row1' }))
      .mockResolvedValueOnce(ok({ rows: [] }));
    await seatableClient.listTables({ base });
    await seatableClient.getRow({ base, table: 'Contacts', rowId: 'row1' });
    await seatableClient.listRows({ base, table: 'Contacts', view: 'Leads', start: 0, limit: 10 });
    expect(spy.mock.calls.map(([request]) => request.method)).toEqual([HttpMethod.GET, HttpMethod.GET, HttpMethod.GET]);
    expect(spy.mock.calls[2][0]).toMatchObject({
      url: `${base.gatewayUrl}/rows/`,
      queryParams: { table_name: 'Contacts', convert_keys: 'true', start: '0', limit: '10', view_name: 'Leads' },
    });
  });

  it('sends a parameterised SQL query with column names', async () => {
    const spy = vi.spyOn(httpClient, 'sendRequest').mockResolvedValueOnce(ok({ results: [{ _id: 'row1' }] }));
    const rows = await seatableClient.query({ base, sql: 'SELECT * FROM `Contacts` WHERE `Email` = ? LIMIT 1', parameters: ['ada@example.com'] });
    expect(rows).toEqual([{ _id: 'row1' }]);
    expect(spy.mock.calls[0][0]).toMatchObject({
      method: HttpMethod.POST,
      url: `${base.gatewayUrl}/sql/`,
      body: { sql: 'SELECT * FROM `Contacts` WHERE `Email` = ? LIMIT 1', parameters: ['ada@example.com'], convert_keys: true },
    });
  });
});
