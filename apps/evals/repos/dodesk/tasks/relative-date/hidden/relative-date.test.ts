import { describe, it, expect } from 'vitest';
import * as utils from '@/lib/utils';

const formatRelativeDate = (utils as unknown as {
  formatRelativeDate: (date: Date | string, now?: Date) => string;
}).formatRelativeDate;

const now = new Date('2026-06-15T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatRelativeDate', () => {
  it('says just now for the last minute', () => {
    expect(formatRelativeDate(ago(0), now)).toBe('just now');
    expect(formatRelativeDate(ago(59_000), now)).toBe('just now');
  });

  it('counts minutes and hours, rounding down', () => {
    expect(formatRelativeDate(ago(90_000), now)).toBe('1 minute ago');
    expect(formatRelativeDate(ago(45 * MIN), now)).toBe('45 minutes ago');
    expect(formatRelativeDate(ago(HOUR), now)).toBe('1 hour ago');
    expect(formatRelativeDate(ago(5 * HOUR + 59 * MIN), now)).toBe('5 hours ago');
  });

  it('says yesterday, then counts days for a week', () => {
    expect(formatRelativeDate(ago(30 * HOUR), now)).toBe('yesterday');
    expect(formatRelativeDate(ago(3 * DAY), now)).toBe('3 days ago');
    expect(formatRelativeDate(ago(6 * DAY + 23 * HOUR), now)).toBe('6 days ago');
  });

  it('shows the date after a week, with the year only when it differs', () => {
    expect(formatRelativeDate(ago(10 * DAY), now)).toBe('Jun 5');
    expect(formatRelativeDate(new Date('2025-12-28T12:00:00.000Z'), now)).toBe('Dec 28, 2025');
  });

  it('accepts ISO strings', () => {
    expect(formatRelativeDate('2026-06-15T11:00:00.000Z', now)).toBe('1 hour ago');
  });
});
