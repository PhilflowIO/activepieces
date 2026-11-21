import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpClient } from '@activepieces/pieces-common';
import { seatableAuth } from '../src/lib/auth';

const auth = { serverUrl: 'https://seatable.acme.test', apiToken: 'api-token' };
const access = {
  access_token: 'base-token',
  dtable_uuid: '650d8a0d-7e27-46a8-8b18-6cc6f3db2057',
  dtable_server: 'https://gateway.acme.test/api-gateway/',
  dtable_name: 'CRM',
  use_api_gateway: true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('seatableAuth.validate', () => {
  it('shows at connect time that the API gateway is on another address', async () => {
    vi.spyOn(httpClient, 'sendRequest').mockResolvedValueOnce({ status: 200, headers: {}, body: access });
    const result = await seatableAuth.validate?.({ auth, server: { apiUrl: '', publicUrl: '' } } as never);
    expect(result).toEqual({
      valid: false,
      error: expect.stringContaining('This SeaTable server sends data through a separate address (gateway.acme.test)'),
    });
  });
});
