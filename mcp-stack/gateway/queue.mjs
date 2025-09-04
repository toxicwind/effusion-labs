// Simple FIFO work queue with max concurrency and basic metrics.
import { log } from "./logger.mjs";

export class WorkQueue {
  constructor({ maxConcurrency = 20, limit = 10000 } = {}) {
    this.max = maxConcurrency;
    this.limit = limit;
    this.inflight = 0;
    this.q = [];
    this.waitTimes = []; // sliding window ms
  }

  size() { return this.q.length + this.inflight; }

  avgWaitMs() {
    if (this.waitTimes.length === 0) return 0;
    const sum = this.waitTimes.reduce((a,b)=>a+b,0);
    return Math.round(sum / this.waitTimes.length);
  }

  snapshot() {
    return { currentLength: this.q.length, avgWaitMs: this.avgWaitMs(), maxConcurrency: this.max };
  }

  offer(fn) {
    // Always accept to guarantee queue-first; never hard-fail.
    const enqueuedAt = Date.now();
    return new Promise((resolve) => {
      const task = async () => {
        const wait = Date.now() - enqueuedAt;
        this.waitTimes.push(wait);
        if (this.waitTimes.length > 2000) this.waitTimes.shift();
        try { resolve(await fn()); }
        catch (e) { resolve({ error: String(e?.message || e) }); }
        finally { this.inflight--; this._drain(); }
      };
      this.q.push(task);
      this._drain();
    });
  }

  _drain() {
    while (this.inflight < this.max && this.q.length > 0) {
      const task = this.q.shift();
      this.inflight++;
      setImmediate(task);
    }
  }
}

