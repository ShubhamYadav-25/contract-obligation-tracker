import type { Request, Response } from "express";
import { z } from "zod";
import { ApplicationError } from "../../shared/errors/application-error.js";
import type { OperationsReadRepository } from "../operations/operations.repository.js";

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

export class DashboardController {
  constructor(private readonly operations: OperationsReadRepository) {}

  async overview(request: Request, response: Response): Promise<void> {
    const data = await this.operations.overview(organizationId(request));
    response.json({
      success: true,
      data,
      meta: { requestId: String(response.locals.correlationId ?? "unknown") },
    });
  }

  async reviewQueue(request: Request, response: Response): Promise<void> {
    const page = pageSchema.parse(request.query);
    const data = await this.operations.reviewQueue(
      organizationId(request),
      page.limit,
      page.offset,
    );
    response.json({
      success: true,
      data,
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
        ...page,
      },
    });
  }
}
