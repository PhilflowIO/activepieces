import { AppConnectionValueForAuthProperty, PieceAuth, Property } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { ForgejoApiError, ForgejoAuthProps, forgejoClient } from './common/client';

export const forgejoAuth = PieceAuth.CustomAuth({
  displayName: 'Connection',
  description: `
Works with any Forgejo or Gitea instance, self-hosted or Codeberg.

1. In Forgejo, open **Settings** → **Applications** → **Generate New Token**.
2. Give it a name and grant **issue: Read and Write**, **repository: Read** and **organization: Read**.
3. Paste the token below together with the address of your instance.
`,
  required: true,
  props: {
    baseUrl: Property.ShortText({
      displayName: 'Instance URL',
      description: 'For example https://codeberg.org or https://git.yourcompany.com',
      required: true,
    }),
    token: PieceAuth.SecretText({
      displayName: 'Access Token',
      description: 'A personal access token of the account Raven acts as.',
      required: true,
    }),
  },
  validate: async ({ auth }) => {
    if (!isHttpsUrl(auth.baseUrl)) {
      return { valid: false, error: 'Instance URL must be a full https link, for example https://codeberg.org' };
    }
    try {
      // Proven with a read the scopes above cover (issue: Read). `/user` would
      // need read:user, which a least-privilege token does not have.
      await forgejoClient.call({ auth, method: HttpMethod.GET, path: '/repos/issues/search', query: { limit: '1' } });
      return { valid: true };
    } catch (error) {
      // A refused token (401) and a token without the issue scope (403) leave
      // with their status, so the host can tell the person which one it is.
      if (error instanceof ForgejoApiError && (error.status === 401 || error.status === 403)) {
        throw error;
      }
      return { valid: false, error: error instanceof Error ? error.message : 'Invalid instance URL or access token.' };
    }
  },
  getConnectionIdentifier: async ({ auth }) => {
    const host = hostOf(auth.baseUrl);
    try {
      // Best effort: the account name only if the token may read it (read:user).
      const user = await forgejoClient.call<{ login: string }>({ auth, method: HttpMethod.GET, path: '/user' });
      return host ? `${user.login} (${host})` : user.login;
    } catch {
      return host;
    }
  },
});

export const forgejoConnection = {
  toProps,
};

function toProps(auth: ForgejoAuthValue): ForgejoAuthProps {
  return { baseUrl: auth.props.baseUrl, token: auth.props.token };
}

function hostOf(value: string): string | undefined {
  try {
    return new URL(value.trim()).host || undefined;
  } catch {
    return undefined;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

export type ForgejoAuthValue = AppConnectionValueForAuthProperty<typeof forgejoAuth>;
