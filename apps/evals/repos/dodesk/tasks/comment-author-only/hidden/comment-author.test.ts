import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorCodes } from '@/shared/errors/errorCodes';

vi.mock('@/resources/comments/comment.query', () => ({
  commentQuery: {
    findById: vi.fn(),
    findByIssue: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { commentService } from '@/resources/comments/comment.service';
import { commentQuery } from '@/resources/comments/comment.query';

const query = commentQuery as unknown as Record<string, ReturnType<typeof vi.fn>>;
const comment = { id: 'comment-1', userId: 'author', content: 'Hi', issueId: 'issue-1' };

describe('only the author changes a comment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lets the author edit', async () => {
    query.findById!.mockResolvedValue(comment);
    query.update!.mockResolvedValue({ ...comment, content: 'Edited' });

    const result = await (commentService.update as Function)('comment-1', 'author', 'Edited');

    expect(result).toMatchObject({ content: 'Edited' });
    expect(query.update).toHaveBeenCalledWith('comment-1', 'Edited');
  });

  it('forbids anyone else from editing', async () => {
    query.findById!.mockResolvedValue(comment);

    await expect(
      (commentService.update as Function)('comment-1', 'someone-else', 'Hacked'),
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN, statusCode: 403 });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('reports a missing comment on edit', async () => {
    query.findById!.mockResolvedValue(null);

    await expect(
      (commentService.update as Function)('missing', 'author', 'x'),
    ).rejects.toMatchObject({ code: ErrorCodes.COMMENT_NOT_FOUND, statusCode: 404 });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('lets the author delete', async () => {
    query.findById!.mockResolvedValue(comment);
    query.delete!.mockResolvedValue(comment);

    await (commentService.delete as Function)('comment-1', 'author');

    expect(query.delete).toHaveBeenCalledWith('comment-1');
  });

  it('forbids anyone else from deleting', async () => {
    query.findById!.mockResolvedValue(comment);

    await expect(
      (commentService.delete as Function)('comment-1', 'someone-else'),
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN, statusCode: 403 });
    expect(query.delete).not.toHaveBeenCalled();
  });

  it('reports a missing comment on delete', async () => {
    query.findById!.mockResolvedValue(null);

    await expect(
      (commentService.delete as Function)('missing', 'author'),
    ).rejects.toMatchObject({ code: ErrorCodes.COMMENT_NOT_FOUND, statusCode: 404 });
  });
});
