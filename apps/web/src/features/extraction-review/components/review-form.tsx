/**
 * @file Defines feature-specific React UI components for the contract tracker.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, X } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Textarea } from "@/components/ui/textarea.js";
import { reviewFormSchema } from "../schemas/review-form.schema.js";
import type { ReviewFormValues } from "../schemas/review-form.schema.js";

/**
 * @description Renders the review form component for the contract tracker UI.
 * @param {{ readonly defaultValues: ReviewFormValues; readonly disabled?: boolean; readonly onApprove: (values: ReviewFormValues) => void; readonly onReject: (reason: string) => void; }} { defaultValues, disabled = false, onApprove, onReject, } - Input value for { default values, disabled = false, on approve, on reject, }.
 * @returns {JSX.Element} Result of the review form operation.
 */
export function ReviewForm({
  defaultValues,
  disabled = false,
  onApprove,
  onReject,
}: {
  readonly defaultValues: ReviewFormValues;
  readonly disabled?: boolean;
  readonly onApprove: (values: ReviewFormValues) => void;
  readonly onReject: (reason: string) => void;
}) {
  const form = useForm<ReviewFormValues>({
    defaultValues,
    resolver: zodResolver(reviewFormSchema),
  });

  const submitApprove = form.handleSubmit((values) => onApprove(values));
  const submitReject = form.handleSubmit((values) => onReject(values.reason ?? ""));

  return (
    <form className="space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="review-title">
          Title
        </label>
        <Input className="mt-2 w-full" id="review-title" {...form.register("title")} />
        {form.formState.errors.title ? (
          <p className="mt-1 text-sm text-red-700">{form.formState.errors.title.message}</p>
        ) : null}
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="review-description">
          Description
        </label>
        <Textarea
          className="mt-2 w-full"
          id="review-description"
          {...form.register("description")}
        />
        {form.formState.errors.description ? (
          <p className="mt-1 text-sm text-red-700">{form.formState.errors.description.message}</p>
        ) : null}
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="review-reason">
          Review reason
        </label>
        <Textarea className="mt-2 w-full" id="review-reason" {...form.register("reason")} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled} onClick={(event) => void submitApprove(event)} type="button">
          <Check aria-hidden size={16} />
          Approve
        </Button>
        <Button
          disabled={disabled}
          onClick={(event) => void submitReject(event)}
          type="button"
          variant="danger"
        >
          <X aria-hidden size={16} />
          Reject
        </Button>
      </div>
    </form>
  );
}
