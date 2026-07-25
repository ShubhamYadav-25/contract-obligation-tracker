/**
 * @file Defines reusable test helpers, fixtures, and mock providers.
 */
export class FixedClock {
  #now: Date;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {Date | string} now - Input value for now.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(now: Date | string) {
    this.#now = new Date(now);
  }

  /**
   * @description Implements the now method for this service or adapter.
   * @returns {Date} Result of the now operation.
   */
  now(): Date {
    return new Date(this.#now);
  }

  /**
   * @description Implements the set method for this service or adapter.
   * @param {Date | string} now - Input value for now.
   * @returns {void} Result of the set operation.
   */
  set(now: Date | string): void {
    this.#now = new Date(now);
  }

  /**
   * @description Implements the advance by method for this service or adapter.
   * @param {number} milliseconds - Input value for milliseconds.
   * @returns {Date} Result of the advance by operation.
   */
  advanceBy(milliseconds: number): Date {
    this.#now = new Date(this.#now.getTime() + milliseconds);
    return this.now();
  }
}
