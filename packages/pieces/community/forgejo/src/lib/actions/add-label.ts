import { HttpMethod } from '@activepieces/pieces-common';
import { createAction } from '@activepieces/pieces-framework';
import { forgejoAuth, forgejoConnection } from '../auth';
import { forgejoClient } from '../common/client';
import { forgejoProps, issueIndex, labelNames } from '../common/props';

export const addLabelAction = createAction({
  auth: forgejoAuth,
  name: 'add_label',
  classification: 'WRITE',
  displayName: 'Add Labels to Issue',
  description: 'Adds existing labels to an issue; labels it already has stay.',
  audience: 'both',
  aiMetadata: {
    description:
      'Add one or more existing labels, by name, to one issue. Labels the issue already has stay, so repeating the call changes nothing more.',
    idempotent: true,
  },
  props: {
    owner: forgejoProps.owner(),
    repo: forgejoProps.repo(),
    number: forgejoProps.issueNumber(),
    labels: forgejoProps.labels(true),
  },
  async run({ auth, propsValue }) {
    const labels = labelNames(propsValue.labels);
    if (labels.length === 0) {
      throw new Error('Name at least one label.');
    }
    return forgejoClient.call<{ id: number; name: string }[]>({
      auth: forgejoConnection.toProps(auth),
      method: HttpMethod.POST,
      path: `${forgejoClient.repoPath(propsValue)}/issues/${issueIndex(propsValue.number)}/labels`,
      body: { labels },
    });
  },
});
