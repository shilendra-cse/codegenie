export type Cycle = { start: Date; end: Date };

function addMonths(anchor: Date, months: number) {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(anchor.getUTCDate(), lastDay),
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds(),
    ),
  );
}

/**
 * The month-long cycle that contains `now`, counted from `anchor` (signup): signed up on the 31st,
 * a cycle ends on the 30th in a 30-day month and the 31st again after it.
 */
export function cycleAt(anchor: Date, now: Date): Cycle {
  if (now < anchor) return { start: anchor, end: addMonths(anchor, 1) };
  let months =
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    anchor.getUTCMonth();
  if (addMonths(anchor, months) > now) months -= 1;
  return {
    start: addMonths(anchor, months),
    end: addMonths(anchor, months + 1),
  };
}
