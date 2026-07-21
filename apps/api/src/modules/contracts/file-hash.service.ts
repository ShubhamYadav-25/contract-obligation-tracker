import { createHash } from "node:crypto";

export class FileHashService {
  sha256(input: Buffer): string {
    return createHash("sha256").update(input).digest("hex");
  }
}
