import { createClient } from "@supabase/supabase-js";
import { Readable } from "node:stream";

import type { StorageConfig } from "../../config/storage.js";
import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import { createSupabaseObjectKey } from "./object-key.js";
import type {
  DownloadObjectStreamInput,
  DownloadObjectStreamResult,
  StorageProvider,
  StoredObjectReference,
  UploadObjectInput,
} from "./storage-provider.js";

const allowedMimeTypes = new Set(["application/pdf"]);

function encodeObjectPath(objectKey: string): string {
  return objectKey.split("/").map(encodeURIComponent).join("/");
}

function parseContentLength(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class SupabaseStorageProvider implements StorageProvider {
  private readonly client;

  constructor(private readonly config: StorageConfig) {
    if (!config.supabaseUrl || !config.serviceRoleKey) {
      throw new ExternalServiceError("Supabase URL and service role key are required for storage");
    }

    this.client = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async upload(input: UploadObjectInput): Promise<StoredObjectReference> {
    const contentType = input.contentType ?? input.mimeType;
    if (!contentType || !allowedMimeTypes.has(contentType)) {
      throw new ExternalServiceError("Unsupported upload MIME type", { mimeType: contentType });
    }
    if (input.body.byteLength > this.config.maxUploadBytes) {
      throw new ExternalServiceError("Upload exceeds configured size limit", {
        sizeBytes: input.body.byteLength,
      });
    }

    const objectKey =
      input.objectKey ??
      createSupabaseObjectKey({
        originalFilename: input.originalFilename ?? "contract.pdf",
        sha256: input.sha256 ?? "",
        ...(input.contractId ? { contractId: input.contractId } : {}),
      });
    const result = await this.client.storage
      .from(this.config.bucket)
      .upload(objectKey, input.body, {
        contentType,
        upsert: false,
      });

    if (result.error) {
      throw new ExternalServiceError("Supabase Storage upload failed", {
        message: result.error.message,
        objectKey,
      });
    }

    return {
      provider: "supabase",
      bucket: this.config.bucket,
      objectKey,
      ...(input.originalFilename ? { originalFilename: input.originalFilename } : {}),
      mimeType: contentType,
      sizeBytes: input.body.byteLength,
      ...(input.sha256 ? { sha256: input.sha256 } : {}),
    };
  }

  async download(objectKey: string): Promise<Buffer> {
    const result = await this.client.storage.from(this.config.bucket).download(objectKey);
    if (result.error) {
      throw new ExternalServiceError("Supabase Storage download failed", {
        message: result.error.message,
        objectKey,
      });
    }

    return Buffer.from(await result.data.arrayBuffer());
  }

  async downloadStream(input: DownloadObjectStreamInput): Promise<DownloadObjectStreamResult> {
    const objectUrl = `${this.config.supabaseUrl}/storage/v1/object/${encodeURIComponent(
      this.config.bucket,
    )}/${encodeObjectPath(input.objectKey)}`;
    const headers = new Headers({
      apikey: this.config.serviceRoleKey ?? "",
      authorization: `Bearer ${this.config.serviceRoleKey ?? ""}`,
    });
    if (input.range) {
      headers.set("range", input.range);
    }

    const result = await fetch(objectUrl, { headers });
    if (result.status !== 200 && result.status !== 206) {
      throw new ExternalServiceError("Supabase Storage stream download failed", {
        status: result.status,
        statusText: result.statusText,
        objectKey: input.objectKey,
      });
    }
    if (!result.body) {
      throw new ExternalServiceError("Supabase Storage stream download returned no body", {
        objectKey: input.objectKey,
      });
    }

    return {
      statusCode: result.status,
      ...(result.headers.get("content-type")
        ? { contentType: result.headers.get("content-type") ?? "" }
        : {}),
      ...(parseContentLength(result.headers.get("content-length")) !== undefined
        ? { contentLength: parseContentLength(result.headers.get("content-length")) ?? 0 }
        : {}),
      ...(result.headers.get("content-range")
        ? { contentRange: result.headers.get("content-range") ?? "" }
        : {}),
      ...(result.headers.get("accept-ranges")
        ? { acceptRanges: result.headers.get("accept-ranges") ?? "" }
        : {}),
      body: Readable.fromWeb(result.body),
    };
  }

  async remove(objectKey: string): Promise<void> {
    const result = await this.client.storage.from(this.config.bucket).remove([objectKey]);
    if (result.error) {
      throw new ExternalServiceError("Supabase Storage cleanup failed", {
        message: result.error.message,
        objectKey,
      });
    }
  }

  delete(objectKey: string): Promise<void> {
    return this.remove(objectKey);
  }

  async createSignedUrl(objectKey: string, expiresInSeconds: number): Promise<string> {
    const result = await this.client.storage
      .from(this.config.bucket)
      .createSignedUrl(objectKey, expiresInSeconds);
    if (result.error) {
      throw new ExternalServiceError("Supabase Storage signed URL creation failed", {
        message: result.error.message,
        objectKey,
      });
    }
    return result.data.signedUrl;
  }

  createSignedDownloadUrl(objectKey: string, expiresInSeconds: number): Promise<string> {
    return this.createSignedUrl(objectKey, expiresInSeconds);
  }
}
