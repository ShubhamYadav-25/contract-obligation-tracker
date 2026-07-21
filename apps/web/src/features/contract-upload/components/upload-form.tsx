import { zodResolver } from "@hookform/resolvers/zod";
import { Upload } from "lucide-react";
import { useForm } from "react-hook-form";

import { InlineError } from "../../../components/feedback/inline-error.js";
import { Button } from "../../../components/ui/button.js";
import { Input } from "../../../components/ui/input.js";
import { ApiError, isConflictError } from "../../../services/api-error.js";
import { uploadContractSchema } from "../schemas/upload-contract.schema.js";
import type { UploadContractFormValues } from "../schemas/upload-contract.schema.js";

export function UploadForm({
  error,
  isSubmitting,
  onSubmit,
}: {
  readonly error: unknown;
  readonly isSubmitting: boolean;
  readonly onSubmit: (file: File) => void;
}) {
  const form = useForm<UploadContractFormValues>({
    resolver: zodResolver(uploadContractSchema),
  });

  const submit = form.handleSubmit((values) => onSubmit(values.file));
  const fileError = form.formState.errors.file?.message;
  const conflictMessage =
    isConflictError(error) && error instanceof ApiError
      ? "This PDF appears to have already been uploaded."
      : undefined;

  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)}>
      <div>
        <label className="block text-sm font-medium" htmlFor="contract-file">
          Contract PDF
        </label>
        <Input
          accept="application/pdf"
          className="mt-2 w-full file:mr-4 file:rounded file:border-0 file:bg-surface file:px-3 file:py-1 file:text-sm file:font-medium"
          id="contract-file"
          type="file"
          {...form.register("file", {
            setValueAs: (value: FileList) => value.item(0),
          })}
        />
        <p className="mt-2 text-sm text-muted">Accepted format: PDF, up to 25 MB.</p>
        {fileError ? <p className="mt-2 text-sm text-red-700">{fileError}</p> : null}
      </div>
      {conflictMessage ? <InlineError error={new Error(conflictMessage)} /> : null}
      {error && !conflictMessage ? <InlineError error={error} /> : null}
      <Button disabled={isSubmitting} type="submit">
        <Upload aria-hidden size={16} />
        {isSubmitting ? "Uploading" : "Upload contract"}
      </Button>
    </form>
  );
}
