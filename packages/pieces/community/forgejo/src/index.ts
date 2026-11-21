import { PieceCategory, createPiece } from '@activepieces/pieces-framework';
import { addLabelAction } from './lib/actions/add-label';
import { createCommentAction } from './lib/actions/create-comment';
import { createEpicAction } from './lib/actions/create-epic';
import { createIssueAction } from './lib/actions/create-issue';
import { findIssueAction } from './lib/actions/find-issue';
import { listOrgIssuesAction } from './lib/actions/list-org-issues';
import { listRepoIssuesAction } from './lib/actions/list-repo-issues';
import { forgejoAuth } from './lib/auth';

export const forgejo = createPiece({
  displayName: 'Forgejo',
  description: 'Self-hosted software forge. Works with any Forgejo or Gitea instance, including Codeberg.',
  minimumSupportedRelease: '0.88.2',
  logoUrl: 'https://cdn.activepieces.com/pieces/gitea.png',
  categories: [PieceCategory.DEVELOPER_TOOLS],
  auth: forgejoAuth,
  authors: ['PhilflowIO'],
  actions: [
    findIssueAction,
    listRepoIssuesAction,
    listOrgIssuesAction,
    createIssueAction,
    createEpicAction,
    createCommentAction,
    addLabelAction,
  ],
  triggers: [],
});
