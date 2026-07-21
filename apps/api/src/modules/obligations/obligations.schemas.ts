import { z } from "zod";

export const obligationStatusSchema = z.enum(["UPCOMING", "DUE", "MET", "MISSED"]);

export const transitionObligationSchema = z.object({
  toStatus: obligationStatusSchema,
  expectedVersion: z.number().int().nonnegative(),
});
