import { createLogUpdate } from "log-update";
import { isInteractive } from "./style.js";

type Stream = NodeJS.WritableStream & {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
};

const REDRAW_MS = 120;

/**
 * Lines at the bottom of the terminal that are redrawn in place (spinners, running
 * tasks), with permanent lines printed above them. Outside a terminal nothing is
 * redrawn: only the permanent lines are written.
 */
export class LiveArea {
  readonly interactive: boolean;
  private readonly log: ReturnType<typeof createLogUpdate> | null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly stream: Stream,
    private readonly render: () => string[],
  ) {
    this.interactive = isInteractive(stream);
    this.log = this.interactive ? createLogUpdate(stream) : null;
  }

  start() {
    if (!this.log || this.timer) return;
    this.timer = setInterval(() => this.redraw(), REDRAW_MS);
    this.timer.unref();
    this.redraw();
  }

  /** Permanent lines, printed above the live lines. */
  print(...lines: string[]) {
    if (!lines.length) return;
    if (this.log) {
      this.log.clear();
      this.stream.write(`${lines.join("\n")}\n`);
      this.redraw();
    } else {
      this.stream.write(`${lines.join("\n")}\n`);
    }
  }

  redraw() {
    if (!this.log) return;
    const lines = this.render();
    if (lines.length) this.log(lines.join("\n"));
    else this.log.clear();
  }

  /** Removes the live lines and stops redrawing. */
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.log?.clear();
  }
}
