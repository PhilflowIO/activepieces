import { AppConnectionValueForAuthProperty, PieceAuth, Property } from '@activepieces/pieces-framework';
import { SeaTableAuthProps, seatableClient } from './common/client';

export const seatableAuth = PieceAuth.CustomAuth({
  displayName: 'Connection',
  description: `
A connection works with one SeaTable base.

1. Open the base in SeaTable, click the **...** next to its name and choose **Advanced** → **API Token**.
2. Click **Add API Token**, give it a name, choose **Read-Write** permission and copy the token.
3. Paste the token below. Keep the default server URL for SeaTable Cloud, or enter the address of your own SeaTable server.
`,
  required: true,
  props: {
    serverUrl: Property.ShortText({
      displayName: 'Server URL',
      description: 'For example https://cloud.seatable.io or https://seatable.yourcompany.com',
      required: true,
      defaultValue: 'https://cloud.seatable.io',
    }),
    apiToken: PieceAuth.SecretText({
      displayName: 'API Token',
      description: 'The API token of the base.',
      required: true,
    }),
  },
  validate: async ({ auth }) => {
    if (!isValidUrl(auth.serverUrl)) {
      return { valid: false, error: 'Server URL must be a full link, for example https://cloud.seatable.io' };
    }
    try {
      await seatableClient.connect(auth);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Invalid server URL or API token.' };
    }
  },
  getConnectionIdentifier: async ({ auth }) => {
    try {
      const base = await seatableClient.connect(auth);
      return `${base.baseName} (${new URL(seatableClient.serverUrl(auth)).host})`;
    } catch {
      return undefined;
    }
  },
});

export const seatableConnection = {
  toProps,
};

function toProps(auth: SeaTableAuthValue): SeaTableAuthProps {
  return { serverUrl: auth.props.serverUrl, apiToken: auth.props.apiToken };
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export type SeaTableAuthValue = AppConnectionValueForAuthProperty<typeof seatableAuth>;
