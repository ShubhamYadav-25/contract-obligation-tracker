import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { routePaths } from "../../app/route-paths.js";
import { InlineError } from "../../components/feedback/inline-error.js";
import { ContentContainer } from "../../components/layout/content-container.js";
import { PageHeader } from "../../components/layout/page-header.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { useUploadContract } from "../contract-upload/hooks/use-upload-contract.js";
import { useContract } from "../contracts/hooks/use-contract.js";
import { useContractTextPages } from "../contracts/hooks/use-contract-text-pages.js";
import { useContracts } from "../contracts/hooks/use-contracts.js";
import { useProcessingStatus } from "../contracts/hooks/use-processing-status.js";
import type {
  ContractProcessingStatus,
  ContractSummary,
  DocumentTextPage,
} from "../contracts/types/contracts.js";
import { useObligations } from "../obligations/hooks/use-obligations.js";
import {
  AuditTimeline,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  FileDropzone,
  FilterBar,
  FilterSelect,
  KpiCard,
  LoadingSkeleton,
  Modal,
  MutationSpinner,
  Pagination,
  PdfViewer,
  ProcessingTimeline,
  SearchInput,
  SectionCard,
  SourceEvidencePanel,
  StatusBadge,
  TableHead,
  TableSkeleton,
  Toast,
  formatStatusLabel,
  statusTone,
} from "./components.js";

type UploadRecord = {
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

const uploadStorageKey = "contract-obligation-tracker.uploads";

function normalizeUploadRecord(record: UploadRecord): UploadRecord {
  return {
    ...record,
    uploadStatus: record.uploadStatus ?? (record.duplicate ? "duplicate" : "stored"),
    isDuplicate: record.isDuplicate ?? record.duplicate,
    originalFilename: record.originalFilename ?? record.displayName,
  };
}

function readUploads(): readonly UploadRecord[] {
  try {
    const raw = window.localStorage.getItem(uploadStorageKey);
    return raw ? (JSON.parse(raw) as readonly UploadRecord[]).map(normalizeUploadRecord) : [];
  } catch {
    return [];
  }
}

function writeUploads(records: readonly UploadRecord[]) {
  window.localStorage.setItem(uploadStorageKey, JSON.stringify(records.slice(0, 10)));
}

function contractToUploadRecord(contract: ContractSummary): UploadRecord {
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

function useLocalUploads() {
  const [uploads, setUploads] = useState<readonly UploadRecord[]>(() =>
    typeof window === "undefined" ? [] : readUploads(),
  );

  function addUpload(record: UploadRecord) {
    setUploads((current) => {
      const next = [record, ...current.filter((item) => item.contractId !== record.contractId)];
      writeUploads(next);
      return next;
    });
  }

  return { uploads, addUpload };
}

function UploadContractDialog({
  onUploaded,
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onUploaded: (record: UploadRecord) => void;
}) {
  const upload = useUploadContract();
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [clientError, setClientError] = useState("");
  const [uploaded, setUploaded] = useState<UploadRecord | null>(null);

  useEffect(() => {
    if (!open) {
      setClientError("");
    }
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError("");
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
          onUploaded(record);
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
          <FileDropzone file={file} onFile={setFile} />
          <label className="block text-sm font-medium" htmlFor="display-name">
            Display name
            <Input
              className="mt-2 w-full"
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
          {clientError ? <p className="text-sm font-medium text-red-700">{clientError}</p> : null}
          {upload.error ? <InlineError error={upload.error} /> : null}
          <div className="flex justify-end gap-2">
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

function RecentContractsTable({ uploads }: { readonly uploads: readonly UploadRecord[] }) {
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
      <Pagination label={`Showing ${uploads.length} contract${uploads.length === 1 ? "" : "s"}`} />
    </>
  );
}

export function DashboardPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const { addUpload, uploads } = useLocalUploads();
  const contracts = useContracts();
  const backendUploads = useMemo(
    () => (contracts.data ?? []).map(contractToUploadRecord),
    [contracts.data],
  );
  const visibleUploads = backendUploads.length > 0 || !contracts.isError ? backendUploads : uploads;
  const storedCount = visibleUploads.filter((item) =>
    ["STORED", "QUEUED", "PROCESSING", "PARSING", "OCR_PROCESSING", "TEXT_SEGMENTED"].includes(
      item.status,
    ),
  ).length;
  const segmentedCount = visibleUploads.filter((item) => item.status === "TEXT_SEGMENTED").length;

  return (
    <ContentContainer>
      <PageHeader
        actions={
          <Button onClick={() => setUploadOpen(true)} type="button">
            Upload Contract
          </Button>
        }
        description="Monitor contracts requiring review and obligations approaching their deadlines."
        title="Contract Overview"
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          helper={contracts.isError ? "Local fallback" : "Backend list"}
          label="Total Contracts"
          tone="info"
          value={contracts.isLoading ? "Loading" : String(visibleUploads.length)}
        />
        <KpiCard
          helper="Stored by backend"
          label="Stored Contracts"
          tone="success"
          value={String(storedCount)}
        />
        <KpiCard
          helper="Text pages persisted"
          label="Text Segmented"
          tone="success"
          value={String(segmentedCount)}
        />
        <KpiCard helper="Structured extraction not built" label="Obligations" value="Unavailable" />
      </div>
      {contracts.isError ? (
        <div className="mb-5">
          <InlineError error={contracts.error} />
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Attention Required">
          {visibleUploads.length === 0 ? (
            <EmptyState title="No contracts require attention.">
              Upload a contract to start backend processing.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {visibleUploads.slice(0, 5).map((record) => (
                <div
                  className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  key={record.contractId}
                >
                  <div>
                    <StatusBadge
                      label={formatStatusLabel(record.status)}
                      tone={statusTone(record.status)}
                    />
                    <h3 className="mt-2 text-sm font-semibold">{record.displayName}</h3>
                    <p className="mt-1 text-sm text-muted">
                      Open the workspace to view processing status and parsed text pages.
                    </p>
                  </div>
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-white px-3 text-sm font-medium hover:bg-surface focus-visible:shadow-focus"
                    to={routePaths.contractDetail(record.contractId)}
                  >
                    Open Contract
                  </Link>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Next Deadlines">
          <EmptyState title="No obligation deadlines available.">
            The global obligation endpoint currently returns a backend implementation error, so no
            deadline rows are fabricated.
          </EmptyState>
        </SectionCard>
        <SectionCard className="xl:col-span-2" title="Recent Contracts">
          {contracts.isLoading ? (
            <TableSkeleton />
          ) : (
            <RecentContractsTable uploads={visibleUploads.slice(0, 5)} />
          )}
        </SectionCard>
      </div>
      <UploadContractDialog
        onClose={() => setUploadOpen(false)}
        onUploaded={addUpload}
        open={uploadOpen}
      />
    </ContentContainer>
  );
}

export function ContractsPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const { addUpload, uploads } = useLocalUploads();
  const contracts = useContracts();
  const backendUploads = useMemo(
    () => (contracts.data ?? []).map(contractToUploadRecord),
    [contracts.data],
  );
  const visibleUploads = backendUploads.length > 0 || !contracts.isError ? backendUploads : uploads;
  const hasUploads = visibleUploads.length > 0;

  return (
    <ContentContainer>
      <PageHeader
        actions={
          <Button onClick={() => setUploadOpen(true)} type="button">
            Upload Contract
          </Button>
        }
        description="Upload and monitor contracts through storage, parsing, OCR fallback, and text segmentation."
        title="Contracts"
      />
      {hasUploads ? (
        <FilterBar>
          <SearchInput placeholder="Search uploaded contract names" />
          <FilterSelect
            label="Upload status"
            options={["All upload statuses", "Stored", "Duplicate"]}
          />
          <FilterSelect
            label="Processing status"
            options={["All processing statuses", "Queued", "Parsing", "OCR", "Text segmented"]}
          />
          <Button type="button" variant="secondary">
            Clear Filters
          </Button>
        </FilterBar>
      ) : null}
      <SectionCard
        description="Rows are loaded from the backend contract list endpoint for the current organization."
        title="Contracts"
      >
        {contracts.isLoading ? <TableSkeleton /> : null}
        {contracts.isError ? <InlineError error={contracts.error} /> : null}
        {!contracts.isLoading && hasUploads ? (
          <RecentContractsTable uploads={visibleUploads} />
        ) : null}
        {!contracts.isLoading && !hasUploads ? (
          <EmptyState
            action={
              <Button onClick={() => setUploadOpen(true)} type="button">
                Upload Contract
              </Button>
            }
            title="No contracts uploaded yet."
          >
            Upload a PDF to begin tracking obligations.
          </EmptyState>
        ) : null}
      </SectionCard>
      <UploadContractDialog
        onClose={() => setUploadOpen(false)}
        onUploaded={addUpload}
        open={uploadOpen}
      />
    </ContentContainer>
  );
}

function SummaryTab({ contractId }: { readonly contractId: string }) {
  const contract = useContract(contractId);
  const status = useProcessingStatus(contractId);
  const detail = contract.data;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <SectionCard title="Key Details">
        {contract.isLoading ? <LoadingSkeleton label="Loading contract detail" /> : null}
        {contract.isError ? <InlineError error={contract.error} /> : null}
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-semibold uppercase text-muted">Display Name</dt>
            <dd className="mt-2">{detail?.displayName ?? "Unavailable"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-semibold uppercase text-muted">Original File</dt>
            <dd className="mt-2">{detail?.currentDocument?.originalFilename ?? "Unavailable"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-semibold uppercase text-muted">Text Pages</dt>
            <dd className="mt-2">{detail ? detail.text.pageCount : "Unavailable"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-semibold uppercase text-muted">Segments</dt>
            <dd className="mt-2">{detail ? detail.text.segmentCount : "Unavailable"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-semibold uppercase text-muted">OCR Pages</dt>
            <dd className="mt-2">{detail ? detail.text.ocrPageCount : "Unavailable"}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs font-semibold uppercase text-muted">SHA-256</dt>
            <dd className="mt-2 break-all font-mono text-xs">
              {detail?.currentDocument?.checksumSha256 ?? "Unavailable"}
            </dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard title="Backend Status">
        {status.isLoading ? <LoadingSkeleton label="Loading backend status" /> : null}
        {status.isError ? <InlineError error={status.error} /> : null}
        {status.isSuccess ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <StatusBadge
                label={formatStatusLabel(status.data.status)}
                tone={statusTone(status.data.status)}
              />
              <span className="text-sm text-muted">Attempt {status.data.attemptNumber}</span>
            </div>
            <ProcessingTimeline status={status.data.status} />
            {status.data.status === "FAILED" ? (
              <ErrorState
                detail={
                  status.data.errorMessage ??
                  "The original PDF remains safely stored. Retry support is not exposed by the backend route set yet."
                }
                title="Processing failed after upload."
              />
            ) : null}
          </>
        ) : null}
      </SectionCard>
      <SectionCard className="xl:col-span-2" title="Workflow Counts">
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            helper="Source API not exposed"
            label="Unresolved Review Items"
            value="Unavailable"
          />
          <KpiCard
            helper="Obligation API not implemented"
            label="Total Obligations"
            value="Unavailable"
          />
          <KpiCard
            helper="Requires obligation extraction endpoint"
            label="Next Obligation Deadline"
            value="Unavailable"
          />
        </div>
      </SectionCard>
    </div>
  );
}

function TextSegmentsTable({ pages }: { readonly pages: readonly DocumentTextPage[] }) {
  const segments = pages.flatMap((page) =>
    page.segments.slice(0, 4).map((segment) => ({
      ...segment,
      extractionMethod: page.extractionMethod,
      ocrConfidence: page.ocrConfidence,
      warnings: page.warnings,
    })),
  );

  if (segments.length === 0) {
    return (
      <EmptyState title="Parsed text is not ready.">
        Text pages will appear here after the worker reaches Text Segmented.
      </EmptyState>
    );
  }

  return (
    <DataTable minWidth="min-w-[860px]">
      <TableHead columns={["Page", "Lines", "Method", "Excerpt"]} />
      <tbody className="divide-y divide-border">
        {segments.map((segment) => (
          <tr key={`${segment.pageNumber}-${segment.lineStart}-${segment.startOffset}`}>
            <td className="px-4 py-3">{segment.pageNumber}</td>
            <td className="px-4 py-3">
              {segment.lineStart}-{segment.lineEnd}
            </td>
            <td className="px-4 py-3">
              <StatusBadge
                label={formatStatusLabel(segment.extractionMethod)}
                tone={segment.extractionMethod === "PDF_TEXT" ? "success" : "info"}
              />
            </td>
            <td className="max-w-xl px-4 py-3 text-muted">
              <p className="line-clamp-3">{segment.normalizedText}</p>
              {segment.ocrConfidence !== null ? (
                <p className="mt-2 text-xs">OCR confidence {segment.ocrConfidence}</p>
              ) : null}
              {segment.warnings.length > 0 ? (
                <p className="mt-2 text-xs">Warnings: {segment.warnings.join(", ")}</p>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

function ReviewEvidenceTab({ contractId }: { readonly contractId: string }) {
  const textPages = useContractTextPages(contractId, true);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <SectionCard title="Parsed Text Segments">
        {textPages.isLoading ? <TableSkeleton /> : null}
        {textPages.isError ? <InlineError error={textPages.error} /> : null}
        {textPages.isSuccess ? <TextSegmentsTable pages={textPages.data.pages} /> : null}
      </SectionCard>
      <div className="space-y-5">
        <PdfViewer />
        <SourceEvidencePanel
          detail={
            textPages.isSuccess
              ? `${textPages.data.pages.length} parsed page${textPages.data.pages.length === 1 ? "" : "s"} loaded from backend.`
              : undefined
          }
        />
      </div>
    </div>
  );
}

function WorkspaceObligationsTab() {
  const obligations = useObligations();

  if (obligations.isLoading) return <TableSkeleton />;
  if (obligations.isError) {
    return <InlineError error={obligations.error} />;
  }
  const rows = obligations.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState title="No obligations found for this contract.">
        Obligations will appear after extraction and review are implemented.
      </EmptyState>
    );
  }

  return (
    <DataTable>
      <TableHead
        columns={[
          "Obligation",
          "Type",
          "Due Date",
          "Status",
          "Reminder Status",
          "Source",
          "Actions",
        ]}
      />
      <tbody className="divide-y divide-border">
        {rows.map((item) => (
          <tr key={item.id}>
            <td className="px-4 py-3 font-medium">{item.title}</td>
            <td className="px-4 py-3 text-muted">Unavailable</td>
            <td className="px-4 py-3">
              {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "Unavailable"}
            </td>
            <td className="px-4 py-3">
              <StatusBadge label={formatStatusLabel(item.status)} tone={statusTone(item.status)} />
            </td>
            <td className="px-4 py-3 text-muted">Unavailable</td>
            <td className="px-4 py-3 text-muted">Unavailable</td>
            <td className="px-4 py-3">
              <Button disabled type="button" variant="secondary">
                Open
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export function ContractWorkspacePage() {
  const contractId = useParams().contractId ?? "";
  const [tab, setTab] = useState("Summary");
  const tabs = ["Summary", "Review & Evidence", "Obligations", "Activity"];

  return (
    <ContentContainer>
      <div className="mb-3 text-sm text-muted">
        <Link className="hover:text-teal-800" to={routePaths.contracts}>
          Contracts
        </Link>{" "}
        / {contractId}
      </div>
      <PageHeader
        description="Verify stored status, extracted evidence, obligations, and auditability for one contract."
        title={`Contract ${contractId}`}
      >
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge label="Status polled from backend" tone="info" />
          <StatusBadge label="Review unavailable" />
        </div>
      </PageHeader>
      <div className="rounded-lg border border-border bg-white p-5">
        <div className="mb-5 overflow-x-auto border-b border-border">
          <div className="flex min-w-max gap-1" role="tablist">
            {tabs.map((item) => (
              <button
                aria-selected={tab === item}
                className={
                  tab === item
                    ? "border-b-2 border-accent px-3 py-3 text-sm font-medium text-teal-800"
                    : "border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted hover:text-ink"
                }
                key={item}
                onClick={() => setTab(item)}
                role="tab"
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {tab === "Summary" ? <SummaryTab contractId={contractId} /> : null}
        {tab === "Review & Evidence" ? <ReviewEvidenceTab contractId={contractId} /> : null}
        {tab === "Obligations" ? <WorkspaceObligationsTab /> : null}
        {tab === "Activity" ? <AuditTimeline /> : null}
      </div>
    </ContentContainer>
  );
}

export function ObligationsPage() {
  const obligations = useObligations();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState("");
  const counts = useMemo(() => {
    const rows = obligations.data ?? [];
    return {
      upcoming: rows.filter((item) => item.status === "UPCOMING").length,
      due: rows.filter((item) => item.status === "DUE").length,
      missed: rows.filter((item) => item.status === "MISSED").length,
    };
  }, [obligations.data]);

  return (
    <ContentContainer>
      <PageHeader
        description="Track upcoming, due, completed, and missed contractual commitments."
        title="Obligations"
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <KpiCard
          helper="Backend count"
          label="Upcoming"
          tone="info"
          value={obligations.isSuccess ? String(counts.upcoming) : "Unavailable"}
        />
        <KpiCard
          helper="Backend count"
          label="Due"
          tone="warning"
          value={obligations.isSuccess ? String(counts.due) : "Unavailable"}
        />
        <KpiCard
          helper="Backend count"
          label="Missed"
          tone="danger"
          value={obligations.isSuccess ? String(counts.missed) : "Unavailable"}
        />
      </div>
      <FilterBar>
        <SearchInput placeholder="Search obligations" />
        <FilterSelect
          label="Status"
          options={["All statuses", "Upcoming", "Due", "Met", "Missed"]}
        />
        <FilterSelect
          label="Due-date range"
          options={["Any due date", "Next 7 days", "Next 30 days", "Next 60 days"]}
        />
        <FilterSelect label="Obligation type" options={["All types"]} />
      </FilterBar>
      {obligations.isLoading ? <TableSkeleton /> : null}
      {obligations.isError ? (
        <ErrorState
          detail="The backend route exists but currently returns an implementation error. No obligation or reminder rows are fabricated."
          title="Obligation API unavailable."
        />
      ) : null}
      {obligations.isSuccess && obligations.data.length === 0 ? (
        <EmptyState title="No obligations match the current filters.">
          Obligations will appear here after extraction, review, and obligation persistence are
          available.
        </EmptyState>
      ) : null}
      {obligations.isSuccess && obligations.data.length > 0 ? (
        <>
          <DataTable>
            <TableHead
              columns={[
                "Obligation",
                "Contract",
                "Due Date",
                "Days Remaining",
                "Status",
                "Reminder Status",
                "Source",
                "Actions",
              ]}
            />
            <tbody className="divide-y divide-border">
              {obligations.data.map((item) => (
                <tr className="hover:bg-slate-50" key={item.id}>
                  <td className="px-4 py-3 font-medium">{item.title}</td>
                  <td className="px-4 py-3">{item.contractId}</td>
                  <td className="px-4 py-3">
                    {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "Unavailable"}
                  </td>
                  <td className="px-4 py-3 text-muted">Unavailable</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={formatStatusLabel(item.status)}
                      tone={statusTone(item.status)}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted">Unavailable</td>
                  <td className="px-4 py-3 text-muted">Unavailable</td>
                  <td className="px-4 py-3">
                    <Button onClick={() => setDrawerOpen(true)} type="button" variant="secondary">
                      Open Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination
            label={`Showing ${obligations.data.length} obligation${obligations.data.length === 1 ? "" : "s"}`}
          />
        </>
      ) : null}
      <Drawer onClose={() => setDrawerOpen(false)} open={drawerOpen} title="Obligation Details">
        <div className="space-y-5">
          <ErrorState
            detail="The backend list DTO does not yet include description, derivation, source anchors, reminder history, or transition history."
            title="Details unavailable."
          />
          <Button
            onClick={() => {
              setToast("Transition rejected. Obligation transition endpoint is not implemented.");
              window.setTimeout(() => setToast(""), 2400);
            }}
            type="button"
            variant="secondary"
          >
            Test backend-authoritative transition handling
          </Button>
        </div>
      </Drawer>
      {toast ? <Toast message={toast} /> : null}
    </ContentContainer>
  );
}
