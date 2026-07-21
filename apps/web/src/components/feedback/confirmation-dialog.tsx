import type { PropsWithChildren } from "react";

import { Button } from "../ui/button.js";
import { Dialog } from "../ui/dialog.js";

export function ConfirmationDialog({
  children,
  confirmLabel,
  onCancel,
  onConfirm,
  open,
  title,
}: PropsWithChildren<{
  readonly open: boolean;
  readonly title: string;
  readonly confirmLabel: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}>) {
  return (
    <Dialog onClose={onCancel} open={open} title={title}>
      <div className="space-y-4">
        {children}
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
          <Button onClick={onConfirm} type="button">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
