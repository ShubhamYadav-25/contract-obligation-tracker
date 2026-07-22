import {
  ChevronLeft,
  ChevronRight,
  FileWarning,
  Highlighter,
  Loader2,
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

import { getApiBaseUrl, getDevAuthHeaders } from "../../services/api-client.js";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const pdfUrl = useMemo(() => getPdfUrl(contractId), [contractId]);

  const clearHighlights = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll(".source-anchor-highlight").forEach((element) => element.remove());
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
      for (const box of command.payload.boxes) {
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
        const task = pdfjsLib.getDocument({
          url: pdfUrl,
          httpHeaders: getDevAuthHeaders(),
          withCredentials: true,
          rangeChunkSize: 65_536,
          disableStream: false,
          disableAutoFetch: false,
        });
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
        if (!disposed) setError(loadError);
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void loadDocument();

    return () => {
      disposed = true;
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

  return (
    <section className="pdf-source-shell" aria-label="Contract PDF viewer">
      <div className="pdf-source-toolbar">
        <div className="flex items-center gap-2">
          <Button
            aria-label="Previous page"
            disabled={pageNumber <= 1 || loading}
            onClick={() => goToPage(pageNumber - 1)}
            type="button"
            variant="secondary"
          >
            <ChevronLeft aria-hidden size={16} />
          </Button>
          <Input
            aria-label="PDF page number"
            className="h-9 w-16"
            min={1}
            max={pageCount || 1}
            onChange={(event) => goToPage(Number(event.target.value))}
            type="number"
            value={pageNumber}
          />
          <span className="text-sm text-muted">/ {pageCount || "..."}</span>
          <Button
            aria-label="Next page"
            disabled={pageCount === 0 || pageNumber >= pageCount || loading}
            onClick={() => goToPage(pageNumber + 1)}
            type="button"
            variant="secondary"
          >
            <ChevronRight aria-hidden size={16} />
          </Button>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Search aria-hidden className="shrink-0 text-muted" size={16} />
          <Input
            aria-label="Search PDF text"
            className="h-9 min-w-32"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") runSearch(event.shiftKey);
            }}
            placeholder="Search PDF"
            value={query}
          />
          <Button disabled={!query} onClick={() => runSearch(false)} type="button" variant="secondary">
            Find
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Zoom out"
            disabled={loading}
            onClick={() => changeZoom(-1)}
            type="button"
            variant="secondary"
          >
            <ZoomOut aria-hidden size={16} />
          </Button>
          <span className="w-20 text-center text-sm text-muted">
            {zoom === "page-width" ? "Width" : `${Math.round(Number(zoom) * 100)}%`}
          </span>
          <Button
            aria-label="Zoom in"
            disabled={loading}
            onClick={() => changeZoom(1)}
            type="button"
            variant="secondary"
          >
            <ZoomIn aria-hidden size={16} />
          </Button>
        </div>
      </div>

      <div className="pdf-source-body">
        <aside className="pdf-source-sidebar" aria-label="PDF page navigation">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => (
            <button
              className={item === pageNumber ? "pdf-source-page-link active" : "pdf-source-page-link"}
              key={item}
              onClick={() => goToPage(item)}
              type="button"
            >
              <span>Page</span>
              <strong>{item}</strong>
            </button>
          ))}
        </aside>
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
            {!loading && !error ? (
              <div className="pdf-source-hint">
                <Highlighter aria-hidden size={14} />
                <span>Source highlights fade automatically after navigation.</span>
              </div>
            ) : null}
            <div className="pdfViewer" ref={viewerRef} />
          </div>
        </div>
      </div>
    </section>
  );
}
