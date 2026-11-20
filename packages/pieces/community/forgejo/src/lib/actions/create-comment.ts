import { HttpMethod } from '@activepieces/pieces-common';
import { Property, createAction } from '@activepieces/pieces-framework';
import { forgejoAuth, forgejoConnection } from '../auth';
import { forgejoClient } from '../common/client';
import { forgejoProps, issueIndex } from '../common/props';

export const createCommentAction = createAction({
  auth: forgejoAuth,
  name: 'create_comment',
  classification: 'WRITE',
  displayName: 'Comment on Issue',
  description: 'Adds a comment to an issue or pull request.',
  audience: 'both',
  aiMetadata: {
    description:
      'Post a comment on one issue or pull request, identified by its number in the repository. Each call adds another comment, so it is not idempotent.',
    idempotent: false,
  },
  props: {
    owner: forgejoProps.owner(),
    repo: forgejoProps.repo(),
    number: forgejoProps.issueNumber(),
    body: Property.LongText({ displayName: 'Comment', required: true }),
  },
  async run({ auth, propsValue }) {
    return forgejoClient.call<{ id: number; html_url: string; body: string }>({
      auth: forgejoConnection.toProps(auth),
      method: HttpMethod.POST,
      path: `${forgejoClient.repoPath(propsValue)}/issues/${issueIndex(propsValue.number)}/comments`,
      body: { body: propsValue.body },
    });
  },
});
