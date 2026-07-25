/**
 * @file Defines shared API errors, middleware, validation, or boundary types.
 */
import { z } from "zod";

export const idSchema = z.uuid();
