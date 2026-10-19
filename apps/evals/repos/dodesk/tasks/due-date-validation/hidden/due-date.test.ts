import { describe, it, expect } from 'vitest';
import { createIssueSchema, updateIssueSchema } from '@/resources/issues/issue.schema';

const create = (dueDate: string) =>
  createIssueSchema.safeParse({ body: { title: 'Fix login', dueDate }, params: { teamId: 'team-1' } }).success;
const update = (dueDate: string) =>
  updateIssueSchema.safeParse({ body: { dueDate }, params: { issueId: 'issue-1' } }).success;

describe('issue due dates', () => {
  it('accepts calendar dates and ISO timestamps', () => {
    expect(create('2026-07-01')).toBe(true);
    expect(create('2026-07-01T10:00:00.000Z')).toBe(true);
    expect(update('2026-12-31')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(create('next week')).toBe(false);
    expect(create('2026-13-01')).toBe(false);
    expect(create('07/01/2026')).toBe(false);
    expect(update('tomorrow')).toBe(false);
  });

  it('still lets an update clear the due date', () => {
    expect(update('')).toBe(true);
  });

  it('keeps the due date optional', () => {
    expect(
      createIssueSchema.safeParse({ body: { title: 'Fix login' }, params: { teamId: 'team-1' } }).success,
    ).toBe(true);
  });
});
