/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { FileSearch } from "lucide-react";
import { Link } from "react-router-dom";

import { routePaths } from "@/app/route-paths.js";
import { InlineError } from "@/components/feedback/inline-error.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Textarea } from "@/components/ui/textarea.js";
import { useUpdateObligation } from "@/features/obligations/hooks/use-update-obligation.js";
import type {
  ObligationSourceAnchor,
  ObligationSummary,
} from "@/features/obligations/types/obligation.js";
import { MutationSpinner, StatusBadge, formatStatusLabel, statusTone } from "../components.js";
import { sourceAnchorLabel, sourceLinkState } from "../source-navigation.js";

type ObligationEditFormState = {
  readonly title: string;
  readonly description: string;
  readonly dueAt: string;
  readonly responsibleParty: string;
  readonly counterparty: string;
  readonly category: string;
  readonly timingType: string;
  readonly frequency: string;
  readonly triggerEvent: string;
  readonly offsetValue: string;
  readonly offsetUnit: string;
  readonly offsetDirection: string;
  readonly reviewStatus: string;
};

/**
 * @description Performs the format date input value helper operation for this module.
 * @param {string | undefined} value - Input value for value.
 * @returns {string} Result of the format date input value operation.
 */
function formatDateInputValue(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/**
 * @description Performs the obligation to form state helper operation for this module.
 * @param {ObligationSummary} obligation - Input value for obligation.
 * @returns {ObligationEditFormState} Result of the obligation to form state operation.
 */
function obligationToFormState(obligation: ObligationSummary): ObligationEditFormState {
  return {
    title: obligation.title,
    description: obligation.description ?? "",
    dueAt: formatDateInputValue(obligation.dueAt),
    responsibleParty: obligation.responsibleParty ?? "",
    counterparty: obligation.counterparty ?? "",
    category: obligation.category ?? "",
    timingType: obligation.timingType ?? "",
    frequency: obligation.frequency ?? "",
    triggerEvent: obligation.triggerEvent ?? "",
    offsetValue: typeof obligation.offsetValue === "number" ? String(obligation.offsetValue) : "",
    offsetUnit: obligation.offsetUnit ?? "",
    offsetDirection: obligation.offsetDirection ?? "",
    reviewStatus: obligation.reviewStatus ?? "",
  };
}

/**
 * @description Performs the nullable text helper operation for this module.
 * @param {string} value - Input value for value.
 * @returns {string | null} Result of the nullable text operation.
 */
function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * @description Performs the due date payload helper operation for this module.
 * @param {string} value - Input value for value.
 * @returns {string | null} Result of the due date payload operation.
 */
function dueDatePayload(value: string): string | null {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null;
}

/**
 * @description Performs the anchor for evidence roles helper operation for this module.
 * @param {ObligationSummary} obligation - Input value for obligation.
 * @param {readonly string[]} roles - Input value for roles.
 * @returns {ObligationSourceAnchor | undefined} Result of the anchor for evidence roles operation.
 */
function anchorForEvidenceRoles(
  obligation: ObligationSummary,
  roles: readonly string[],
): ObligationSourceAnchor | undefined {
  return (
    obligation.sourceAnchors.find(
      (anchor) => anchor.evidenceRole && roles.includes(anchor.evidenceRole),
    ) ?? obligation.sourceAnchors[0]
  );
}

/**
 * @description Renders the field source button component for the contract tracker UI.
 * @param {{ readonly anchor: ObligationSourceAnchor | undefined; readonly label: string; readonly onNavigate: (anchor: ObligationSourceAnchor) => void; }} { anchor, label, onNavigate, } - Input value for { anchor, label, on navigate, }.
 * @returns {JSX.Element} Result of the field source button operation.
 */
function FieldSourceButton({
  anchor,
  label,
  onNavigate,
}: {
  readonly anchor: ObligationSourceAnchor | undefined;
  readonly label: string;
  readonly onNavigate: (anchor: ObligationSourceAnchor) => void;
}) {
  return (
    <button
      aria-label={`Show source for ${label}`}
      className="inline-flex size-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:border-teal-500 hover:bg-teal-50 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={!anchor}
      onClick={() => {
        if (anchor) onNavigate(anchor);
      }}
      type="button"
    >
      <FileSearch aria-hidden className="size-4" />
    </button>
  );
}

/**
 * @description Renders the field label component for the contract tracker UI.
 * @param {{ readonly anchor: ObligationSourceAnchor | undefined; readonly label: string; readonly onNavigate: (anchor: ObligationSourceAnchor) => void; }} { anchor, label, onNavigate, } - Input value for { anchor, label, on navigate, }.
 * @returns {JSX.Element} Result of the field label operation.
 */
function FieldLabel({
  anchor,
  label,
  onNavigate,
}: {
  readonly anchor: ObligationSourceAnchor | undefined;
  readonly label: string;
  readonly onNavigate: (anchor: ObligationSourceAnchor) => void;
}) {
  return (
    <span className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">
      {label}
      <FieldSourceButton anchor={anchor} label={label} onNavigate={onNavigate} />
    </span>
  );
}

/**
 * @description Renders the obligation meta item component for the contract tracker UI.
 * @param {{ readonly label: string; readonly value: string; readonly helper?: string | null; }} { label, value, helper, } - Input value for { label, value, helper, }.
 * @returns {JSX.Element} Result of the obligation meta item operation.
 */
export function ObligationMetaItem({
  label,
  value,
  helper,
}: {
  readonly label: string;
  readonly value: string;
  readonly helper?: string | null;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2.5">
      <dt className="text-[11px] font-bold uppercase tracking-normal text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</dd>
      {helper ? <dd className="mt-0.5 truncate text-xs text-slate-500">{helper}</dd> : null}
    </div>
  );
}

/**
 * @description Renders the obligation source chips component for the contract tracker UI.
 * @param {{ readonly obligation: ObligationSummary }} { obligation } - Input value for { obligation }.
 * @returns {JSX.Element} Result of the obligation source chips operation.
 */
export function ObligationSourceChips({ obligation }: { readonly obligation: ObligationSummary }) {
  if (obligation.sourceAnchors.length === 0) {
    return <span className="text-sm text-slate-500">No source anchors available</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {obligation.sourceAnchors.slice(0, 5).map((anchor, index) => (
        <Link
          className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:border-teal-500 hover:bg-teal-50 hover:text-teal-800 focus-visible:shadow-focus"
          key={`${anchor.pageNumber}-${anchor.startLine ?? index}-${anchor.evidenceRole ?? "source"}`}
          state={sourceLinkState(anchor, obligation.id)}
          to={routePaths.contractDetail(obligation.contractId)}
        >
          {sourceAnchorLabel(anchor, index)}
        </Link>
      ))}
    </div>
  );
}

/**
 * @description Renders the editable obligation panel component for the contract tracker UI.
 * @param {{ readonly obligation: ObligationSummary; readonly onNavigateSource: (anchor: ObligationSourceAnchor) => void; }} { obligation, onNavigateSource, } - Input value for { obligation, on navigate source, }.
 * @returns {JSX.Element} Result of the editable obligation panel operation.
 */
export function EditableObligationPanel({
  obligation,
  onNavigateSource,
}: {
  readonly obligation: ObligationSummary;
  readonly onNavigateSource: (anchor: ObligationSourceAnchor) => void;
}) {
  const [form, setForm] = useState<ObligationEditFormState>(() =>
    obligationToFormState(obligation),
  );
  const updateObligation = useUpdateObligation(obligation.id, obligation.contractId);
  const actionAnchor = anchorForEvidenceRoles(obligation, ["ACTION", "OBJECT"]);
  const actorAnchor = anchorForEvidenceRoles(obligation, ["ACTOR"]);
  const counterpartyAnchor = anchorForEvidenceRoles(obligation, ["COUNTERPARTY"]);
  const timingAnchor = anchorForEvidenceRoles(obligation, ["TIMING"]);
  const conditionAnchor = anchorForEvidenceRoles(obligation, ["CONDITION"]);

  useEffect(() => {
    setForm(obligationToFormState(obligation));
  }, [obligation]);

  /**
   * @description Performs the set field helper operation for this module.
   * @param {Key} key - Input value for key.
   * @param {ObligationEditFormState[Key]} value - Input value for value.
   * @returns {void} Result of the set field operation.
   */
  function setField<Key extends keyof ObligationEditFormState>(
    key: Key,
    value: ObligationEditFormState[Key],
  ): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /**
   * @description Performs the submit helper operation for this module.
   * @param {FormEvent<HTMLFormElement>} event - Input value for event.
   * @returns {void} Result of the submit operation.
   */
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    updateObligation.mutate({
      obligationId: obligation.id,
      expectedVersion: obligation.version,
      title: form.title.trim(),
      description: form.description.trim(),
      dueAt: dueDatePayload(form.dueAt),
      responsibleParty: nullableText(form.responsibleParty),
      counterparty: nullableText(form.counterparty),
      category: nullableText(form.category),
      timingType: nullableText(form.timingType),
      frequency: nullableText(form.frequency),
      triggerEvent: nullableText(form.triggerEvent),
      offsetValue: form.offsetValue.trim() ? Number(form.offsetValue) : null,
      offsetUnit: nullableText(form.offsetUnit),
      offsetDirection: nullableText(form.offsetDirection),
      reviewStatus: nullableText(form.reviewStatus),
    });
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="md:col-span-2">
            <FieldLabel anchor={actionAnchor} label="Title" onNavigate={onNavigateSource} />
            <Input
              className="w-full"
              onChange={(event) => setField("title", event.target.value)}
              required
              value={form.title}
            />
          </label>
          <label className="md:col-span-2">
            <FieldLabel anchor={actionAnchor} label="Description" onNavigate={onNavigateSource} />
            <Textarea
              className="w-full"
              onChange={(event) => setField("description", event.target.value)}
              required
              value={form.description}
            />
          </label>
          <label>
            <FieldLabel anchor={timingAnchor} label="Due Date" onNavigate={onNavigateSource} />
            <Input
              className="w-full"
              onChange={(event) => setField("dueAt", event.target.value)}
              type="date"
              value={form.dueAt}
            />
          </label>
          <label>
            <FieldLabel
              anchor={actorAnchor}
              label="Responsible Party"
              onNavigate={onNavigateSource}
            />
            <Input
              className="w-full"
              onChange={(event) => setField("responsibleParty", event.target.value)}
              value={form.responsibleParty}
            />
          </label>
          <label>
            <FieldLabel
              anchor={counterpartyAnchor}
              label="Counterparty"
              onNavigate={onNavigateSource}
            />
            <Input
              className="w-full"
              onChange={(event) => setField("counterparty", event.target.value)}
              value={form.counterparty}
            />
          </label>
          <label>
            <FieldLabel anchor={actionAnchor} label="Category" onNavigate={onNavigateSource} />
            <Input
              className="w-full"
              onChange={(event) => setField("category", event.target.value)}
              value={form.category}
            />
          </label>
          <label>
            <FieldLabel anchor={timingAnchor} label="Timing Type" onNavigate={onNavigateSource} />
            <Input
              className="w-full"
              onChange={(event) => setField("timingType", event.target.value)}
              value={form.timingType}
            />
          </label>
          <label>
            <FieldLabel anchor={timingAnchor} label="Frequency" onNavigate={onNavigateSource} />
            <Input
              className="w-full"
              onChange={(event) => setField("frequency", event.target.value)}
              value={form.frequency}
            />
          </label>
          <label>
            <FieldLabel anchor={timingAnchor} label="Trigger Event" onNavigate={onNavigateSource} />
            <Input
              className="w-full"
              onChange={(event) => setField("triggerEvent", event.target.value)}
              value={form.triggerEvent}
            />
          </label>
          <label>
            <FieldLabel anchor={timingAnchor} label="Offset Value" onNavigate={onNavigateSource} />
            <Input
              className="w-full"
              onChange={(event) => setField("offsetValue", event.target.value)}
              type="number"
              value={form.offsetValue}
            />
          </label>
          <label>
            <FieldLabel anchor={timingAnchor} label="Offset Unit" onNavigate={onNavigateSource} />
            <Input
              className="w-full"
              onChange={(event) => setField("offsetUnit", event.target.value)}
              value={form.offsetUnit}
            />
          </label>
          <label>
            <FieldLabel
              anchor={timingAnchor}
              label="Offset Direction"
              onNavigate={onNavigateSource}
            />
            <Input
              className="w-full"
              onChange={(event) => setField("offsetDirection", event.target.value)}
              value={form.offsetDirection}
            />
          </label>
          <label>
            <FieldLabel
              anchor={conditionAnchor}
              label="Review Status"
              onNavigate={onNavigateSource}
            />
            <Input
              className="w-full"
              onChange={(event) => setField("reviewStatus", event.target.value)}
              value={form.reviewStatus}
            />
          </label>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md border border-slate-200 p-3">
            <dt className="flex items-center justify-between gap-2 text-xs font-semibold uppercase text-slate-500">
              Status
              <FieldSourceButton
                anchor={actionAnchor}
                label="Status"
                onNavigate={onNavigateSource}
              />
            </dt>
            <dd className="mt-2">
              <StatusBadge
                label={formatStatusLabel(obligation.status)}
                tone={statusTone(obligation.status)}
              />
            </dd>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <dt className="flex items-center justify-between gap-2 text-xs font-semibold uppercase text-slate-500">
              Confidence
              <FieldSourceButton
                anchor={actionAnchor}
                label="Confidence"
                onNavigate={onNavigateSource}
              />
            </dt>
            <dd className="mt-2">
              {typeof obligation.confidence === "number"
                ? `${Math.round(obligation.confidence * 100)}%`
                : "Unavailable"}
            </dd>
          </div>
        </dl>
        {updateObligation.error ? (
          <div className="mt-4">
            <InlineError error={updateObligation.error} />
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 justify-end border-t border-slate-200 bg-white p-4">
        <Button disabled={updateObligation.isPending} type="submit">
          {updateObligation.isPending ? <MutationSpinner /> : null}
          Save Obligation
        </Button>
      </div>
    </form>
  );
}
