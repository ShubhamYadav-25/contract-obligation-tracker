import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { routePaths } from "../../app/route-paths.js";
import { InlineError } from "../../components/feedback/inline-error.js";
import { ContentContainer } from "../../components/layout/content-container.js";
import { PageHeader } from "../../components/layout/page-header.js";
import { PdfViewerContainer } from "../../components/pdf-viewer/pdf-viewer-container.js";
import type { PdfSourceNavigationCommand } from "../../components/pdf-viewer/pdf-source-navigation.js";
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
import type { ObligationSourceAnchor } from "../obligations/types/obligation.js";
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

function sourceLinkState(anchor: ObligationSourceAnchor | undefined): ContractWorkspaceLocationState {
  const sourceCommand = sourceCommandFromAnchor(anchor);
  return {
    tab: "Review & Evidence",
    ...(sourceCommand ? { sourceCommand } : {}),
  };
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
  const obligationRows = obligations.data ?? [];
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
                : String(obligationRows.length)
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
  const obligationRows = obligations.data ?? [];
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
            value={obligations.isSuccess ? String(obligationRows.length) : "Unavailable"}
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
  const rows = obligations.data ?? [];
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

export function ObligationsPage() {
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const obligations = useObligations(undefined, {
    search,
    limit: listPageSize + 1,
    offset: pageIndex * listPageSize,
  });
  const visibleObligations = (obligations.data ?? []).slice(0, listPageSize);
  const hasNextPage = (obligations.data ?? []).length > listPageSize;
  const pageStart = pageIndex * listPageSize + 1;
  const pageEnd = pageIndex * listPageSize + visibleObligations.length;
  const counts = useMemo(() => {
    return {
      upcoming: visibleObligations.filter((item) => item.status === "UPCOMING").length,
      due: visibleObligations.filter((item) => item.status === "DUE").length,
      missed: visibleObligations.filter((item) => item.status === "MISSED").length,
    };
  }, [visibleObligations]);

  return (
    <ContentContainer>
      <PageHeader
        description="Track upcoming, due, completed, and missed contractual commitments."
        title="Obligations"
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <KpiCard
          helper="Visible rows"
          label="Upcoming"
          tone="info"
          value={obligations.isSuccess ? String(counts.upcoming) : "Unavailable"}
        />
        <KpiCard
          helper="Visible rows"
          label="Due"
          tone="warning"
          value={obligations.isSuccess ? String(counts.due) : "Unavailable"}
        />
        <KpiCard
          helper="Visible rows"
          label="Missed"
          tone="danger"
          value={obligations.isSuccess ? String(counts.missed) : "Unavailable"}
        />
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
              {visibleObligations.map((item) => (
                <tr className="hover:bg-slate-50" key={item.id}>
                  <td className="px-4 py-3 font-medium">{item.title}</td>
                  <td className="px-4 py-3">{item.contractId}</td>
                  <td className="px-4 py-3">
                    {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "Unavailable"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {item.dueAt
                      ? Math.ceil((Date.parse(item.dueAt) - Date.now()) / (1000 * 60 * 60 * 24))
                      : "Unavailable"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={formatStatusLabel(item.status)}
                      tone={statusTone(item.status)}
                    />
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
                      Open Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
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
