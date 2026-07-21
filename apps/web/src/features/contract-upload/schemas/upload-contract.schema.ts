import { z } from "zod";

const maxContractBytes = 25 * 1024 * 1024;

export const uploadContractSchema = z.object({
  file: z
    .custom<File>((value) => value instanceof File, "Select a PDF file")
    .refine((file) => file.type === "application/pdf", "Only PDF files are accepted")
    .refine((file) => file.size > 0, "The selected file is empty")
    .refine((file) => file.size <= maxContractBytes, "PDF files must be 25 MB or smaller"),
});

export type UploadContractFormValues = z.infer<typeof uploadContractSchema>;
