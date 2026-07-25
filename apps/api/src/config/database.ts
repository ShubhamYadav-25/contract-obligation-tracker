/**
 * @file Defines backend runtime configuration and environment helpers.
 */
import type { ApiEnv } from "./env.js";

export interface DatabaseConfig {
  readonly connectionString?: string;
  readonly ssl: boolean;
  readonly poolMax: number;
  readonly connectionTimeoutMilliseconds: number;
  readonly idleTimeoutMilliseconds: number;
}

/**
 * @description Executes the create database config operation used by the application workflow.
 * @param {ApiEnv} env - Input value for env.
 * @returns {DatabaseConfig} Result of the create database config operation.
 */
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
