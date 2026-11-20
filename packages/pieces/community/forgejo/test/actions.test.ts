import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError, HttpMethod, httpClient } from '@activepieces/pieces-common';
import { forgejo } from '../src/index';
import { addLabelAction } from '../src/lib/actions/add-label';
import { createCommentAction } from '../src/lib/actions/create-comment';
import { createEpicAction } from '../src/lib/actions/create-epic';
import { createIssueAction } from '../src/lib/actions/create-issue';
import { findIssueAction } from '../src/lib/actions/find-issue';
import { listOrgIssuesAction } from '../src/lib/actions/list-org-issues';
import { listRepoIssuesAction } from '../src/lib/actions/list-repo-issues';
import { forgejoAuth } from '../src/lib/auth';
import { forgejoClient } from '../src/lib/common/client';

const props = { baseUrl: 'https://git.acme.test/', token: ' t0k3n \n' };
const auth = { type: 'CUSTOM_AUTH', props };
const API = 'https://git.acme.test/api/v1';

function ok(body: unknown) {
  return { status: 200, headers: {}, body };
}

function issue(number: number, title = `Issue ${number}`) {
  return { id: number * 10, number, title, body: '', state: 'open', html_url: `https://git.acme.test/acme/web/issues/${number}`, labels: [] };
}

function run(action: { run: (ctx: never) => Promise<unknown> }, propsValue: Record<string, unknown>) {
  return action.run({ auth, propsValue } as never);
}

function requests(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.map(([request]) => request as { method: HttpMethod; url: string; body?: unknown; queryParams?: unknown; headers?: unknown });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the piece', () => {
  it('offers exactly the seven actions and no trigger', () => {
    expect(Object.keys(forgejo.actions()).sort()).toEqual(
      ['add_label', 'create_comment', 'create_epic', 'create_issue', 'find_issue', 'list_org_issues', 'list_repo_issues'],
    );
    expect(Object.keys(forgejo.triggers())).toEqual([]);
  });

  it('classifies reads as reads and every other action as a write', () => {
    const classes = Object.fromEntries(Object.values(forgejo.actions()).map((action) => [action.name, action.classification]));
    expect(classes).toEqual({
      find_issue: 'SEARCH',
      list_repo_issues: 'READ',
      list_org_issues: 'READ',
      create_issue: 'WRITE',
      create_epic: 'WRITE',
      create_comment: 'WRITE',
      add_label: 'WRITE',
    });
  });

  it('names owner and repository as parameters of every repository action', () => {
    for (const action of [findIssueAction, listRepoIssuesAction, createIssueAction, createEpicAction, createCommentAction, addLabelAction]) {
      expect(Object.keys(action.props)).toEqual(expect.arrayContaining(['owner', 'repo']));
    }
  });
});

describe('forgejoClient', () => {
  it('builds the API address from the instance URL and nothing else', () => {
    expect(forgejoClient.apiUrl(props)).toBe(API);
    expect(forgejoClient.apiUrl({ ...props, baseUrl: 'https://git.acme.test/api/v1/' })).toBe(API);
  });

  it('refuses an owner or repository that is not a single name', () => {
    for (const repo of ['', '..', 'a/b', '../admin', 'web?x=1', 'web#1', 'a b']) {
      expect(() => forgejoClient.repoPath({ owner: 'acme', repo })).toThrow('single name');
    }
    expect(forgejoClient.repoPath({ owner: ' acme ', repo: 'web.site_2-x' })).toBe('/repos/acme/web.site_2-x');
  });

  it('sends the trimmed token and words a vendor error with a hint', async () => {
    const spy = vi.spyOn(httpClient, 'sendRequest').mockRejectedValueOnce(
      new HttpError({}, { status: 404, responseBody: { message: 'The target couldn\'t be found.' } }),
    );
    await expect(run(listRepoIssuesAction, { owner: 'acme', repo: 'web' })).rejects.toThrow(
      "Forgejo returned an error (404). The target couldn't be found. Check the owner, the repository and the issue number",
    );
    expect(requests(spy)[0].headers).toMatchObject({ Authorization: 'token t0k3n' });
  });
});

describe('read actions', () => {
  it('find issues searches one repository with GET only', async () => {
    const spy = vi.spyOn(httpClient, 'sendRequest').mockResolvedValue(ok([issue(4)]));
    const found = await run(findIssueAction, { owner: 'acme', repo: 'web', query: 'Login', limit: 500 });
    expect(found).toEqual([issue(4)]);
    expect(requests(spy)).toEqual([expect.objectContaining({
      method: HttpMethod.GET,
      url: `${API}/repos/acme/web/issues`,
      queryParams: { q: 'Login', type: 'issues', state: 'open', limit: '50' },
    })]);
  });

  it('lists the open issues of a repository with GET only', async () => {
    const spy = vi.spyOn(httpClient, 'sendRequest').mockResolvedValue(ok([]));
    await run(listRepoIssuesAction, { owner: 'acme', repo: 'web', state: 'all' });
    expect(requests(spy)).toEqual([expect.objectContaining({
      method: HttpMethod.GET,
      url: `${API}/repos/acme/web/issues`,
      queryParams: { type: 'issues', state: 'all', limit: '30' },
    })]);
  });

  it('lists the issues of an organization through the search endpoint', async () => {
    const spy = vi.spyOn(httpClient, 'sendRequest').mockResolvedValue(ok([]));
    await run(listOrgIssuesAction, { owner: 'acme' });
    expect(requests(spy)).toEqual([expect.objectContaining({
      method: HttpMethod.GET,
      url: `${API}/repos/issues/search`,
      queryParams: { owner: 'acme', type: 'issues', state: 'open', limit: '30' },
    })]);
    await expect(run(listOrgIssuesAction, { owner: 'acme/web' })).rejects.toThrow('single name');
  });
});

describe('write actions', () => {
  it('creates an issue and then adds its labels by name', async () => {
    const spy = vi
      .spyOn(httpClient, 'sendRequest')
      .mockResolvedValueOnce(ok(issue(7, 'Fix login')))
      .mockResolvedValueOnce(ok([{ id: 1, name: 'bug' }]));
    const created = await run(createIssueAction, { owner: 'acme', repo: 'web', title: ' Fix login ', body: 'Steps', labels: ['bug', ' ', 3] });
    expect(created).toMatchObject({ number: 7, labels: [{ id: 1, name: 'bug' }] });
    expect(requests(spy)).toEqual([
      expect.objectContaining({ method: HttpMethod.POST, url: `${API}/repos/acme/web/issues`, body: { title: 'Fix login', body: 'Steps' } }),
      expect.objectContaining({ method: HttpMethod.POST, url: `${API}/repos/acme/web/issues/7/labels`, body: { labels: ['bug'] } }),
    ]);
  });

  it('creates an issue in one call when no label is named', async () => {
    const spy = vi.spyOn(httpClient, 'sendRequest').mockResolvedValueOnce(ok(issue(8)));
    await run(createIssueAction, { owner: 'acme', repo: 'web', title: 'Plain' });
    expect(requests(spy)).toHaveLength(1);
  });

  it('creates the sub-issues, then the epic with a task list, then one dependency per sub-issue', async () => {
    const spy = vi
      .spyOn(httpClient, 'sendRequest')
      .mockResolvedValueOnce(ok(issue(11, 'Design')))
      .mockResolvedValueOnce(ok(issue(12, 'Build')))
      .mockResolvedValueOnce(ok(issue(13, 'Relaunch')))
      .mockResolvedValue(ok({}));
    const result = await run(createEpicAction, {
      owner: 'acme',
      repo: 'web',
      title: 'Relaunch',
      body: 'Goal: new site.',
      children: [{ title: 'Design' }, { title: 'Build', body: 'Astro' }],
    });
    expect(result).toMatchObject({ epic: { number: 13 }, children: [{ number: 11 }, { number: 12 }] });
    const sent = requests(spy);
    expect(sent.map((request) => `${request.method} ${request.url.replace(API, '')}`)).toEqual([
      'POST /repos/acme/web/issues',
      'POST /repos/acme/web/issues',
      'POST /repos/acme/web/issues',
      'POST /repos/acme/web/issues/13/dependencies',
      'POST /repos/acme/web/issues/13/dependencies',
    ]);
    expect(sent[2].body).toEqual({ title: 'Relaunch', body: 'Goal: new site.\n\n- [ ] #11 Design\n- [ ] #12 Build' });
    expect(sent[3].body).toEqual({ owner: 'acme', repo: 'web', index: 11 });
    expect(sent[4].body).toEqual({ owner: 'acme', repo: 'web', index: 12 });
  });

  it('says which issues already exist when an epic fails half way', async () => {
    vi.spyOn(httpClient, 'sendRequest')
      .mockResolvedValueOnce(ok(issue(21, 'One')))
      .mockRejectedValueOnce(new HttpError({}, { status: 403, responseBody: {} }));
    await expect(
      run(createEpicAction, { owner: 'acme', repo: 'web', title: 'Epic', children: [{ title: 'One' }, { title: 'Two' }] }),
    ).rejects.toThrow('Already created before the failure: #21.');
  });

  it('refuses an epic without sub-issues, with an untitled one, or with too many, before any call', async () => {
    const spy = vi.spyOn(httpClient, 'sendRequest');
    await expect(run(createEpicAction, { owner: 'acme', repo: 'web', title: 'E', children: [] })).rejects.toThrow('at least one');
    await expect(run(createEpicAction, { owner: 'acme', repo: 'web', title: 'E', children: [{ title: ' ' }] })).rejects.toThrow('no title');
    const many = Array.from({ length: 26 }, (_, i) => ({ title: `T${i}` }));
    await expect(run(createEpicAction, { owner: 'acme', repo: 'web', title: 'E', children: many })).rejects.toThrow('at most 25');
    expect(spy).not.toHaveBeenCalled();
  });

  it('comments on an issue by its number', async () => {
    const spy = vi.spyOn(httpClient, 'sendRequest').mockResolvedValue(ok({ id: 1, html_url: 'u', body: 'Done' }));
    await run(createCommentAction, { owner: 'acme', repo: 'web', number: 5, body: 'Done' });
    expect(requests(spy)).toEqual([expect.objectContaining({ method: HttpMethod.POST, url: `${API}/repos/acme/web/issues/5/comments`, body: { body: 'Done' } })]);
    await expect(run(createCommentAction, { owner: 'acme', repo: 'web', number: 0, body: 'x' })).rejects.toThrow('at least 1');
  });

  it('adds labels by name and refuses an empty list', async () => {
    const spy = vi.spyOn(httpClient, 'sendRequest').mockResolvedValue(ok([{ id: 2, name: 'prio' }]));
    await run(addLabelAction, { owner: 'acme', repo: 'web', number: 5, labels: ['prio'] });
    expect(requests(spy)).toEqual([expect.objectContaining({ method: HttpMethod.POST, url: `${API}/repos/acme/web/issues/5/labels`, body: { labels: ['prio'] } })]);
    await expect(run(addLabelAction, { owner: 'acme', repo: 'web', number: 5, labels: [] })).rejects.toThrow('at least one label');
  });
});

describe('the connection', () => {
  const validate = (value: Record<string, string>) => forgejoAuth.validate!({ auth: value } as never);

  it('refuses an instance URL that is not https before any call', async () => {
    const spy = vi.spyOn(httpClient, 'sendRequest');
    await expect(validate({ baseUrl: 'http://git.acme.test', token: 't' })).resolves.toMatchObject({ valid: false });
    await expect(validate({ baseUrl: 'git.acme.test', token: 't' })).resolves.toMatchObject({ valid: false });
    expect(spy).not.toHaveBeenCalled();
  });

  it('tests the token against the current user', async () => {
    const spy = vi.spyOn(httpClient, 'sendRequest').mockResolvedValue(ok({ login: 'raven' }));
    await expect(validate(props)).resolves.toEqual({ valid: true });
    expect(requests(spy)).toEqual([expect.objectContaining({ method: HttpMethod.GET, url: `${API}/user` })]);
  });

  it('reports a refused token as invalid', async () => {
    vi.spyOn(httpClient, 'sendRequest').mockRejectedValue(new HttpError({}, { status: 401, responseBody: {} }));
    await expect(validate(props)).resolves.toMatchObject({ valid: false, error: expect.stringContaining('(401)') });
  });
});
