/**
 * @file Defines backend obligations module contracts, services, routes, or persistence logic.
 */
import { z } from "zod";

export const obligationStatusSchema = z.enum(["UPCOMING", "DUE", "MET", "MISSED"]);

export const transitionObligationSchema = z.object({
  toStatus: obligationStatusSchema,
  expectedVersion: z.number().int().nonnegative(),
});

const nullableTrimmedString = z.union([z.string().trim().min(1).max(500), z.null()]).optional();

export const updateObligationSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(280).optional(),
  description: z.string().trim().min(1).max(10_000).optional(),
  dueAt: z.union([z.string().datetime({ offset: true }), z.null()]).optional(),
  responsibleParty: nullableTrimmedString,
  counterparty: nullableTrimmedString,
  category: nullableTrimmedString,
  timingType: nullableTrimmedString,
  frequency: nullableTrimmedString,
  triggerEvent: nullableTrimmedString,
  offsetValue: z.number().finite().nullable().optional(),
  offsetUnit: nullableTrimmedString,
  offsetDirection: nullableTrimmedString,
  reviewStatus: nullableTrimmedString,
});
