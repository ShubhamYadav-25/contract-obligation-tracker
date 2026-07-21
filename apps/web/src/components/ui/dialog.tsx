import type { PropsWithChildren } from "react";

import { Button } from "./button.js";

interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
}

export function Dialog({ children, onClose, open, title }: PropsWithChildren<DialogProps>) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation">
      <section
        aria-modal="true"
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
        role="dialog"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button aria-label="Close dialog" onClick={onClose} type="button" variant="ghost">
            Close
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}
