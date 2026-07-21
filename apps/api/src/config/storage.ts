import type { ApiEnv } from "./env.js";

export interface StorageConfig {
  readonly provider: ApiEnv["STORAGE_PROVIDER"];
  readonly bucket: string;
  readonly maxUploadBytes: number;
  readonly supabaseUrl?: string;
  readonly serviceRoleKey?: string;
}

export function createStorageConfig(env: ApiEnv): StorageConfig {
  const config: StorageConfig = {
    provider: env.STORAGE_PROVIDER,
    bucket: env.SUPABASE_STORAGE_BUCKET,
    maxUploadBytes: env.CONTRACT_MAX_FILE_SIZE_MB * 1024 * 1024,
  };
  return {
    ...config,
    ...(env.SUPABASE_URL ? { supabaseUrl: env.SUPABASE_URL } : {}),
    ...(env.SUPABASE_SERVICE_ROLE_KEY ? { serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY } : {}),
  };
}
