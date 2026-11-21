import { Property, createAction } from '@activepieces/pieces-framework';
import { forgejoAuth, forgejoConnection } from '../auth';
import { forgejoIssues } from '../common/issues';
import { forgejoProps } from '../common/props';

export const createEpicAction = createAction({
  auth: forgejoAuth,
  name: 'create_epic',
  classification: 'WRITE',
  displayName: 'Create Epic with Sub-Issues',
  description: 'Creates the sub-issues, then an epic that lists them and depends on each of them.',
  audience: 'both',
  aiMetadata: {
    description:
      'Create an epic in one repository together with its sub-issues in a single call: every sub-issue becomes its own issue, the epic lists them as a task list and depends on each, so it cannot be closed before they are. At most 25 sub-issues. Each call creates new issues, so it is not idempotent.',
    idempotent: false,
  },
  props: {
    owner: forgejoProps.owner(),
    repo: forgejoProps.repo(),
    title: Property.ShortText({ displayName: 'Epic Title', required: true }),
    body: Property.LongText({ displayName: 'Epic Text', required: false }),
    labels: forgejoProps.labels(false),
    children: Property.Array({
      displayName: 'Sub-Issues',
      required: true,
      properties: {
        title: Property.ShortText({ displayName: 'Title', required: true }),
        body: Property.LongText({ displayName: 'Text', required: false }),
      },
    }),
  },
  async run({ auth, propsValue }) {
    return forgejoIssues.createEpic({
      auth: forgejoConnection.toProps(auth),
      repo: { owner: propsValue.owner, repo: propsValue.repo },
      epic: { title: propsValue.title, body: propsValue.body, labels: propsValue.labels },
      children: propsValue.children,
    });
  },
});
