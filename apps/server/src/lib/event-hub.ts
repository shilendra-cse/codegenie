export type MessageSubscriber = {
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(
    event: "message",
    listener: (channel: string, message: string) => void,
  ): unknown;
};

export type EventViewer = (message: string) => void;

/** Shares one Redis subscriber among everyone watching a run's or a setup's channel. */
export class EventHub {
  private readonly viewers = new Map<string, Set<EventViewer>>();
  private readonly lastRedisCall = new Map<string, Promise<unknown>>();

  constructor(private readonly subscriber: MessageSubscriber) {
    subscriber.on("message", (channel, message) => {
      this.viewers.get(channel)?.forEach((viewer) => viewer(message));
    });
  }

  async listen(channel: string, viewer: EventViewer) {
    this.addViewer(channel, viewer);
    try {
      await this.lastRedisCall.get(channel);
    } catch (error) {
      await this.removeViewer(channel, viewer);
      throw error;
    }
    return () => this.removeViewer(channel, viewer);
  }

  private addViewer(channel: string, viewer: EventViewer) {
    const watching = this.viewers.get(channel);
    if (watching) {
      watching.add(viewer);
      return;
    }
    this.viewers.set(channel, new Set([viewer]));
    void this.afterLastRedisCall(channel, () =>
      this.subscriber.subscribe(channel),
    );
  }

  private async removeViewer(channel: string, viewer: EventViewer) {
    const watching = this.viewers.get(channel);
    if (!watching?.delete(viewer) || watching.size > 0) return;
    this.viewers.delete(channel);
    await this.afterLastRedisCall(channel, () =>
      this.subscriber.unsubscribe(channel),
    );
  }

  // One channel's Redis calls run one after another, so an unsubscribe can't land after a newer subscribe.
  private afterLastRedisCall(channel: string, call: () => Promise<unknown>) {
    const previous = this.lastRedisCall.get(channel) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(call);
    this.lastRedisCall.set(channel, next);
    const forget = () => {
      if (this.lastRedisCall.get(channel) === next) {
        this.lastRedisCall.delete(channel);
      }
    };
    next.then(forget, forget);
    return next;
  }
}
