import { HttpMethod } from '@activepieces/pieces-common';
import { Property, createAction } from '@activepieces/pieces-framework';
import { forgejoAuth, forgejoConnection } from '../auth';
import { ForgejoIssue, forgejoClient } from '../common/client';
import { forgejoProps } from '../common/props';

export const findIssueAction = createAction({
  auth: forgejoAuth,
  name: 'find_issue',
  classification: 'SEARCH',
  displayName: 'Find Issues',
  description: 'Finds issues in a repository whose title or text contains a search term.',
  audience: 'both',
  aiMetadata: {
    description:
      'Search the issues of one repository by a word or phrase in their title or text, optionally by state. Returns a list, empty when nothing matches. Use it before creating an issue to avoid duplicates. Read-only, safe to retry.',
    idempotent: true,
  },
  props: {
    owner: forgejoProps.owner(),
    repo: forgejoProps.repo(),
    query: Property.ShortText({
      displayName: 'Search Term',
      required: true,
    }),
    state: forgejoProps.state(),
    limit: forgejoProps.limit(),
  },
  async run({ auth, propsValue }) {
    return forgejoClient.call<ForgejoIssue[]>({
      auth: forgejoConnection.toProps(auth),
      method: HttpMethod.GET,
      path: `${forgejoClient.repoPath(propsValue)}/issues`,
      query: {
        q: propsValue.query,
        type: 'issues',
        state: propsValue.state ?? 'open',
        limit: String(forgejoClient.clampLimit(propsValue.limit)),
      },
    });
  },
});
