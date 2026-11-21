import { Property } from '@activepieces/pieces-framework';

export const forgejoProps = {
  owner: () =>
    Property.ShortText({
      displayName: 'Repository Owner',
      description: 'The user or organization the repository belongs to, for example "acme".',
      required: true,
    }),
  repo: () =>
    Property.ShortText({
      displayName: 'Repository',
      description: 'The repository name without the owner, for example "website".',
      required: true,
    }),
  issueNumber: () =>
    Property.Number({
      displayName: 'Issue Number',
      description: 'The number shown after # on the issue.',
      required: true,
    }),
  state: () =>
    Property.StaticDropdown({
      displayName: 'State',
      required: false,
      defaultValue: 'open',
      options: {
        options: [
          { label: 'Open', value: 'open' },
          { label: 'Closed', value: 'closed' },
          { label: 'All', value: 'all' },
        ],
      },
    }),
  limit: () =>
    Property.Number({
      displayName: 'Limit',
      description: 'How many issues to return, at most 50.',
      required: false,
      defaultValue: 30,
    }),
  labels: (required: boolean) =>
    Property.Array({
      displayName: 'Labels',
      description: 'Label names that already exist in the repository or its organization.',
      required,
    }),
};

export function labelNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

export function issueIndex(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('Issue Number must be a whole number of at least 1.');
  }
  return value;
}
