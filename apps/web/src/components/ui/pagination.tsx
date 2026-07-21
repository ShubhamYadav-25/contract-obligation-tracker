import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "./button.js";

export function Pagination({
  canGoNext,
  canGoPrevious,
  onNext,
  onPrevious,
}: {
  readonly canGoNext: boolean;
  readonly canGoPrevious: boolean;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
}) {
  return (
    <nav aria-label="Pagination" className="flex items-center gap-2">
      <Button
        aria-label="Previous page"
        disabled={!canGoPrevious}
        onClick={onPrevious}
        type="button"
        variant="secondary"
      >
        <ChevronLeft aria-hidden size={16} />
      </Button>
      <Button
        aria-label="Next page"
        disabled={!canGoNext}
        onClick={onNext}
        type="button"
        variant="secondary"
      >
        <ChevronRight aria-hidden size={16} />
      </Button>
    </nav>
  );
}
