import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { loadEnv, type ApiEnv } from "../config/env.js";
import type { Logger } from "../config/logger.js";
import {
  classifyGeminiDoctorError,
  DEFAULT_FREE_MODEL_CANDIDATES,
  GeminiStructuredLlmClient,
  type GeminiErrorCategory,
  type ModelSelectionAttempt,
  type ModelSelectionResult,
} from "../infrastructure/llm/gemini-structured-llm.client.js";
import { ExternalServiceError } from "../shared/errors/external-service-error.js";

type GeminiSdkLoader = ConstructorParameters<typeof GeminiStructuredLlmClient>[0]["sdkLoader"];

export type GeminiDoctorErrorCode = GeminiErrorCategory;

export interface GeminiDoctorReport {
  readonly generatedAt: string;
  readonly status: "passed" | "failed";
  readonly configuration: ReturnType<typeof buildGeminiConfigurationDiagnostic>;
  readonly modelListing: {
    readonly requestSucceeded: boolean;
    readonly modelsReturned: number;
    readonly generateContentCapableModels: readonly string[];
    readonly warning: string | null;
  };
  readonly preflight: {
    readonly candidateModels: readonly string[];
    readonly attemptedModels: readonly ModelSelectionAttempt[];
    readonly selectedModel: string | null;
    readonly selectionSource: ModelSelectionResult["selectionSource"] | null;
    readonly structuredOutputValidated: boolean;
  };
  readonly error: {
    readonly code: GeminiDoctorErrorCode;
    readonly message: string;
  } | null;
}

export function buildGeminiConfigurationDiagnostic(env: ApiEnv): {
  readonly extractorMode: ApiEnv["OBLIGATION_EXTRACTOR_MODE"];
  readonly apiKeyConfigured: boolean;
  readonly configuredModel: string | "automatic";
  readonly timeoutMilliseconds: number;
  readonly maxAttempts: number;
  readonly minRequestIntervalMilliseconds: number;
  readonly credentialSourceName: "GEMINI_API_KEY" | null;
  readonly googleApiKeyAlsoPresent: boolean;
} {
  return {
    extractorMode: env.OBLIGATION_EXTRACTOR_MODE,
    apiKeyConfigured: Boolean(env.GEMINI_API_KEY),
    configuredModel: env.GEMINI_MODEL ?? "automatic",
    timeoutMilliseconds: env.GEMINI_REQUEST_TIMEOUT_MS,
    maxAttempts: env.GEMINI_MAX_ATTEMPTS,
    minRequestIntervalMilliseconds: env.GEMINI_MIN_REQUEST_INTERVAL_MS,
    credentialSourceName: env.GEMINI_API_KEY ? "GEMINI_API_KEY" : null,
    googleApiKeyAlsoPresent: Boolean(env.GOOGLE_API_KEY),
  };
}

function errorMessageFor(code: GeminiDoctorErrorCode): string {
  if (code === "AUTHENTICATION_ERROR") {
    return "Gemini authentication failed. Replace the local GEMINI_API_KEY and revoke the invalid or exposed key.";
  }
  if (code === "MODEL_NOT_AVAILABLE") {
    return "No Gemini model candidate passed structured preflight.";
  }
  if (code === "RATE_LIMITED") {
    return "Gemini request was rate limited.";
  }
  if (code === "NETWORK_ERROR") {
    return "Gemini request failed due to network access.";
  }
  if (code === "SCHEMA_NOT_SUPPORTED") {
    return "Gemini candidate did not accept the structured-output schema request.";
  }
  if (code === "INVALID_RESPONSE") {
    return "Gemini returned a response that failed deterministic structured parsing.";
  }
  return "Gemini diagnostic failed with an unknown error.";
}

function failedSelectionDetails(error: unknown): {
  readonly attemptedModels: readonly ModelSelectionAttempt[];
  readonly listedModels: readonly string[];
  readonly generateContentCapableModels: readonly string[];
} {
  if (!(error instanceof ExternalServiceError)) {
    return {
      attemptedModels: [],
      listedModels: [],
      generateContentCapableModels: [],
    };
  }

  const details = error.details as {
    readonly attemptedModels?: readonly ModelSelectionAttempt[];
    readonly listedModels?: readonly string[];
    readonly generateContentCapableModels?: readonly string[];
  };
  return {
    attemptedModels: details.attemptedModels ?? [],
    listedModels: details.listedModels ?? [],
    generateContentCapableModels: details.generateContentCapableModels ?? [],
  };
}

const quietLogger: Logger = {
  info() {},
  warn() {},
  error() {},
};

export async function runGeminiDoctor(input: {
  readonly env: ApiEnv;
  readonly sdkLoader?: GeminiSdkLoader;
  readonly logger?: Logger;
  readonly now?: () => Date;
}): Promise<GeminiDoctorReport> {
  const configuration = buildGeminiConfigurationDiagnostic(input.env);
  const client = new GeminiStructuredLlmClient({
    env: input.env,
    logger: input.logger ?? quietLogger,
    ...(input.sdkLoader ? { sdkLoader: input.sdkLoader } : {}),
  });

  try {
    const selection = await client.selectUsableModel();
    return {
      generatedAt: (input.now ?? (() => new Date()))().toISOString(),
      status: "passed",
      configuration,
      modelListing: {
        requestSucceeded: selection.listingSucceeded,
        modelsReturned: selection.listedModels.length,
        generateContentCapableModels: selection.generateContentCapableModels,
        warning: selection.listingHadSupportedActions
          ? null
          : "models.list returned no supportedActions; direct structured preflight selected the usable model.",
      },
      preflight: {
        candidateModels: client.getCandidateModels(),
        attemptedModels: selection.attemptedModels,
        selectedModel: selection.selectedModel,
        selectionSource: selection.selectionSource,
        structuredOutputValidated: true,
      },
      error: null,
    };
  } catch (error) {
    const code = classifyGeminiDoctorError(error);
    const failedDetails = failedSelectionDetails(error);
    return {
      generatedAt: (input.now ?? (() => new Date()))().toISOString(),
      status: "failed",
      configuration,
      modelListing: {
        requestSucceeded: code !== "AUTHENTICATION_ERROR" && code !== "NETWORK_ERROR",
        modelsReturned: failedDetails.listedModels.length,
        generateContentCapableModels: failedDetails.generateContentCapableModels,
        warning: null,
      },
      preflight: {
        candidateModels: client.getCandidateModels(),
        attemptedModels: failedDetails.attemptedModels,
        selectedModel: null,
        selectionSource: null,
        structuredOutputValidated: false,
      },
      error: {
        code,
        message: errorMessageFor(code),
      },
    };
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  const report = await runGeminiDoctor({ env });
  const outDir = resolve(join("..", "..", "dev-output", "reference-aware-working-app"));
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "gemini-doctor.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    const code = classifyGeminiDoctorError(error);
    console.error(
      JSON.stringify({
        status: "failed",
        candidates: DEFAULT_FREE_MODEL_CANDIDATES,
        error: {
          code,
          message: errorMessageFor(code),
        },
      }),
    );
    process.exitCode = 1;
  });
}
