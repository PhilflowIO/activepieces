import { HttpMethod } from '@activepieces/pieces-common';
import { ForgejoAuthProps, ForgejoIssue, RepoRef, forgejoClient } from './client';
import { labelNames } from './props';

export const forgejoIssues = {
  create,
  createEpic,
};

async function create({ auth, repo, issue }: { auth: ForgejoAuthProps; repo: RepoRef; issue: IssueInput }): Promise<ForgejoIssue> {
  const path = forgejoClient.repoPath(repo);
  const title = (issue.title ?? '').trim();
  if (title.length === 0) {
    throw new Error('Title must not be empty.');
  }
  const created = await forgejoClient.call<ForgejoIssue>({
    auth,
    method: HttpMethod.POST,
    path: `${path}/issues`,
    body: { title, body: issue.body ?? '' },
  });
  const labels = labelNames(issue.labels);
  if (labels.length === 0) {
    return created;
  }
  const applied = await forgejoClient.call<ForgejoIssue['labels']>({
    auth,
    method: HttpMethod.POST,
    path: `${path}/issues/${created.number}/labels`,
    body: { labels },
  });
  return { ...created, labels: applied };
}

async function createEpic({ auth, repo, epic, children }: EpicInput): Promise<EpicResult> {
  const path = forgejoClient.repoPath(repo);
  const parts = normalizeChildren(children);
  const created: ForgejoIssue[] = [];
  try {
    for (const child of parts) {
      created.push(await create({ auth, repo, issue: child }));
    }
    const taskList = created.map((issue) => `- [ ] #${issue.number} ${issue.title}`).join('\n');
    const body = [epic.body?.trim() ?? '', taskList].filter((part) => part.length > 0).join('\n\n');
    const parent = await create({ auth, repo, issue: { ...epic, body } });
    for (const issue of created) {
      await forgejoClient.call<unknown>({
        auth,
        method: HttpMethod.POST,
        path: `${path}/issues/${parent.number}/dependencies`,
        body: { owner: repo.owner.trim(), repo: repo.repo.trim(), index: issue.number },
      });
    }
    return { epic: parent, children: created };
  } catch (error) {
    if (created.length === 0) {
      throw error;
    }
    const numbers = created.map((issue) => `#${issue.number}`).join(', ');
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${reason}. Already created before the failure: ${numbers}.`);
  }
}

function normalizeChildren(children: unknown): IssueInput[] {
  if (!Array.isArray(children) || children.length === 0) {
    throw new Error('An epic needs at least one sub-issue.');
  }
  if (children.length > MAX_CHILDREN) {
    throw new Error(`An epic takes at most ${MAX_CHILDREN} sub-issues per call.`);
  }
  return children.map((child, position) => {
    const value = (typeof child === 'object' && child !== null ? child : {}) as Record<string, unknown>;
    const title = typeof value['title'] === 'string' ? value['title'].trim() : '';
    if (title.length === 0) {
      throw new Error(`Sub-issue ${position + 1} has no title.`);
    }
    return {
      title,
      body: typeof value['body'] === 'string' ? value['body'] : undefined,
      labels: value['labels'],
    };
  });
}

const MAX_CHILDREN = 25;

export type IssueInput = {
  title: string;
  body?: string;
  labels?: unknown;
};

type EpicInput = {
  auth: ForgejoAuthProps;
  repo: RepoRef;
  epic: IssueInput;
  children: unknown;
};

export type EpicResult = {
  epic: ForgejoIssue;
  children: ForgejoIssue[];
};
