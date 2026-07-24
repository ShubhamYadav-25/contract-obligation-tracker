declare module "pdfjs-dist/build/pdf.mjs" {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export function getDocument(input: unknown): {
    readonly promise: Promise<unknown>;
  };
}

declare module "pdfjs-dist/web/pdf_viewer.mjs" {
  export class EventBus {
    on(name: string, listener: (event: any) => void): void;
    dispatch(name: string, payload: unknown): void;
  }

  export class PDFLinkService {
    constructor(options: { readonly eventBus: EventBus });
    setViewer(viewer: PDFViewer): void;
    setDocument(document: unknown, baseUrl?: string | null): void;
  }

  export class PDFFindController {
    constructor(options: { readonly eventBus: EventBus; readonly linkService: PDFLinkService });
    setDocument(document: unknown): void;
  }

  export class PDFViewer {
    constructor(options: {
      readonly container: HTMLDivElement;
      readonly viewer: HTMLDivElement;
      readonly eventBus: EventBus;
      readonly linkService: PDFLinkService;
      readonly findController: PDFFindController;
      readonly removePageBorders?: boolean;
    });
    currentPageNumber: number;
    currentScaleValue: string;
    setDocument(document: unknown): void;
    scrollPageIntoView(input: { readonly pageNumber: number }): void;
  }
}
