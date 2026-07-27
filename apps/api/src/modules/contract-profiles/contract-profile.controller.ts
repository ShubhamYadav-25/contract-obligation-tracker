import type { Request, Response } from "express";
import { z } from "zod";

import { ApplicationError } from "../../shared/errors/application-error.js";
import type { ContractProfileRepository } from "./contract-profile.repository.js";
import {
  contractProfileFieldsSchema,
  updateContractProfileSchema,
} from "./contract-profile.schemas.js";
import type { ContractProfile } from "./contract-profile.types.js";
import type { ContractProfileFields } from "./contract-profile.types.js";

const paramsSchema = z.object({ contractId: z.uuid() });

function serialize(profile: ContractProfile) {
  return {
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function context(request: Request) {
  if (!request.authContext) {
    throw new ApplicationError({
      code: "AUTHENTICATION_REQUIRED",
      message: "Authenticated user and organization context is required",
      statusCode: 401,
    });
  }
  return request.authContext;
}

function profileNotFound(contractId: string): ApplicationError {
  return new ApplicationError({
    code: "CONTRACT_PROFILE_NOT_FOUND",
    message: "Contract profile not found",
    statusCode: 404,
    details: { contractId },
  });
}

export class ContractProfileController {
  constructor(private readonly profiles: ContractProfileRepository) {}

  async get(request: Request, response: Response): Promise<void> {
    const auth = context(request);
    const { contractId } = paramsSchema.parse(request.params);
    const profile = await this.profiles.find({
      organizationId: auth.organizationId,
      contractId,
    });
    if (!profile) throw profileNotFound(contractId);
    response.json({ success: true, data: serialize(profile) });
  }

  async create(request: Request, response: Response): Promise<void> {
    const auth = context(request);
    const { contractId } = paramsSchema.parse(request.params);
    const fields = contractProfileFieldsSchema.parse(request.body);
    try {
      const profile = await this.profiles.create({
        organizationId: auth.organizationId,
        contractId,
        fields,
      });
      response.status(201).json({ success: true, data: serialize(profile) });
    } catch (error: unknown) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { readonly code?: unknown }).code)
          : "";
      if (code === "23505") {
        throw new ApplicationError({
          code: "CONTRACT_PROFILE_EXISTS",
          message: "A profile already exists for this contract",
          statusCode: 409,
          details: { contractId },
        });
      }
      if (error instanceof Error && error.message === "CONTRACT_NOT_FOUND") {
        throw new ApplicationError({
          code: "CONTRACT_NOT_FOUND",
          message: "Contract not found",
          statusCode: 404,
          details: { contractId },
        });
      }
      throw error;
    }
  }

  async update(request: Request, response: Response): Promise<void> {
    const auth = context(request);
    const { contractId } = paramsSchema.parse(request.params);
    const parsedFields = updateContractProfileSchema.parse(request.body);
    const fields = Object.fromEntries(
      Object.entries(parsedFields).filter((entry) => entry[1] !== undefined),
    ) as Partial<ContractProfileFields>;
    const profile = await this.profiles.update({
      organizationId: auth.organizationId,
      contractId,
      fields,
    });
    if (!profile) throw profileNotFound(contractId);
    response.json({ success: true, data: serialize(profile) });
  }

  async delete(request: Request, response: Response): Promise<void> {
    const auth = context(request);
    const { contractId } = paramsSchema.parse(request.params);
    const deleted = await this.profiles.delete({
      organizationId: auth.organizationId,
      contractId,
    });
    if (!deleted) throw profileNotFound(contractId);
    response.status(204).send();
  }
}
