import { useEffect, useRef } from 'react';

import { Button } from './button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      // Escape fires "cancel"; state stays the single owner of whether the dialog is open.
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[420px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-theme-border-02 bg-theme-bg p-0 text-theme-text shadow-flyout backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-2 p-6">
        <h2 className="text-base">{title}</h2>
        <p className="text-sm text-theme-text-sec">{description}</p>
      </div>
      <div className="flex items-center justify-between border-t border-theme-border-02 bg-theme-card p-4">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="error" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
