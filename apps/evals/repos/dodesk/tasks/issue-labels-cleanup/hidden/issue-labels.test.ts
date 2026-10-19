import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildIssueWithMinimalRelations, buildIssueWithRelations } from '../helpers/fixtures';

vi.mock('@/resources/issues/issue.query', () => ({
  issueQuery: {
    findById: vi.fn(),
    create: vi.fn(),
    getNextNumber: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findByWorkspace: vi.fn(),
    findByTeam: vi.fn(),
  },
}));

vi.mock('@/resources/teams/team.query', () => ({
  teamQuery: { findById: vi.fn() },
}));

import { issueService } from '@/resources/issues/issue.service';
import { issueQuery } from '@/resources/issues/issue.query';
import { teamQuery } from '@/resources/teams/team.query';

const messy = [' Bug', 'bug', '', 'ui ', 'UI', '   ', 'Backend'];
const clean = ['Bug', 'ui', 'Backend'];

describe('issue labels are cleaned before saving', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(teamQuery.findById).mockResolvedValue({ id: 'team-1', workspaceId: 'ws-1' } as never);
    vi.mocked(issueQuery.getNextNumber).mockResolvedValue(1);
    vi.mocked(issueQuery.create).mockResolvedValue(buildIssueWithRelations());
    vi.mocked(issueQuery.update).mockResolvedValue(buildIssueWithMinimalRelations());
  });

  it('on create', async () => {
    await issueService.create({ title: 'x', teamId: 'team-1', creatorId: 'user-1', labels: messy });
    expect(vi.mocked(issueQuery.create).mock.calls[0]![0]).toMatchObject({ labels: clean });
  });

  it('on update', async () => {
    await issueService.update('issue-1', { labels: messy });
    expect(vi.mocked(issueQuery.update).mock.calls[0]![1]).toMatchObject({ labels: clean });
  });

  it('still saves an empty list and leaves labels alone when not given', async () => {
    await issueService.create({ title: 'x', teamId: 'team-1', creatorId: 'user-1' });
    expect(vi.mocked(issueQuery.create).mock.calls[0]![0]).toMatchObject({ labels: [] });

    await issueService.update('issue-1', { title: 'Renamed' });
    expect(vi.mocked(issueQuery.update).mock.calls[0]![1]).not.toHaveProperty('labels');
  });
});
