import type { PropsWithChildren, ReactNode } from "react";
import { useEffect } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, Search, Upload, X } from "lucide-react";

import { Button } from "../../components/ui/button.js";
import { Input } from "../../components/ui/input.js";
import { Select } from "../../components/ui/select.js";
import { Textarea } from "../../components/ui/textarea.js";
import { cx } from "../../utils/cx.js";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-800 ring-slate-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-900 ring-amber-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  info: "bg-cyan-50 text-cyan-800 ring-cyan-200",
};

const dotClasses: Record<Tone, string> = {
  neutral: "bg-slate-500",
  success: "bg-emerald-600",
  warning: "bg-amber-600",
  danger: "bg-red-600",
  info: "bg-cyan-700",
};

export function SectionCard({
  action,
  children,
  className,
  description,
  title,
}: PropsWithChildren<{
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly className?: string;
}>) {
  return (
    <section className={cx("min-w-0 rounded-lg border border-border bg-white p-5", className)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
  readonly tone?: Tone;
}) {
  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className={cx("mt-3 inline-flex rounded px-2 py-1 text-xs ring-1", toneClasses[tone])}>
        {helper}
      </p>
    </section>
  );
}

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  readonly label: string;
  readonly tone?: Tone;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold ring-1",
        toneClasses[tone],
      )}
    >
      <span aria-hidden className={cx("size-1.5 rounded-full", dotClasses[tone])} />
      {label}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { readonly confidence?: number }) {
  if (typeof confidence !== "number") {
    return <StatusBadge label="Unavailable" tone="neutral" />;
  }
  const tone = confidence >= 80 ? "success" : confidence >= 50 ? "warning" : "danger";
  const label = confidence >= 80 ? "High" : confidence >= 50 ? "Medium" : "Low";
  return <StatusBadge label={`${label} ${confidence}%`} tone={tone} />;
}

export function DataTable({
  children,
  minWidth = "min-w-[720px]",
}: PropsWithChildren<{ readonly minWidth?: string }>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className={cx("w-full divide-y divide-border text-left text-sm", minWidth)}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ columns }: { readonly columns: readonly string[] }) {
  return (
    <thead className="bg-slate-50 text-xs uppercase text-muted">
      <tr>
        {columns.map((column) => (
          <th className="whitespace-nowrap px-4 py-3 font-semibold" key={column} scope="col">
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function Pagination({ label }: { readonly label: string }) {
  return <PaginationControls label={label} />;
}

export function PaginationControls({
  label,
  onNext,
  onPrevious,
  nextDisabled = true,
  previousDisabled = true,
}: {
  readonly label: string;
  readonly onNext?: () => void;
  readonly onPrevious?: () => void;
  readonly nextDisabled?: boolean;
  readonly previousDisabled?: boolean;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <p>{label}</p>
      <div className="flex items-center gap-2">
        <Button disabled={previousDisabled} onClick={onPrevious} type="button" variant="secondary">
          Previous
        </Button>
        <Button disabled={nextDisabled} onClick={onNext} type="button" variant="secondary">
          Next
        </Button>
      </div>
    </div>
  );
}

export function FilterBar({ children }: PropsWithChildren) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  );
}

export function SearchInput({
  onChange,
  placeholder,
  value,
}: {
  readonly placeholder: string;
  readonly value?: string;
  readonly onChange?: (value: string) => void;
}) {
  return (
    <label className="relative min-w-0 flex-1">
      <span className="sr-only">Search</span>
      <Search
        aria-hidden
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        size={16}
      />
      <Input
        className="w-full pl-9"
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
  );
}

export function FilterSelect({
  label,
  options,
}: {
  readonly label: string;
  readonly options: readonly string[];
}) {
  return (
    <Select aria-label={label} className="min-w-40">
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </Select>
  );
}

export function EmptyState({
  action,
  children,
  title,
}: PropsWithChildren<{ readonly title: string; readonly action?: ReactNode }>) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center">
      <FileText aria-hidden className="mx-auto text-muted" size={26} />
      <h2 className="mt-3 text-base font-semibold">{title}</h2>
      {children ? <p className="mx-auto mt-2 max-w-xl text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  action,
  detail,
  title,
}: {
  readonly title: string;
  readonly detail: string;
  readonly action?: ReactNode;
}) {
  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden className="mt-0.5 shrink-0" size={18} />
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1">{detail}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ label = "Loading" }: { readonly label?: string }) {
  return (
    <div aria-label={label} aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="h-14 animate-pulse rounded-lg border border-border bg-white" key={index} />
      ))}
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-white p-4" aria-label="Loading table">
      <div className="mb-4 h-5 w-1/3 animate-pulse rounded bg-slate-200" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="h-4 animate-pulse rounded bg-slate-200" key={index} />
        ))}
      </div>
    </div>
  );
}

export function Modal({
  children,
  onClose,
  open,
  title,
}: PropsWithChildren<{
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
}>) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        role="dialog"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            aria-label="Close dialog"
            className="rounded-md p-2 hover:bg-surface focus-visible:shadow-focus"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden size={18} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}

export function ConfirmDialog({
  children,
  confirmLabel,
  onCancel,
  onConfirm,
  open,
  title,
}: PropsWithChildren<{
  readonly open: boolean;
  readonly title: string;
  readonly confirmLabel: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}>) {
  return (
    <Modal onClose={onCancel} open={open} title={title}>
      <div className="space-y-4 text-sm text-muted">
        {children}
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
          <Button onClick={onConfirm} type="button" variant="danger">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function Drawer({
  children,
  onClose,
  open,
  title,
}: PropsWithChildren<{
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
}>) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close drawer overlay"
        className="absolute inset-0 bg-slate-950/35"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-modal="true"
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-xl"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            aria-label="Close drawer"
            className="rounded-md p-2 hover:bg-surface focus-visible:shadow-focus"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

export function FileDropzone({
  file,
  onFile,
}: {
  readonly file: File | null;
  readonly onFile: (file: File | null) => void;
}) {
  return (
    <div className="rounded-lg border-2 border-dashed border-border bg-white p-5 text-center">
      <Upload aria-hidden className="mx-auto text-muted" size={28} />
      <p className="mt-3 text-sm font-semibold">Drop a contract PDF here or browse files</p>
      <p className="mt-1 text-sm text-muted">
        PDF only. Maximum file size is controlled by the backend.
      </p>
      <label className="mt-4 inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-medium hover:bg-surface focus-within:shadow-focus">
        Browse Files
        <input
          accept="application/pdf"
          className="sr-only"
          onChange={(event) => onFile(event.target.files?.item(0) ?? null)}
          type="file"
        />
      </label>
      {file ? (
        <div className="mt-4 rounded-md border border-border bg-surface p-3 text-left">
          <p className="text-sm font-semibold">{file.name}</p>
          <p className="text-xs text-muted">
            {Math.max(file.size / 1024 / 1024, 0.01).toFixed(2)} MB
          </p>
          <button
            className="mt-2 text-sm font-medium text-teal-800 hover:underline"
            onClick={() => onFile(null)}
            type="button"
          >
            Remove file
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ProcessingTimeline({
  status,
}: {
  readonly status:
    | "RECEIVED"
    | "STORED"
    | "QUEUED"
    | "PROCESSING"
    | "PARSING"
    | "OCR_PROCESSING"
    | "TEXT_SEGMENTED"
    | "COMPLETED"
    | "REVIEW_REQUIRED"
    | "FAILED"
    | undefined;
}) {
  const stages = [
    "RECEIVED",
    "STORED",
    "QUEUED",
    "PROCESSING",
    "PARSING",
    "OCR_PROCESSING",
    "TEXT_SEGMENTED",
    "COMPLETED",
    "REVIEW_REQUIRED",
    "FAILED",
  ] as const;
  return (
    <ol className="space-y-3">
      {stages.map((stage) => {
        const isCurrent = status === stage;
        const isFailed = stage === "FAILED" && status === "FAILED";
        return (
          <li className="flex gap-3" key={stage}>
            <span
              aria-hidden
              className={cx(
                "mt-1 size-3 rounded-full ring-4",
                isFailed
                  ? "bg-red-600 ring-red-50"
                  : isCurrent
                    ? "bg-cyan-700 ring-cyan-50"
                    : "bg-slate-300 ring-slate-50",
              )}
            />
            <div>
              <p className="text-sm font-medium">{formatStatusLabel(stage)}</p>
              <p className="text-xs text-muted">
                {isCurrent ? "Current backend state" : "Awaiting backend timestamp support"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PdfViewer() {
  return (
    <div className="grid min-h-80 place-items-center rounded-lg border border-border bg-white p-6 text-center">
      <div>
        <FileText aria-hidden className="mx-auto text-muted" size={32} />
        <h2 className="mt-3 text-base font-semibold">Source PDF unavailable</h2>
        <p className="mt-2 max-w-md text-sm text-muted">
          The backend returns parsed text and source excerpts from Postgres. PDF viewing is not part
          of this screen.
        </p>
      </div>
    </div>
  );
}

export function SourceEvidencePanel({ detail }: { readonly detail?: string | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h2 className="text-base font-semibold">Source Evidence</h2>
      <p className="mt-2 text-sm text-muted">
        {detail ??
          "Source excerpts are loaded from backend text pages and obligation anchors when available."}
      </p>
      <div className="mt-4 rounded-md bg-surface p-3 text-sm text-muted">
        Page text, normalized excerpts, OCR method, confidence, and warnings are read from Postgres.
      </div>
    </div>
  );
}

export function AuditTimeline() {
  return (
    <EmptyState title="No activity recorded yet.">
      Contract activity requires a backend audit read endpoint. Upload events are already written by
      the backend, but they are not exposed to the frontend yet.
    </EmptyState>
  );
}

export function Toast({ message }: { readonly message: string }) {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 rounded-lg border border-emerald-200 bg-white p-3 text-sm font-medium text-emerald-900 shadow-lg"
    >
      <span className="inline-flex items-center gap-2">
        <CheckCircle2 aria-hidden size={16} />
        {message}
      </span>
    </div>
  );
}

export function MutationSpinner() {
  return <Loader2 aria-hidden className="animate-spin" size={16} />;
}

export function CorrectionForm() {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium" htmlFor="correction">
        Correction
        <Input
          className="mt-2 w-full"
          disabled
          id="correction"
          placeholder="Select a backend review candidate"
        />
      </label>
      <label className="block text-sm font-medium" htmlFor="review-note">
        Reviewer note
        <Textarea
          className="mt-2 w-full"
          disabled
          id="review-note"
          placeholder="Select a backend review candidate"
        />
      </label>
    </div>
  );
}

export function formatStatusLabel(status: string | undefined): string {
  if (!status) return "Unavailable";
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function statusTone(status: string | undefined): Tone {
  if (status === "FAILED" || status === "MISSED") return "danger";
  if (status === "QUEUED" || status === "DUE") return "warning";
  if (
    status === "STORED" ||
    status === "TEXT_SEGMENTED" ||
    status === "COMPLETED" ||
    status === "MET"
  ) {
    return "success";
  }
  if (
    status === "RECEIVED" ||
    status === "PROCESSING" ||
    status === "PARSING" ||
    status === "OCR_PROCESSING" ||
    status === "UPCOMING"
  ) {
    return "info";
  }
  return "neutral";
}
