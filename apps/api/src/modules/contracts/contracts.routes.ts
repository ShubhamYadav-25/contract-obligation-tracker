import { Router, type RequestHandler } from "express";
import multer, { MulterError } from "multer";

import { loadEnv } from "../../config/env.js";
import { requireAuthContext } from "../auth/request-context.js";
import { asyncRoute } from "../../shared/middleware/async-route.js";
import { ContractIngestionError } from "./contract-ingestion.errors.js";
import {
  ContractController,
  type ContractIngestionServiceFactory,
} from "./contracts.controller.js";
import { createContractIngestionService } from "./contracts.dependencies.js";

export function createContractRouter(
  createService: ContractIngestionServiceFactory = createContractIngestionService,
): Router {
  const env = loadEnv();
  const router = Router();
  const controller = new ContractController(createService);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: env.CONTRACT_MAX_FILE_SIZE_MB * 1024 * 1024,
      files: 1,
    },
  });
  const uploadSingleContract: RequestHandler = (request, response, next) => {
    upload.single("file")(request, response, (error: unknown) => {
      if (error instanceof MulterError && error.code === "LIMIT_FILE_SIZE") {
        next(
          new ContractIngestionError("FILE_TOO_LARGE", "Contract PDF exceeds size limit", 413, {
            maxFileSizeBytes: env.CONTRACT_MAX_FILE_SIZE_MB * 1024 * 1024,
          }),
        );
        return;
      }
      next(error);
    });
  };

  router.post(
    "/",
    requireAuthContext,
    uploadSingleContract,
    asyncRoute((request, response) => controller.ingest(request, response)),
  );
  router.get(
    "/:contractId/processing-status",
    requireAuthContext,
    asyncRoute((request, response) => controller.processingStatus(request, response)),
  );

  return router;
}
