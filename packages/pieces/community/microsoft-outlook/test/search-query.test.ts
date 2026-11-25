/// <reference types="vitest/globals" />

import { createMockActionContext } from '@activepieces/pieces-framework';

const apiMock = vi.fn();

vi.mock('../src/lib/common/client', () => ({
  outlookCommon: {
    createClient: () => ({
      api: (url: string) => {
        apiMock(url);
        return { headers: () => ({ get: async () => ({ value: [] }) }) };
      },
    }),
    mailboxPrefix: () => '/me',
  },
}));

import { outlookSearchMessagesAction } from '../src/lib/actions/outlook-search-messages';
import { findEmailAction } from '../src/lib/actions/find-email';

async function searchSentToGraph({
  action,
  searchQuery,
}: {
  action: typeof outlookSearchMessagesAction | typeof findEmailAction;
  searchQuery: string;
}): Promise<string | null> {
  apiMock.mockClear();
  const context = createMockActionContext({ propsValue: { searchQuery } });
  await action.run({ ...context, auth: { access_token: 'access-token' } } as never);
  expect(apiMock).toHaveBeenCalledTimes(1);
  return new URL(apiMock.mock.calls[0][0], 'https://graph.microsoft.com').searchParams.get('$search');
}

describe.each([
  ['outlook_search_messages', outlookSearchMessagesAction],
  ['findEmail', findEmailAction],
])('%s $search value', (_name, action) => {
  it('wraps a plain query in double quotes', async () => {
    expect(await searchSentToGraph({ action, searchQuery: 'invoice' })).toBe('"invoice"');
  });

  it('escapes double quotes inside a KQL phrase', async () => {
    expect(await searchSentToGraph({ action, searchQuery: 'subject:"Quarterly report"' })).toBe(
      '"subject:\\"Quarterly report\\""',
    );
  });

  it('escapes a query that is already wrapped in double quotes', async () => {
    expect(await searchSentToGraph({ action, searchQuery: '"invoice" OR "receipt"' })).toBe(
      '"\\"invoice\\" OR \\"receipt\\""',
    );
  });

  it('escapes backslashes before quotes', async () => {
    expect(await searchSentToGraph({ action, searchQuery: 'body:C:\\temp' })).toBe('"body:C:\\\\temp"');
  });

  it('keeps & and # inside the search value', async () => {
    expect(await searchSentToGraph({ action, searchQuery: 'subject:R&D #42' })).toBe('"subject:R&D #42"');
  });
});
