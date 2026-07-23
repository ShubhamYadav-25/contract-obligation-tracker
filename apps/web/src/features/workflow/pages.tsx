import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { obligationStatuses } from "@contract-obligation-tracker/shared";
import {
  CalendarClock,
  CheckCircle2,
  CircleX,
  Clock3,
  Download,
  ExternalLink,
  FileSearch,
  Printer,
  UploadCloud,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { routePaths } from "../../app/route-paths.js";
import { InlineError } from "../../components/feedback/inline-error.js";
import { ContentContainer } from "../../components/layout/content-container.js";
import { PageHeader } from "../../components/layout/page-header.js";
import { PdfViewerContainer } from "../../components/pdf-viewer/pdf-viewer-container.js";
import type { PdfSourceNavigationCommand } from "../../components/pdf-viewer/pdf-source-navigation.js";
import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Select } from "../../components/ui/select.js";
import { cx } from "../../utils/cx.js";
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
import type {
  ObligationDueDateRangeFilter,
  ObligationReminderFilter,
  ObligationSourceAnchor,
  ObligationStatus,
  ObligationSummary,
} from "../obligations/types/obligation.js";
import {
  AuditTimeline,
  DataTable,
  EmptyState,
  ErrorState,
  FileDropzone,
  FilterBar,
  KpiCard,
  LoadingSkeleton,
  Modal,
  MutationSpinner,
  PaginationControls,
  ProcessingTimeline,
  SearchInput,
  SectionCard,
  SourceEvidencePanel,
  StatusBadge,
  TableHead,
  TableSkeleton,
  formatStatusLabel,
  statusTone,
} from "./components.js";

const listPageSize = 10;

const obligationStatusLabels: Record<ObligationStatus, string> = {
  UPCOMING: "Upcoming",
  DUE: "Due",
  MET: "Met",
  MISSED: "Missed",
};

const obligationStatusCardStyles: Record<ObligationStatus, string> = {
  UPCOMING: "border-sky-200 border-t-sky-400 bg-gradient-to-br from-white to-sky-50 text-sky-900",
  DUE: "border-amber-200 border-t-amber-400 bg-gradient-to-br from-white to-amber-50 text-amber-950",
  MET: "border-emerald-200 border-t-emerald-400 bg-gradient-to-br from-white to-emerald-50 text-emerald-950",
  MISSED: "border-rose-200 border-t-rose-400 bg-gradient-to-br from-white to-rose-50 text-rose-950",
};

const obligationStatusCountsFallback: Record<ObligationStatus, number> = {
  UPCOMING: 0,
  DUE: 0,
  MET: 0,
  MISSED: 0,
};

const obligationStatusIcons = {
  UPCOMING: CalendarClock,
  DUE: Clock3,
  MET: CheckCircle2,
  MISSED: CircleX,
} as const;

const reminderFilterLabels: Record<ObligationReminderFilter, string> = {
  PENDING: "Pending reminders",
  ENQUEUED: "Enqueued reminders",
  PROCESSING: "Processing reminders",
  DELIVERED: "Delivered reminders",
  RETRY_PENDING: "Retry pending",
  FAILED: "Failed reminders",
  CANCELLED: "Cancelled reminders",
  NONE: "No reminder",
};

const dueDateRangeLabels: Record<ObligationDueDateRangeFilter, string> = {
  OVERDUE: "Overdue",
  NEXT_7_DAYS: "Next 7 days",
  NEXT_30_DAYS: "Next 30 days",
};

interface ContractWorkspaceLocationState {
  readonly tab?: string;
  readonly sourceCommand?: PdfSourceNavigationCommand;
}

function sourceCommandFromAnchor(
  anchor: ObligationSourceAnchor | undefined,
): PdfSourceNavigationCommand | null {
  if (!anchor) return null;
  return {
    type: "PDF_NAVIGATE_TO_SOURCE",
    payload: {
      pageNumber: anchor.pageNumber,
      boxes: anchor.boxes,
    },
  };
}

function sourceLinkState(
  anchor: ObligationSourceAnchor | undefined,
): ContractWorkspaceLocationState {
  const sourceCommand = sourceCommandFromAnchor(anchor);
  return {
    tab: "Review & Evidence",
    ...(sourceCommand ? { sourceCommand } : {}),
  };
}

function UploadProcessingNotice({
  fileName,
}: {
  readonly fileName: string | undefined;
}) {
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

function UploadContractDialog({
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
    </>
  );
}

export function DashboardPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const contracts = useContracts();
  const obligations = useObligations();
  const backendUploads = useMemo(
    () => (contracts.data ?? []).map(contractToUploadRecord),
    [contracts.data],
  );
  const visibleUploads = backendUploads;
  const obligationRows = obligations.data?.items ?? [];
  const nextDeadlines = obligationRows
    .filter((item) => item.dueAt && item.status !== "MET")
    .sort((left, right) => Date.parse(left.dueAt ?? "") - Date.parse(right.dueAt ?? ""))
    .slice(0, 5);
  const storedCount = visibleUploads.filter((item) =>
    [
      "STORED",
      "QUEUED",
      "PROCESSING",
      "PARSING",
      "OCR_PROCESSING",
      "TEXT_SEGMENTED",
      "COMPLETED",
      "REVIEW_REQUIRED",
    ].includes(item.status),
  ).length;
  const segmentedCount = visibleUploads.filter((item) => (item.textPageCount ?? 0) > 0).length;

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
          helper="Backend list"
          label="Total Contracts"
          tone="info"
          value={
            contracts.isError
              ? "Unavailable"
              : contracts.isLoading
                ? "Loading"
                : String(visibleUploads.length)
          }
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
        <KpiCard
          helper="Backend list"
          label="Obligations"
          value={
            obligations.isError
              ? "Unavailable"
              : obligations.isLoading
                ? "Loading"
                : String(obligations.data?.total ?? obligationRows.length)
          }
        />
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
          {obligations.isLoading ? <LoadingSkeleton label="Loading obligation deadlines" /> : null}
          {obligations.isError ? <InlineError error={obligations.error} /> : null}
          {obligations.isSuccess && nextDeadlines.length === 0 ? (
            <EmptyState title="No obligation deadlines available.">
              Deadlines will appear when obligations with due dates are stored.
            </EmptyState>
          ) : null}
          {nextDeadlines.length > 0 ? (
            <div className="space-y-3">
              {nextDeadlines.map((item) => (
                <div
                  className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  key={item.id}
                >
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs text-muted">
                      {item.contractDisplayName ?? item.contractId}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={formatStatusLabel(item.status)}
                      tone={statusTone(item.status)}
                    />
                    <span className="text-sm text-muted">
                      {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "No due date"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </SectionCard>
        <SectionCard className="xl:col-span-2" title="Recent Contracts">
          {contracts.isLoading ? (
            <TableSkeleton />
          ) : (
            <RecentContractsTable uploads={visibleUploads.slice(0, 5)} />
          )}
        </SectionCard>
      </div>
      <UploadContractDialog onClose={() => setUploadOpen(false)} open={uploadOpen} />
    </ContentContainer>
  );
}

export function ContractsPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const contracts = useContracts({
    search,
    limit: listPageSize + 1,
    offset: pageIndex * listPageSize,
  });
  const backendUploads = useMemo(
    () => (contracts.data ?? []).map(contractToUploadRecord),
    [contracts.data],
  );
  const visibleUploads = backendUploads.slice(0, listPageSize);
  const hasUploads = visibleUploads.length > 0;
  const hasNextPage = backendUploads.length > listPageSize;
  const pageStart = pageIndex * listPageSize + 1;
  const pageEnd = pageIndex * listPageSize + visibleUploads.length;

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
      <FilterBar>
        <SearchInput
          onChange={(value) => {
            setSearch(value);
            setPageIndex(0);
          }}
          placeholder="Search contract name, file name, reference, or hash"
          value={search}
        />
        <Button
          disabled={!search && pageIndex === 0}
          onClick={() => {
            setSearch("");
            setPageIndex(0);
          }}
          type="button"
          variant="secondary"
        >
          Clear
        </Button>
      </FilterBar>
      <SectionCard
        description="Rows are loaded from the backend contract list endpoint for the current organization."
        title="Contracts"
      >
        {contracts.isLoading ? <TableSkeleton /> : null}
        {contracts.isError ? <InlineError error={contracts.error} /> : null}
        {!contracts.isLoading && hasUploads ? (
          <>
            <RecentContractsTable uploads={visibleUploads} />
            <PaginationControls
              label={`Showing ${pageStart}-${pageEnd}`}
              nextDisabled={!hasNextPage || contracts.isFetching}
              onNext={() => setPageIndex((current) => current + 1)}
              onPrevious={() => setPageIndex((current) => Math.max(current - 1, 0))}
              previousDisabled={pageIndex === 0 || contracts.isFetching}
            />
          </>
        ) : null}
        {!contracts.isLoading && !hasUploads ? (
          <EmptyState
            action={
              <Button onClick={() => setUploadOpen(true)} type="button">
                Upload Contract
              </Button>
            }
            title={search ? "No contracts match the current search." : "No contracts uploaded yet."}
          >
            {search
              ? "Change or clear the search to load other Postgres rows."
              : "Upload a PDF to begin tracking obligations."}
          </EmptyState>
        ) : null}
      </SectionCard>
      <UploadContractDialog onClose={() => setUploadOpen(false)} open={uploadOpen} />
    </ContentContainer>
  );
}

function SummaryTab({ contractId }: { readonly contractId: string }) {
  const contract = useContract(contractId);
  const status = useProcessingStatus(contractId);
  const obligations = useObligations(contractId);
  const detail = contract.data;
  const obligationRows = obligations.data?.items ?? [];
  const unresolvedObligations = obligationRows.filter((item) => item.status !== "MET").length;
  const nextDeadline = obligationRows
    .filter((item) => item.dueAt && item.status !== "MET")
    .sort((left, right) => Date.parse(left.dueAt ?? "") - Date.parse(right.dueAt ?? ""))[0];

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
            helper="Backend obligation API"
            label="Open Obligations"
            value={obligations.isSuccess ? String(unresolvedObligations) : "Unavailable"}
          />
          <KpiCard
            helper="Backend obligation API"
            label="Total Obligations"
            value={obligations.isSuccess ? String(obligations.data.total) : "Unavailable"}
          />
          <KpiCard
            helper="Derived from obligation due dates"
            label="Next Obligation Deadline"
            value={
              obligations.isSuccess && nextDeadline?.dueAt
                ? new Date(nextDeadline.dueAt).toLocaleDateString()
                : "Unavailable"
            }
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

function ReviewEvidenceTab({
  contractId,
  sourceCommand,
}: {
  readonly contractId: string;
  readonly sourceCommand?: PdfSourceNavigationCommand | null;
}) {
  const textPages = useContractTextPages(contractId, true);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <SectionCard title="Parsed Text Segments">
        {textPages.isLoading ? <TableSkeleton /> : null}
        {textPages.isError ? <InlineError error={textPages.error} /> : null}
        {textPages.isSuccess ? <TextSegmentsTable pages={textPages.data.pages} /> : null}
      </SectionCard>
      <div className="space-y-5">
        <PdfViewerContainer
          contractId={contractId}
          initialPage={sourceCommand?.payload.pageNumber ?? 1}
          sourceCommand={sourceCommand}
        />
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

function WorkspaceObligationsTab({ contractId }: { readonly contractId: string }) {
  const obligations = useObligations(contractId);

  if (obligations.isLoading) return <TableSkeleton />;
  if (obligations.isError) {
    return <InlineError error={obligations.error} />;
  }
  const rows = obligations.data?.items ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState title="No obligations found for this contract.">
        Obligations will appear after the worker extracts and stores them.
      </EmptyState>
    );
  }

  return (
    <DataTable>
      <TableHead
        columns={["Obligation", "Due Date", "Status", "Reminder Status", "Source", "Actions"]}
      />
      <tbody className="divide-y divide-border">
        {rows.map((item) => (
          <tr key={item.id}>
            <td className="px-4 py-3 font-medium">{item.title}</td>
            <td className="px-4 py-3">
              {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "Not set"}
            </td>
            <td className="px-4 py-3">
              <StatusBadge label={formatStatusLabel(item.status)} tone={statusTone(item.status)} />
            </td>
            <td className="px-4 py-3 text-muted">{item.reminderStatus ?? "No reminder"}</td>
            <td className="px-4 py-3">
              <Link
                className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-white px-3 text-sm font-medium hover:bg-surface focus-visible:shadow-focus"
                state={sourceLinkState(item.sourceAnchors?.[0])}
                to={routePaths.contractDetail(item.contractId)}
              >
                View Source
              </Link>
            </td>
            <td className="px-4 py-3">
              <Link
                className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-white px-3 text-sm font-medium hover:bg-surface focus-visible:shadow-focus"
                to={routePaths.obligationDetail(item.id)}
              >
                Open
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export function ContractWorkspacePage() {
  const contractId = useParams().contractId ?? "";
  const location = useLocation();
  const locationState = location.state as ContractWorkspaceLocationState | null;
  const requestedTab = locationState?.tab === "Review & Evidence" ? "Review & Evidence" : null;
  const [tab, setTab] = useState(requestedTab ?? "Summary");
  const tabs = ["Summary", "Review & Evidence", "Obligations", "Activity"];

  useEffect(() => {
    if (requestedTab) {
      setTab(requestedTab);
    }
  }, [requestedTab]);

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
        {tab === "Review & Evidence" ? (
          <ReviewEvidenceTab
            contractId={contractId}
            sourceCommand={locationState?.sourceCommand ?? null}
          />
        ) : null}
        {tab === "Obligations" ? <WorkspaceObligationsTab contractId={contractId} /> : null}
        {tab === "Activity" ? <AuditTimeline /> : null}
      </div>
    </ContentContainer>
  );
}

function daysRemaining(dueAt: string | undefined): number | null {
  if (!dueAt) return null;
  return Math.ceil((Date.parse(dueAt) - Date.now()) / (1000 * 60 * 60 * 24));
}

function daysRemainingClassName(days: number | null): string {
  if (days === null) return "text-slate-400";
  if (days < 0) return "font-semibold text-rose-700";
  if (days <= 5) return "font-semibold text-amber-700";
  return "font-semibold text-emerald-700";
}

function TableActionLink({
  children,
  icon: Icon,
  state,
  to,
}: {
  readonly children: string;
  readonly icon: typeof FileSearch;
  readonly state?: ContractWorkspaceLocationState;
  readonly to: string;
}) {
  return (
    <Link
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition duration-150 ease-out hover:border-teal-500 hover:bg-teal-50 hover:text-teal-800 focus-visible:shadow-focus active:translate-y-px"
      state={state}
      to={to}
    >
      <Icon aria-hidden className="size-4" />
      {children}
    </Link>
  );
}

function ObligationMobileCard({
  obligation,
  selected,
  onSelectedChange,
}: {
  readonly obligation: ObligationSummary;
  readonly selected: boolean;
  readonly onSelectedChange: (selected: boolean) => void;
}) {
  const days = daysRemaining(obligation.dueAt);

  return (
    <article
      className={cx(
        "rounded-lg border border-slate-200 bg-white p-4 shadow-card transition",
        selected ? "bg-teal-50 ring-1 ring-teal-200" : "",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          aria-label={`Select ${obligation.title}`}
          checked={selected}
          className="mt-1 size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          onChange={(event) => onSelectedChange(event.target.checked)}
          type="checkbox"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-bold leading-6 text-slate-950">{obligation.title}</h3>
            <StatusBadge
              label={formatStatusLabel(obligation.status)}
              tone={statusTone(obligation.status)}
            />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {obligation.contractDisplayName ?? obligation.contractId}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Due Date</dt>
          <dd className="mt-1 text-slate-900">
            {obligation.dueAt ? new Date(obligation.dueAt).toLocaleDateString() : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Days</dt>
          <dd className={cx("mt-1", daysRemainingClassName(days))}>
            {days === null ? "Unavailable" : days}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Reminder</dt>
          <dd className="mt-1 text-slate-700">{obligation.reminderStatus ?? "No reminder"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Contract</dt>
          <dd className="mt-1 truncate text-slate-700">
            {obligation.contractDisplayName ?? obligation.contractId}
          </dd>
        </div>
      </dl>
      <div className="sticky bottom-0 mt-4 flex gap-2 bg-white pt-3">
        <TableActionLink
          icon={FileSearch}
          state={sourceLinkState(obligation.sourceAnchors?.[0])}
          to={routePaths.contractDetail(obligation.contractId)}
        >
          Source
        </TableActionLink>
        <TableActionLink icon={ExternalLink} to={routePaths.obligationDetail(obligation.id)}>
          Details
        </TableActionLink>
      </div>
    </article>
  );
}

export function ObligationsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ObligationStatus | undefined>();
  const [reminderFilter, setReminderFilter] = useState<ObligationReminderFilter | undefined>();
  const [dueDateRange, setDueDateRange] = useState<ObligationDueDateRangeFilter | undefined>();
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [pageIndex, setPageIndex] = useState(0);
  const obligationQueryInput = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(reminderFilter ? { reminderStatus: reminderFilter } : {}),
    ...(dueDateRange ? { dueDateRange } : {}),
    limit: listPageSize + 1,
    offset: pageIndex * listPageSize,
  };
  const obligations = useObligations(undefined, obligationQueryInput);
  const obligationItems = obligations.data?.items ?? [];
  const visibleObligations = obligationItems.slice(0, listPageSize);
  const hasNextPage = obligationItems.length > listPageSize;
  const pageStart = pageIndex * listPageSize + 1;
  const pageEnd = pageIndex * listPageSize + visibleObligations.length;
  const statusCounts = obligations.data?.statusCounts ?? obligationStatusCountsFallback;
  const allVisibleSelected =
    visibleObligations.length > 0 && visibleObligations.every((item) => selectedIds.has(item.id));
  const activeFilterLabel = statusFilter
    ? `Filtered by ${obligationStatusLabels[statusFilter]}`
    : null;
  const hasActiveFilters = Boolean(search.trim() || statusFilter || reminderFilter || dueDateRange);

  function setRowSelected(obligationId: string, selected: boolean): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(obligationId);
      } else {
        next.delete(obligationId);
      }
      return next;
    });
  }

  function toggleVisibleRows(selected: boolean): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const obligation of visibleObligations) {
        if (selected) {
          next.add(obligation.id);
        } else {
          next.delete(obligation.id);
        }
      }
      return next;
    });
  }

  function clearFilters(): void {
    setSearch("");
    setStatusFilter(undefined);
    setReminderFilter(undefined);
    setDueDateRange(undefined);
    setPageIndex(0);
    setSelectedIds(new Set());
  }

  function exportCsv(): void {
    const header = [
      "Obligation",
      "Contract",
      "Due Date",
      "Days Remaining",
      "Status",
      "Reminder Status",
    ];
    const rows = visibleObligations.map((item) => {
      const days = daysRemaining(item.dueAt);
      return [
        item.title,
        item.contractDisplayName ?? item.contractId,
        item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "",
        days === null ? "" : String(days),
        formatStatusLabel(item.status),
        item.reminderStatus ?? "No reminder",
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "obligations.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ContentContainer>
      <PageHeader
        description="Track upcoming, due, completed, and missed contractual commitments."
        title="Obligations"
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {obligationStatuses.map((status) => {
          const isActive = statusFilter === status;
          const Icon = obligationStatusIcons[status];
          return (
            <button
              key={status}
              aria-pressed={isActive}
              className={cx(
                "rounded-lg border border-t-4 p-5 text-left shadow-card transition duration-200 ease-out focus-visible:shadow-focus hover:-translate-y-0.5 hover:shadow-card-hover",
                obligationStatusCardStyles[status],
                isActive ? "ring-2 ring-accent ring-offset-2" : "hover:border-teal-400",
              )}
              onClick={() => {
                setStatusFilter(isActive ? undefined : status);
                setPageIndex(0);
              }}
              type="button"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold">{obligationStatusLabels[status]}</span>
                <Icon aria-hidden className="size-5 opacity-80" />
              </span>
              <span className="mt-4 block text-3xl font-bold leading-none">
                {obligations.isSuccess ? String(statusCounts[status]) : "Unavailable"}
              </span>
              {isActive ? <span className="mt-3 block text-xs font-semibold">Filtered</span> : null}
            </button>
          );
        })}
      </div>
      <FilterBar>
        <SearchInput
          onChange={(value) => {
            setSearch(value);
            setPageIndex(0);
          }}
          placeholder="Search obligation, description, or contract"
          value={search}
        />
        <Select
          aria-label="Status filter"
          className="min-w-40"
          value={statusFilter ?? "ALL"}
          onChange={(event) => {
            const value = event.target.value;
            setStatusFilter(value === "ALL" ? undefined : (value as ObligationStatus));
            setPageIndex(0);
          }}
        >
          <option value="ALL">All statuses</option>
          {obligationStatuses.map((status) => (
            <option key={status} value={status}>
              {obligationStatusLabels[status]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Reminder filter"
          className="min-w-44"
          value={reminderFilter ?? "ALL"}
          onChange={(event) => {
            const value = event.target.value;
            setReminderFilter(value === "ALL" ? undefined : (value as ObligationReminderFilter));
            setPageIndex(0);
          }}
        >
          <option value="ALL">All reminders</option>
          {Object.entries(reminderFilterLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Date range"
          className="min-w-40"
          value={dueDateRange ?? "ALL"}
          onChange={(event) => {
            const value = event.target.value;
            setDueDateRange(value === "ALL" ? undefined : (value as ObligationDueDateRangeFilter));
            setPageIndex(0);
          }}
        >
          <option value="ALL">All due dates</option>
          {Object.entries(dueDateRangeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <div className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white shadow-card">
          <button
            className="inline-flex h-10 items-center gap-1.5 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:translate-y-px"
            onClick={exportCsv}
            type="button"
          >
            <Download aria-hidden className="size-4" />
            CSV
          </button>
          <button
            className="inline-flex h-10 items-center gap-1.5 border-l border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:translate-y-px"
            onClick={() => window.print()}
            type="button"
          >
            <Printer aria-hidden className="size-4" />
            Print
          </button>
        </div>
        <Button
          disabled={!hasActiveFilters && pageIndex === 0 && selectedIds.size === 0}
          onClick={clearFilters}
          type="button"
          variant="secondary"
        >
          Clear
        </Button>
      </FilterBar>
      {obligations.isLoading ? <TableSkeleton /> : null}
      {obligations.isError ? (
        <ErrorState
          detail="The backend obligation route returned an error. Rows are shown only when Postgres returns them."
          title="Obligation API unavailable."
        />
      ) : null}
      {obligations.isSuccess && visibleObligations.length === 0 ? (
        <EmptyState title="No obligations match the current filters.">
          Obligations will appear here after the worker extracts and stores them.
        </EmptyState>
      ) : null}
      {obligations.isSuccess && visibleObligations.length > 0 ? (
        <>
          {activeFilterLabel ? (
            <div className="mb-3 inline-flex rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-800">
              {activeFilterLabel}
            </div>
          ) : null}
          <div className="hidden md:block">
            <DataTable minWidth="min-w-[1080px]">
              <TableHead
                columns={[
                  "",
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
              <tbody className="divide-y divide-slate-200">
                {visibleObligations.map((item) => {
                  const days = daysRemaining(item.dueAt);
                  const selected = selectedIds.has(item.id);
                  return (
                    <tr
                      className={cx(
                        "transition-colors hover:bg-[#F0F9FF]",
                        selected ? "bg-teal-50" : "",
                      )}
                      key={item.id}
                    >
                      <td className="px-5 py-4">
                        <input
                          aria-label={`Select ${item.title}`}
                          checked={selected}
                          className="size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          onChange={(event) => setRowSelected(item.id, event.target.checked)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-950">{item.title}</td>
                      <td className="max-w-64 px-5 py-4">
                        <p className="truncate font-medium text-slate-900">
                          {item.contractDisplayName ?? item.contractId}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "Unavailable"}
                      </td>
                      <td className={cx("px-5 py-4", daysRemainingClassName(days))}>
                        {days === null ? "Unavailable" : days}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge
                          label={formatStatusLabel(item.status)}
                          tone={statusTone(item.status)}
                        />
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {item.reminderStatus ?? "No reminder"}
                      </td>
                      <td className="px-5 py-4">
                        <TableActionLink
                          icon={FileSearch}
                          state={sourceLinkState(item.sourceAnchors?.[0])}
                          to={routePaths.contractDetail(item.contractId)}
                        >
                          Source
                        </TableActionLink>
                      </td>
                      <td className="px-5 py-4">
                        <TableActionLink
                          icon={ExternalLink}
                          to={routePaths.obligationDetail(item.id)}
                        >
                          Details
                        </TableActionLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                checked={allVisibleSelected}
                className="size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                onChange={(event) => toggleVisibleRows(event.target.checked)}
                type="checkbox"
              />
              Select visible rows
            </label>
          </div>
          <div className="space-y-3 md:hidden">
            {visibleObligations.map((item) => (
              <ObligationMobileCard
                key={item.id}
                obligation={item}
                selected={selectedIds.has(item.id)}
                onSelectedChange={(selected) => setRowSelected(item.id, selected)}
              />
            ))}
          </div>
          <PaginationControls
            label={`Showing ${pageStart}-${pageEnd}`}
            nextDisabled={!hasNextPage || obligations.isFetching}
            onNext={() => setPageIndex((current) => current + 1)}
            onPrevious={() => setPageIndex((current) => Math.max(current - 1, 0))}
            previousDisabled={pageIndex === 0 || obligations.isFetching}
          />
        </>
      ) : null}
    </ContentContainer>
  );
}
