import type { ApiEnv } from "./env.js";

export interface DatabaseConfig {
  readonly connectionString?: string;
  readonly ssl: boolean;
  readonly poolMax: number;
  readonly connectionTimeoutMilliseconds: number;
  readonly idleTimeoutMilliseconds: number;
}

export function createDatabaseConfig(env: ApiEnv): DatabaseConfig {
  const baseConfig = {
    ssl: env.DATABASE_SSL,
    poolMax: env.DATABASE_POOL_MAX,
    connectionTimeoutMilliseconds: env.DATABASE_CONNECTION_TIMEOUT_MS,
    idleTimeoutMilliseconds: env.DATABASE_IDLE_TIMEOUT_MS,
  };
  if (env.DATABASE_URL) {
    return { ...baseConfig, connectionString: env.DATABASE_URL };
  }
  return baseConfig;
}
