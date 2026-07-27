import type { Request, Response } from "express";
import { z } from "zod";
import { ApplicationError } from "../../shared/errors/application-error.js";
import type { OperationsReadRepository } from "./operations.repository.js";

const paramsSchema = z.object({ contractId: z.uuid() });
const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function organizationId(request: Request): string {
  if (!request.authContext) {
    throw new ApplicationError({
      code: "AUTHENTICATION_REQUIRED",
      message: "Authenticated user and organization context is required",
      statusCode: 401,
    });
  }
  return request.authContext.organizationId;
}

export class OperationsController {
  constructor(private readonly operations: OperationsReadRepository) {}

  async processingHistory(request: Request, response: Response) {
    const { contractId } = paramsSchema.parse(request.params);
    const items = await this.operations.processingHistory(organizationId(request), contractId);
    response.json({ success: true, data: { items, total: items.length } });
  }

  async activity(request: Request, response: Response) {
    const { contractId } = paramsSchema.parse(request.params);
    const page = pageSchema.parse(request.query);
    const data = await this.operations.activity(
      organizationId(request), contractId, page.limit, page.offset,
    );
    response.json({ success: true, data, meta: page });
  }
}
