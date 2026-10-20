export type SerialQueue = {
  add(task: () => Promise<void>): void;
  /** Waits for every task so far; rejects with the first task that failed. */
  drain(): Promise<void>;
};

export function createSerialQueue(): SerialQueue {
  let tail = Promise.resolve();
  let failed = false;
  let failure: unknown;

  return {
    add(task) {
      tail = tail.then(task).catch((error: unknown) => {
        if (failed) return;
        failed = true;
        failure = error;
      });
    },
    async drain() {
      await tail;
      if (failed) throw failure;
    },
  };
}
