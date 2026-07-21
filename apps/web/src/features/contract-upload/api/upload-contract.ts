import { uploadMultipart } from "../../../services/api-client.js";

export interface UploadContractResult {
  readonly contractId: string;
}

export function uploadContract(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return uploadMultipart<UploadContractResult>("/api/contracts", formData);
}
