import { z } from "zod";

export const reviewFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  reason: z.string().max(500, "Reason must be 500 characters or fewer").optional(),
});

export type ReviewFormValues = z.infer<typeof reviewFormSchema>;
