import {
  ChevronLeft,
  ChevronRight,
  FileWarning,
  Loader2,
  Maximize2,
  Minimize2,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import {
  EventBus,
  PDFFindController,
  PDFLinkService,
  PDFViewer,
} from "pdfjs-dist/web/pdf_viewer.mjs";
import "pdfjs-dist/web/pdf_viewer.css";

import { getApiBaseUrl, getDevAuthHeaders } from "@/services/api-client.js";
import { cx } from "@/utils/cx.js";
import {
  isPdfSourceNavigationCommand,
  toHighlightRect,
  type PdfSourceNavigationCommand,
} from "./pdf-source-navigation.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

type PdfDocumentProxy = {
  readonly numPages: number;
  readonly destroy?: () => Promise<void> | void;
};

type PdfViewerInstance = InstanceType<typeof PDFViewer>;
type EventBusInstance = InstanceType<typeof EventBus>;

const zoomSteps = ["page-width", "0.75", "1", "1.25", "1.5", "2"] as const;

function getPdfUrl(contractId: string): string {
  return `${getApiBaseUrl()}/api/v1/contracts/${contractId}/document.pdf`;
}

function isAuthorizationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(401|403|unauthorized|forbidden|AUTHENTICATION_REQUIRED)\b/i.test(message);
}

function isMissingDocumentError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(404|not found|CONTRACT_DOCUMENT_NOT_FOUND)\b/i.test(message);
}

function isExpiredDocumentLinkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(expired|signed url|signed-url|token expired)\b/i.test(message);
}

function errorTitle(error: unknown): string {
  if (isAuthorizationError(error)) return "Authorization required";
  if (isExpiredDocumentLinkError(error)) return "Document link expired";
  if (isMissingDocumentError(error)) return "PDF document is missing";
  return "PDF rendering failed";
}

async function waitForPageElement(
  container: HTMLDivElement,
  pageNumber: number,
): Promise<HTMLElement> {
  const selector = `.page[data-page-number="${pageNumber}"]`;
  for (let index = 0; index < 80; index += 1) {
    const page = container.querySelector<HTMLElement>(selector);
    if (page?.querySelector("canvas")) return page;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  const page = container.querySelector<HTMLElement>(selector);
  if (page) return page;
  throw new Error(`Page ${pageNumber} was not rendered by PDF.js`);
}

async function fetchPdfBytes(pdfUrl: string, signal: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(pdfUrl, {
    headers: getDevAuthHeaders(),
    credentials: "include",
    signal,
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(message || `PDF request failed with status ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function destroyPdfDocument(document: PdfDocumentProxy | null): void {
  if (typeof document?.destroy !== "function") return;
  Promise.resolve(document.destroy()).catch(() => undefined);
}

export function PdfViewerContainer({
  contractId,
  initialPage = 1,
  sourceCommand,
}: {
  readonly contractId: string;
  readonly initialPage?: number;
  readonly sourceCommand?: PdfSourceNavigationCommand | null | undefined;
}) {
  const shellRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const eventBusRef = useRef<EventBusInstance | null>(null);
  const pdfViewerRef = useRef<PdfViewerInstance | null>(null);
  const pdfDocumentRef = useRef<PdfDocumentProxy | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState<(typeof zoomSteps)[number]>("page-width");
  const [query, setQuery] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const pdfUrl = useMemo(() => getPdfUrl(contractId), [contractId]);

  const clearHighlights = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    container
      .querySelectorAll(".source-anchor-highlight, .source-anchor-callout")
      .forEach((element) => element.remove());
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, []);

  const drawHighlights = useCallback(
    async (command: PdfSourceNavigationCommand) => {
      const container = containerRef.current;
      const pdfViewer = pdfViewerRef.current;
      if (!container || !pdfViewer) return;

      const pageNumberToOpen = command.payload.pageNumber;
      pdfViewer.currentPageNumber = pageNumberToOpen;
      pdfViewer.scrollPageIntoView({ pageNumber: pageNumberToOpen });

      const page = await waitForPageElement(container, pageNumberToOpen);
      const firstBox = command.payload.boxes[0];
      if (firstBox) {
        container.scrollTo({
          top: page.offsetTop + firstBox.y * page.clientHeight - container.clientHeight * 0.25,
          behavior: "smooth",
        });
      }

      clearHighlights();
      for (const [index, box] of command.payload.boxes.entries()) {
        const rect = toHighlightRect(box);
        const highlight = document.createElement("div");
        highlight.className = "source-anchor-highlight";
        Object.assign(highlight.style, {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        });
        page.appendChild(highlight);

        if (index === 0 && command.payload.quotedText) {
          const callout = document.createElement("div");
          callout.className = "source-anchor-callout";
          callout.textContent = `P${command.payload.pageNumber}:L${command.payload.startLine ?? "?"}-${
            command.payload.endLine ?? command.payload.startLine ?? "?"
          } ${command.payload.quotedText}`;
          Object.assign(callout.style, {
            left: `min(${Math.max(0, Math.min(0.72, box.x + box.width + 0.015)) * 100}%, calc(100% - 260px))`,
            top: `${Math.max(0.02, box.y - 0.02) * 100}%`,
          });
          page.appendChild(callout);
        }
      }
      highlightTimeoutRef.current = window.setTimeout(clearHighlights, 5_000);
    },
    [clearHighlights],
  );

  useEffect(() => {
    const container = containerRef.current;
    const viewer = viewerRef.current;
    if (!container || !viewer) return;

    let disposed = false;
    const abortController = new AbortController();
    const eventBus = new EventBus();
    const linkService = new PDFLinkService({ eventBus });
    const findController = new PDFFindController({ eventBus, linkService });
    const pdfViewer = new PDFViewer({
      container,
      viewer,
      eventBus,
      linkService,
      findController,
      removePageBorders: true,
    });

    eventBusRef.current = eventBus;
    pdfViewerRef.current = pdfViewer;
    linkService.setViewer(pdfViewer);

    eventBus.on("pagechanging", (event: { readonly pageNumber: number }) => {
      setPageNumber(event.pageNumber);
    });
    eventBus.on("pagesinit", () => {
      pdfViewer.currentScaleValue = zoom;
      pdfViewer.currentPageNumber = Math.max(1, initialPage);
    });

    async function loadDocument() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPdfBytes(pdfUrl, abortController.signal);
        const task = pdfjsLib.getDocument({ data });
        const document = (await task.promise) as PdfDocumentProxy;
        if (disposed) {
          destroyPdfDocument(document);
          return;
        }
        pdfDocumentRef.current = document;
        setPageCount(document.numPages);
        linkService.setDocument(document, null);
        findController.setDocument(document);
        pdfViewer.setDocument(document);
      } catch (loadError) {
        if (!disposed && !abortController.signal.aborted) setError(loadError);
      } finally {
        if (!disposed && !abortController.signal.aborted) setLoading(false);
      }
    }

    void loadDocument();

    return () => {
      disposed = true;
      abortController.abort();
      clearHighlights();
      pdfViewer.setDocument(null);
      destroyPdfDocument(pdfDocumentRef.current);
      pdfDocumentRef.current = null;
      eventBusRef.current = null;
      pdfViewerRef.current = null;
    };
  }, [clearHighlights, initialPage, pdfUrl, zoom]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isPdfSourceNavigationCommand(event.data)) return;
      void drawHighlights(event.data);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [drawHighlights]);

  useEffect(() => {
    if (!sourceCommand || loading || error) return;
    void drawHighlights(sourceCommand);
  }, [drawHighlights, error, loading, sourceCommand]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const goToPage = useCallback(
    (nextPage: number) => {
      const pdfViewer = pdfViewerRef.current;
      if (!pdfViewer || pageCount === 0) return;
      const bounded = Math.max(1, Math.min(pageCount, nextPage));
      pdfViewer.currentPageNumber = bounded;
      setPageNumber(bounded);
    },
    [pageCount],
  );

  const changeZoom = useCallback(
    (direction: -1 | 1) => {
      const currentIndex = Math.max(0, zoomSteps.indexOf(zoom));
      const nextZoom =
        zoomSteps[Math.max(0, Math.min(zoomSteps.length - 1, currentIndex + direction))] ??
        "page-width";
      setZoom(nextZoom);
      if (pdfViewerRef.current) {
        pdfViewerRef.current.currentScaleValue = nextZoom;
      }
    },
    [zoom],
  );

  const fitToWidth = useCallback(() => {
    setZoom("page-width");
    if (pdfViewerRef.current) {
      pdfViewerRef.current.currentScaleValue = "page-width";
    }
  }, []);

  const runSearch = useCallback(
    (findPrevious = false) => {
      eventBusRef.current?.dispatch("find", {
        source: window,
        type: "again",
        query,
        phraseSearch: true,
        caseSensitive: false,
        entireWord: false,
        highlightAll: true,
        findPrevious,
        matchDiacritics: true,
      });
    },
    [query],
  );

  const toggleFullscreen = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement === shell) {
      void document.exitFullscreen();
      return;
    }
    void shell.requestFullscreen();
  }, []);

  const readerButtonClassName =
    "inline-flex size-9 items-center justify-center rounded-md text-slate-700 transition hover:bg-slate-100 focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-45";

  return (
    <section
      className={cx("pdf-source-shell", fullscreen ? "pdf-source-shell-fullscreen" : "")}
      ref={shellRef}
      aria-label="Contract PDF viewer"
    >
      <div className="pdf-reader-toolbar" aria-label="PDF reader controls">
        <div className="pdf-reader-control-group">
          <button
            aria-label="Previous page"
            className={readerButtonClassName}
            disabled={pageNumber <= 1 || loading}
            onClick={() => goToPage(pageNumber - 1)}
            type="button"
          >
            <ChevronLeft aria-hidden size={16} />
          </button>
          <label className="pdf-reader-page-jump">
            <span>Page</span>
            <input
              aria-label="PDF page number"
              disabled={loading || pageCount === 0}
              inputMode="numeric"
              max={pageCount || 1}
              min={1}
              onChange={(event) => goToPage(Number(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  goToPage(pageNumber + 1);
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  goToPage(pageNumber - 1);
                }
              }}
              type="number"
              value={pageNumber}
            />
            <span>/ {pageCount || "..."}</span>
          </label>
          <button
            aria-label="Next page"
            className={readerButtonClassName}
            disabled={pageCount === 0 || pageNumber >= pageCount || loading}
            onClick={() => goToPage(pageNumber + 1)}
            type="button"
          >
            <ChevronRight aria-hidden size={16} />
          </button>
        </div>
        <div className="pdf-reader-search">
          <Search aria-hidden className="shrink-0 text-slate-500" size={16} />
          <input
            aria-label="Search PDF text"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") runSearch(event.shiftKey);
            }}
            placeholder="Search PDF"
            value={query}
          />
          <button disabled={!query} onClick={() => runSearch(false)} type="button">
            Find
          </button>
        </div>
        <div className="pdf-reader-control-group">
          <button
            aria-label="Zoom out"
            className={readerButtonClassName}
            disabled={loading}
            onClick={() => changeZoom(-1)}
            type="button"
          >
            <ZoomOut aria-hidden size={16} />
          </button>
          <button
            aria-label="Fit to width"
            className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-45"
            disabled={loading}
            onClick={fitToWidth}
            type="button"
          >
            {zoom === "page-width" ? "Width" : `${Math.round(Number(zoom) * 100)}%`}
          </button>
          <button
            aria-label="Zoom in"
            className={readerButtonClassName}
            disabled={loading}
            onClick={() => changeZoom(1)}
            type="button"
          >
            <ZoomIn aria-hidden size={16} />
          </button>
          <button
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className={readerButtonClassName}
            onClick={toggleFullscreen}
            type="button"
          >
            {fullscreen ? <Minimize2 aria-hidden size={16} /> : <Maximize2 aria-hidden size={16} />}
          </button>
        </div>
      </div>

      <div className="pdf-source-body">
        <div className="pdf-source-main">
          <div className="pdf-source-viewer" ref={containerRef}>
            {loading ? (
              <div className="pdf-source-state">
                <Loader2 aria-hidden className="animate-spin" size={22} />
                <span>Loading PDF stream</span>
              </div>
            ) : null}
            {error ? (
              <div className="pdf-source-state error">
                <FileWarning aria-hidden size={24} />
                <strong>{errorTitle(error)}</strong>
                <span>
                  {error instanceof Error
                    ? error.message
                    : "The PDF could not be opened from the authenticated document endpoint."}
                </span>
              </div>
            ) : null}
            <div className="pdfViewer" ref={viewerRef} />
          </div>
          <div className="pdf-reader-page-indicator" aria-live="polite">
            {pageCount > 0 ? `${pageNumber} of ${pageCount}` : "Loading"}
          </div>
        </div>
      </div>
    </section>
  );
}
