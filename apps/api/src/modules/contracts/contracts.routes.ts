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
      if (error instanceof MulterError) {
        next(
          new ContractIngestionError(
            "MALFORMED_MULTIPART",
            "Contract upload request is malformed",
            400,
          ),
        );
        return;
      }
      next(error);
    });
  };

  router.get(
    "/",
    requireAuthContext,
    asyncRoute((request, response) => controller.list(request, response)),
  );
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
  router.get(
    "/:contractId/text-pages",
    requireAuthContext,
    asyncRoute((request, response) => controller.textPages(request, response)),
  );
  router.get(
    "/:contractId",
    requireAuthContext,
    asyncRoute((request, response) => controller.detail(request, response)),
  );

  router.post(
    "/:contractId/run-deterministic-extraction",
    requireAuthContext,
    asyncRoute(async (request, response) => {
      const { createContractIngestionService } = await import("./contracts.dependencies.js");
      const { DeterministicExtractor } = await import("../extraction/deterministic-extractor.js");
      const service = createContractIngestionService();
      const contractId = Array.isArray(request.params.contractId)
        ? request.params.contractId[0] ?? ""
        : request.params.contractId ?? "";
      const orgId = request.authContext?.organizationId;
      if (!orgId) {
        response.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
        return;
      }

      const pages = await service.listDocumentTextPages({ organizationId: orgId, contractId });
      // pages: DocumentTextPageRecord[] -> map to shape expected
      const simplePages = pages.map((p: any) => ({ pageNumber: p.pageNumber, rawText: p.rawText }));

      const extractor = new DeterministicExtractor();
      const result = await extractor.run({
        contractId: contractId ?? "",
        documentId: (pages[0] && pages[0].documentId) || "",
        pages: simplePages,
      });

      response.status(200).json({
        approvedCount: result.promoted ? 1 : 0,
        candidateCount: result.candidate ? 1 : 0,
      });
    }),
  );

  return router;
}
