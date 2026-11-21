import { HttpMethod } from '@activepieces/pieces-common';
import { createAction } from '@activepieces/pieces-framework';
import { forgejoAuth, forgejoConnection } from '../auth';
import { ForgejoIssue, forgejoClient } from '../common/client';
import { forgejoProps } from '../common/props';

export const listRepoIssuesAction = createAction({
  auth: forgejoAuth,
  name: 'list_repo_issues',
  classification: 'READ',
  displayName: 'List Repository Issues',
  description: 'Lists the issues of one repository, newest first.',
  audience: 'both',
  aiMetadata: {
    description:
      'List the issues of one repository, open ones by default, newest first, at most 50. Use it to answer what is open in a project. Read-only, safe to retry.',
    idempotent: true,
  },
  props: {
    owner: forgejoProps.owner(),
    repo: forgejoProps.repo(),
    state: forgejoProps.state(),
    limit: forgejoProps.limit(),
  },
  async run({ auth, propsValue }) {
    return forgejoClient.call<ForgejoIssue[]>({
      auth: forgejoConnection.toProps(auth),
      method: HttpMethod.GET,
      path: `${forgejoClient.repoPath(propsValue)}/issues`,
      query: {
        type: 'issues',
        state: propsValue.state ?? 'open',
        limit: String(forgejoClient.clampLimit(propsValue.limit)),
      },
    });
  },
});
