export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export interface QueueItem<T> {
  task: () => Promise<T>;
  tokens: number;
  priority: number;
  enqueuedAt: number;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export class PriorityRateLimiter {
  private queue: QueueItem<unknown>[] = [];
  private requestTimestamps: number[] = [];
  private tokenUsage: Array<{ timestamp: number; tokens: number }> = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly config: RateLimitConfig) {}

  enqueue<T>(task: () => Promise<T>, tokens: number, priority = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: QueueItem<T> = {
        task,
        tokens,
        priority,
        enqueuedAt: Date.now(),
        resolve,
        reject
      };
      this.insertQueueItem(item as QueueItem<unknown>);
      this.processQueue();
    });
  }

  private insertQueueItem(item: QueueItem<unknown>): void {
    let index = this.queue.findIndex(
      (existing) => existing.priority < item.priority
    );
    if (index === -1) {
      index = this.queue.length;
    }
    this.queue.splice(index, 0, item);
  }

  private processQueue(): void {
    this.clearExpiredUsage();

    while (this.queue.length > 0) {
      const next = this.queue[0];
      if (!this.canRun(next.tokens)) {
        this.scheduleNextAttempt();
        return;
      }

      this.queue.shift();
      this.markUsage(next.tokens);
      next.task()
        .then((result) => next.resolve(result))
        .catch((error) => next.reject(error))
        .finally(() => {
          this.processQueue();
        });
    }

    this.clearTimer();
  }

  private canRun(tokens: number): boolean {
    const requestsAllowed = this.config.requestsPerMinute <= 0
      ? true
      : this.requestTimestamps.length < this.config.requestsPerMinute;
    const tokensAllowed = this.config.tokensPerMinute <= 0
      ? true
      : this.totalTokens() + tokens <= this.config.tokensPerMinute;
    return requestsAllowed && tokensAllowed;
  }

  private markUsage(tokens: number): void {
    const now = Date.now();
    this.requestTimestamps.push(now);
    if (tokens > 0) {
      this.tokenUsage.push({ timestamp: now, tokens });
    }
  }

  private totalTokens(): number {
    return this.tokenUsage.reduce((sum, entry) => sum + entry.tokens, 0);
  }

  private clearExpiredUsage(): void {
    const cutoff = Date.now() - 60_000;
    this.requestTimestamps = this.requestTimestamps.filter((time) => time > cutoff);
    this.tokenUsage = this.tokenUsage.filter((entry) => entry.timestamp > cutoff);
  }

  private scheduleNextAttempt(): void {
    if (this.timer) {
      return;
    }

    const now = Date.now();
    const nextRequestTime = this.requestTimestamps.length > 0
      ? Math.min(...this.requestTimestamps) + 60_000
      : now;
    const nextTokenTime = this.tokenUsage.length > 0
      ? Math.min(...this.tokenUsage.map((entry) => entry.timestamp)) + 60_000
      : now;

    const nextTime = Math.max(now, Math.min(nextRequestTime, nextTokenTime));
    const delay = Math.max(0, nextTime - now);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.processQueue();
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
