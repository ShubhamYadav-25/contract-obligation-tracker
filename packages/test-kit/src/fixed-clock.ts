export class FixedClock {
  #now: Date;

  constructor(now: Date | string) {
    this.#now = new Date(now);
  }

  now(): Date {
    return new Date(this.#now);
  }

  set(now: Date | string): void {
    this.#now = new Date(now);
  }

  advanceBy(milliseconds: number): Date {
    this.#now = new Date(this.#now.getTime() + milliseconds);
    return this.now();
  }
}
