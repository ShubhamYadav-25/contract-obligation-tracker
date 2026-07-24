import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";

import { routePaths } from "@/app/route-paths.js";
import { InlineError } from "@/components/feedback/inline-error.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { useUploadContract } from "@/features/contract-upload/hooks/use-upload-contract.js";
import type {
  ContractProcessingStatus,
  ContractSummary,
} from "@/features/contracts/types/contracts.js";
import {
  DataTable,
  EmptyState,
  FileDropzone,
  Modal,
  MutationSpinner,
  StatusBadge,
  TableHead,
  formatStatusLabel,
  statusTone,
} from "../components.js";

function UploadProcessingNotice({ fileName }: { readonly fileName: string | undefined }) {
  return (
    <div
      aria-live="polite"
      className="rounded-lg border border-teal-200 bg-gradient-to-br from-white to-teal-50 p-4 text-sm text-teal-950 shadow-card"
    >
      <div className="flex items-center gap-4">
        <span className="relative grid size-14 shrink-0 place-items-center rounded-full bg-white text-teal-700 shadow-card">
          <UploadCloud aria-hidden className="size-6" />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-teal-100 border-t-teal-600 motion-safe:animate-spin"
          />
        </span>
        <div className="min-w-0">
          <p className="font-bold">File received by the upload flow</p>
          <p className="mt-1 leading-5 text-teal-800">
            {fileName ?? "The contract PDF"} is being sent to the backend. It will be validated,
            stored, then queued for parsing and obligation extraction.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-xs font-semibold text-teal-900 sm:grid-cols-3">
        <span className="rounded-md border border-teal-100 bg-white px-3 py-2">Uploading PDF</span>
        <span className="rounded-md border border-teal-100 bg-white px-3 py-2">
          Backend receipt
        </span>
        <span className="rounded-md border border-teal-100 bg-white px-3 py-2">
          Processing queue
        </span>
      </div>
    </div>
  );
}

export type UploadRecord = {
  readonly contractId: string;
  readonly documentId?: string;
  readonly processingRunId?: string;
  readonly displayName: string;
  readonly externalRef?: string;
  readonly uploadedAt: string;
  readonly status: ContractProcessingStatus;
  readonly uploadStatus?: "stored" | "duplicate";
  readonly duplicate: boolean;
  readonly isDuplicate?: boolean;
  readonly originalFilename?: string;
  readonly mimeType?: "application/pdf";
  readonly sizeBytes?: number;
  readonly checksumSha256?: string;
  readonly textPageCount?: number;
  readonly textSegmentCount?: number;
  readonly ocrPageCount?: number;
};

export function contractToUploadRecord(contract: ContractSummary): UploadRecord {
  return {
    contractId: contract.id,
    ...(contract.currentDocument ? { documentId: contract.currentDocument.id } : {}),
    ...(contract.processing ? { processingRunId: contract.processing.id } : {}),
    displayName: contract.displayName,
    ...(contract.externalRef ? { externalRef: contract.externalRef } : {}),
    uploadedAt: contract.currentDocument?.uploadedAt ?? contract.createdAt,
    status: contract.processing?.status ?? "RECEIVED",
    ...(contract.currentDocument?.uploadStatus === "STORED"
      ? { uploadStatus: "stored" as const }
      : {}),
    duplicate: false,
    isDuplicate: false,
    ...(contract.currentDocument
      ? {
          originalFilename: contract.currentDocument.originalFilename,
          mimeType: contract.currentDocument.mimeType,
          sizeBytes: contract.currentDocument.sizeBytes,
          checksumSha256: contract.currentDocument.checksumSha256,
        }
      : {}),
    textPageCount: contract.text.pageCount,
    textSegmentCount: contract.text.segmentCount,
    ocrPageCount: contract.text.ocrPageCount,
  };
}

export function UploadContractDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const upload = useUploadContract();
  const resetUpload = upload.reset;
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [clientError, setClientError] = useState("");
  const [uploaded, setUploaded] = useState<UploadRecord | null>(null);

  useEffect(() => {
    if (!open) {
      setClientError("");
      setFile(null);
      setDisplayName("");
      setExternalRef("");
      setUploaded(null);
      resetUpload();
    }
  }, [open, resetUpload]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError("");
    setUploaded(null);
    if (!file) {
      setClientError("Select a PDF file before uploading.");
      return;
    }
    if (file.type !== "application/pdf") {
      setClientError("Only PDF files are accepted.");
      return;
    }
    if (file.size === 0) {
      setClientError("The selected PDF is empty.");
      return;
    }

    upload.mutate(
      {
        file,
        ...(displayName.trim() ? { title: displayName.trim() } : {}),
        ...(externalRef.trim() ? { externalRef: externalRef.trim() } : {}),
      },
      {
        onSuccess: (result) => {
          const record: UploadRecord = {
            contractId: result.contractId,
            documentId: result.documentId,
            processingRunId: result.processingRunId,
            displayName: displayName.trim() || result.originalFilename,
            ...(externalRef.trim() ? { externalRef: externalRef.trim() } : {}),
            uploadedAt: result.createdAt,
            status: result.status,
            uploadStatus: result.uploadStatus,
            duplicate: result.duplicate,
            isDuplicate: result.isDuplicate,
            originalFilename: result.originalFilename,
            mimeType: result.mimeType,
            sizeBytes: result.sizeBytes,
            checksumSha256: result.checksumSha256,
          };
          setUploaded(record);
        },
      },
    );
  }

  return (
    <Modal onClose={onClose} open={open} title="Upload Contract">
      {uploaded ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <h2 className="font-semibold">Contract stored.</h2>
            <p className="mt-1">
              Backend status is {formatStatusLabel(uploaded.status)} and processing will continue in
              the worker.
              {uploaded.isDuplicate ? " This upload matched an existing document." : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-teal-800 focus-visible:shadow-focus"
              to={routePaths.contractDetail(uploaded.contractId)}
            >
              Open Contract
            </Link>
            <Button
              onClick={() => {
                setUploaded(null);
                setFile(null);
                setDisplayName("");
                setExternalRef("");
              }}
              type="button"
              variant="secondary"
            >
              Upload Another
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <FileDropzone disabled={upload.isPending} file={file} onFile={setFile} />
          <label className="block text-sm font-medium" htmlFor="display-name">
            Display name
            <Input
              className="mt-2 w-full"
              disabled={upload.isPending}
              id="display-name"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Optional"
              value={displayName}
            />
          </label>
          <label className="block text-sm font-medium" htmlFor="external-ref">
            External reference
            <Input
              className="mt-2 w-full"
              disabled={upload.isPending}
              id="external-ref"
              onChange={(event) => setExternalRef(event.target.value)}
              placeholder="Optional"
              value={externalRef}
            />
          </label>
          <div className="rounded-md bg-surface p-3 text-sm text-muted">
            The backend validates, deduplicates, stores the original PDF, then queues parsing,
            selective OCR, and text segmentation.
          </div>
          {upload.isPending ? <UploadProcessingNotice fileName={file?.name} /> : null}
          {clientError ? <p className="text-sm font-medium text-red-700">{clientError}</p> : null}
          {upload.error && !upload.isPending ? <InlineError error={upload.error} /> : null}
          <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
            <Button disabled={upload.isPending} onClick={onClose} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={upload.isPending} type="submit">
              {upload.isPending ? <MutationSpinner /> : null}
              {upload.isPending ? "Uploading" : "Upload Contract"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function RecentContractsTable({ uploads }: { readonly uploads: readonly UploadRecord[] }) {
  if (uploads.length === 0) {
    return (
      <EmptyState title="No contracts uploaded yet.">
        Upload a PDF to start backend storage, parsing, OCR fallback, and text segmentation.
      </EmptyState>
    );
  }

  return (
    <>
      <DataTable>
        <TableHead columns={["Contract", "Processing", "Text", "OCR", "Uploaded At", "Actions"]} />
        <tbody className="divide-y divide-border">
          {uploads.map((record) => (
            <tr className="hover:bg-slate-50" key={record.contractId}>
              <td className="px-4 py-3">
                <Link
                  className="font-semibold text-teal-900 hover:underline"
                  to={routePaths.contractDetail(record.contractId)}
                >
                  {record.displayName}
                </Link>
                {record.externalRef ? (
                  <p className="mt-1 text-xs text-muted">{record.externalRef}</p>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <StatusBadge
                  label={formatStatusLabel(record.status)}
                  tone={statusTone(record.status)}
                />
                {record.uploadStatus === "duplicate" ? (
                  <p className="mt-1 text-xs text-muted">Duplicate document</p>
                ) : null}
              </td>
              <td className="px-4 py-3">
                {record.textPageCount ?? 0} pages / {record.textSegmentCount ?? 0} segments
              </td>
              <td className="px-4 py-3">{record.ocrPageCount ?? 0} pages</td>
              <td className="px-4 py-3">{new Date(record.uploadedAt).toLocaleString()}</td>
              <td className="px-4 py-3">
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-white px-3 text-sm font-medium hover:bg-surface focus-visible:shadow-focus"
                  to={routePaths.contractDetail(record.contractId)}
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </>
  );
}
