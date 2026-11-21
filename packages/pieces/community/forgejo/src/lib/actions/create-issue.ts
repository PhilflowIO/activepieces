import { Property, createAction } from '@activepieces/pieces-framework';
import { forgejoAuth, forgejoConnection } from '../auth';
import { forgejoIssues } from '../common/issues';
import { forgejoProps } from '../common/props';

export const createIssueAction = createAction({
  auth: forgejoAuth,
  name: 'create_issue',
  classification: 'WRITE',
  displayName: 'Create Issue',
  description: 'Creates an issue in a repository.',
  audience: 'both',
  aiMetadata: {
    description:
      'Open a new issue in one repository with a title, an optional text and optional existing labels. Each call creates another issue, so it is not idempotent; search first when a duplicate is possible.',
    idempotent: false,
  },
  props: {
    owner: forgejoProps.owner(),
    repo: forgejoProps.repo(),
    title: Property.ShortText({ displayName: 'Title', required: true }),
    body: Property.LongText({ displayName: 'Text', required: false }),
    labels: forgejoProps.labels(false),
  },
  async run({ auth, propsValue }) {
    return forgejoIssues.create({
      auth: forgejoConnection.toProps(auth),
      repo: { owner: propsValue.owner, repo: propsValue.repo },
      issue: { title: propsValue.title, body: propsValue.body, labels: propsValue.labels },
    });
  },
});
