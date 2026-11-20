// Adapted from packages/pieces/community/gitea/src/lib/common/client.ts
// Copyright (c) 2020-2024 Activepieces Inc. Licensed under the MIT Expat license (see LICENSE).
import { HttpError, HttpMethod, QueryParams, httpClient } from '@activepieces/pieces-common';
import { isNil } from '@activepieces/pieces-framework';

export class ForgejoApiError extends Error {
  readonly status: number;

  constructor({ status, message }: { status: number; message: string }) {
    super(message);
    this.name = 'ForgejoApiError';
    this.status = status;
  }
}

export const forgejoClient = {
  apiUrl,
  repoPath,
  name,
  call,
  clampLimit,
};

function apiUrl(auth: ForgejoAuthProps): string {
  const trimmed = auth.baseUrl.trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  return `${trimmed}/api/v1`;
}

function repoPath({ owner, repo }: RepoRef): string {
  return `/repos/${encodeURIComponent(name(owner, 'Owner'))}/${encodeURIComponent(name(repo, 'Repository'))}`;
}

function name(value: string, label: string): string {
  const trimmed = (value ?? '').trim();
  if (!NAME.test(trimmed) || trimmed === '.' || trimmed === '..') {
    throw new Error(`${label} must be a single name, for example "acme" or "website".`);
  }
  return trimmed;
}

const NAME = /^[A-Za-z0-9._-]+$/;

function clampLimit(limit: number | undefined): number {
  return Math.min(MAX_PAGE, Math.max(1, Math.floor(limit ?? DEFAULT_PAGE)));
}

async function call<T>({ auth, method, path, query, body }: CallParams): Promise<T> {
  try {
    const response = await httpClient.sendRequest<T>({
      method,
      url: `${apiUrl(auth)}${path}`,
      headers: { Authorization: `token ${auth.token.trim()}`, Accept: 'application/json' },
      queryParams: query,
      body,
    });
    return response.body;
  } catch (error) {
    if (error instanceof HttpError) {
      const status = error.response.status;
      throw new ForgejoApiError({ status, message: describeFailure({ status, body: error.response.body }) });
    }
    throw error;
  }
}

function describeFailure({ status, body }: { status: number; body: unknown }): string {
  const detail = vendorMessage(body)?.replace(/\.+$/, '');
  const hint = STATUS_HINTS[status];
  return [`Forgejo returned an error (${status})`, detail, hint]
    .filter((part): part is string => !isNil(part) && part.length > 0)
    .join('. ');
}

function vendorMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }
  const message = (body as Record<string, unknown>)['message'];
  return typeof message === 'string' && message.length > 0 ? message.slice(0, 500) : undefined;
}

const DEFAULT_PAGE = 30;
const MAX_PAGE = 50;
const STATUS_HINTS: Record<number, string> = {
  401: 'Check the instance URL and the access token in your connection',
  403: 'The access token lacks the permission for this, it needs the issue and repository scopes',
  404: 'Check the owner, the repository and the issue number',
  422: 'Forgejo rejected the input, check the values',
};

export type ForgejoAuthProps = {
  baseUrl: string;
  token: string;
};

export type RepoRef = {
  owner: string;
  repo: string;
};

type CallParams = {
  auth: ForgejoAuthProps;
  method: HttpMethod;
  path: string;
  query?: QueryParams;
  body?: Record<string, unknown>;
};

export type ForgejoIssue = {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  labels: { id: number; name: string }[];
  repository?: { owner: string; name: string; full_name: string };
};
