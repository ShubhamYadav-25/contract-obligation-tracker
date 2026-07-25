/**
 * @file Defines reusable test helpers, fixtures, and mock providers.
 */
export interface DatabaseTestContext {
  readonly connectionString: string;
  readonly schemaName?: string;
}

export interface DatabaseTestHelper {
  createContext(): Promise<DatabaseTestContext>;
  reset(context: DatabaseTestContext): Promise<void>;
  dispose(context: DatabaseTestContext): Promise<void>;
}
