import { createCustomApiCallAction } from '@activepieces/pieces-common';
import { PieceCategory, createPiece } from '@activepieces/pieces-framework';
import { createRowAction } from './lib/actions/create-row';
import { deleteRowAction } from './lib/actions/delete-row';
import { getBaseSchemaAction } from './lib/actions/get-base-schema';
import { getRowAction } from './lib/actions/get-row';
import { updateRowAction } from './lib/actions/update-row';
import { seatableAuth, seatableConnection } from './lib/auth';
import { seatableClient } from './lib/common/client';

export const seatable = createPiece({
  displayName: 'SeaTable',
  description: 'No-code database and app builder. Works with SeaTable Cloud and self-hosted SeaTable Server.',
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/seatable.png',
  categories: [PieceCategory.PRODUCTIVITY],
  auth: seatableAuth,
  authors: ['PhilflowIO'],
  actions: [
    createRowAction,
    getRowAction,
    updateRowAction,
    deleteRowAction,
    getBaseSchemaAction,
    createCustomApiCallAction({
      auth: seatableAuth,
      baseUrl: (auth) => (auth ? seatableClient.serverUrl(seatableConnection.toProps(auth)) : ''),
      authMapping: async (auth) => {
        const base = await seatableClient.connect(seatableConnection.toProps(auth));
        return { Authorization: `Bearer ${base.accessToken}` };
      },
      props: {
        url: {
          description:
            'Full URL, or a path relative to your SeaTable server. Base operations live under /api-gateway/api/v2/dtables/{base UUID}/; Get Base Schema returns the base UUID.',
          placeholder: '/api-gateway/api/v2/dtables/{base_uuid}/metadata/',
        },
      },
    }),
  ],
  triggers: [],
});
