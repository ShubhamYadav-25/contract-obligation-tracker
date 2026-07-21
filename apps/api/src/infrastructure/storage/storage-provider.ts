export interface StoredObjectReference {
  readonly provider: string;
  readonly objectKey: string;
  readonly bucket: string;
  readonly originalFilename?: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
  readonly sha256?: string;
}

export interface UploadObjectInput {
  readonly objectKey?: string;
  readonly originalFilename?: string;
  readonly mimeType?: string;
  readonly contentType?: string;
  readonly body: Buffer;
  readonly sha256?: string;
  readonly contractId?: string;
}

export interface StorageProvider {
  upload(input: UploadObjectInput): Promise<StoredObjectReference>;
  download(objectKey: string): Promise<Buffer>;
  remove(objectKey: string): Promise<void>;
  delete(objectKey: string): Promise<void>;
  createSignedUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
  createSignedDownloadUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
}
