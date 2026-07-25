/**
 * @file Defines shared API errors, middleware, validation, or boundary types.
 */
export interface PageRequest {
  readonly limit: number;
  readonly cursor?: string;
}

export interface PageResult<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}
