import { HttpMethod } from '@activepieces/pieces-common';
import { Property, createAction } from '@activepieces/pieces-framework';
import { forgejoAuth, forgejoConnection } from '../auth';
import { ForgejoIssue, forgejoClient } from '../common/client';
import { forgejoProps } from '../common/props';

export const listOrgIssuesAction = createAction({
  auth: forgejoAuth,
  name: 'list_org_issues',
  classification: 'READ',
  displayName: 'List Organization Issues',
  description: 'Lists the issues across all repositories of an organization or user.',
  audience: 'both',
  aiMetadata: {
    description:
      'List the issues across every repository of one organization or user the token can see, open ones by default, at most 50. Use it for an overview of all projects. Read-only, safe to retry.',
    idempotent: true,
  },
  props: {
    owner: Property.ShortText({
      displayName: 'Organization',
      description: 'The organization or user name, for example "acme".',
      required: true,
    }),
    state: forgejoProps.state(),
    limit: forgejoProps.limit(),
  },
  async run({ auth, propsValue }) {
    return forgejoClient.call<ForgejoIssue[]>({
      auth: forgejoConnection.toProps(auth),
      method: HttpMethod.GET,
      path: '/repos/issues/search',
      query: {
        owner: forgejoClient.name(propsValue.owner, 'Organization'),
        type: 'issues',
        state: propsValue.state ?? 'open',
        limit: String(forgejoClient.clampLimit(propsValue.limit)),
      },
    });
  },
});
