import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/db/prisma', () => ({
  default: { issue: { findFirst: vi.fn() } },
}));

import prisma from '@/shared/db/prisma';
import { issueQuery } from '@/resources/issues/issue.query';

const findFirst = prisma.issue.findFirst as unknown as ReturnType<typeof vi.fn>;

describe('issue numbers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gives a team its first issue number 1', async () => {
    findFirst.mockResolvedValue(null);
    expect(await issueQuery.getNextNumber('team-1')).toBe(1);
  });

  it('numbers a new issue one after the team\'s highest number', async () => {
    findFirst.mockResolvedValue({ number: 4 });
    expect(await issueQuery.getNextNumber('team-1')).toBe(5);
  });
});
