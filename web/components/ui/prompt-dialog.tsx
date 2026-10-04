import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from './button';

interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  label: string;
  initialValue: string;
  // How much of the initial value starts selected, from the beginning.
  selectionEnd?: number;
  confirmLabel: string;
  cancelLabel: string;
  // Checked on every keystroke. Returns the reason the value cannot be used, or null.
  validate: (value: string) => string | null;
  // Resolves to an error to show, or null once the dialog can close.
  onSubmit: (value: string) => Promise<string | null>;
  onCancel: () => void;
}

type PromptFormProps = Omit<PromptDialogProps, 'isOpen' | 'title'>;

// Mounted each time the dialog opens, so it always starts from the initial value.
function PromptForm({
  description,
  label,
  initialValue,
  selectionEnd,
  confirmLabel,
  cancelLabel,
  validate,
  onSubmit,
  onCancel,
}: PromptFormProps) {
  const [value, setValue] = useState(initialValue);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useLayoutEffect(() => {
    const input = inputRef.current;
    input?.focus();
    input?.setSelectionRange(0, selectionEnd ?? initialValue.length);
  }, [initialValue, selectionEnd]);

  // An empty box is not an error until the user has typed something.
  const validationError = hasEdited || initialValue !== '' ? validate(value) : null;
  const error = submitError ?? validationError;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting || validate(value) !== null) {
      setHasEdited(true);
      return;
    }
    setIsSubmitting(true);
    const failure = await onSubmit(value);
    setIsSubmitting(false);
    setSubmitError(failure);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <div className="flex flex-col gap-3 p-6">
        {description && <p className="text-sm text-theme-text-sec">{description}</p>}
        <input
          ref={inputRef}
          type="text"
          aria-label={label}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setHasEdited(true);
            setSubmitError(null);
          }}
          className="h-8 rounded-md border border-theme-border-02 bg-theme-fg-05 px-2.5 text-sm text-theme-text outline-none focus:shadow-focus-ring aria-invalid:border-theme-error"
        />
        {error && (
          <p id={errorId} role="alert" className="text-product-lg text-theme-error">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-theme-border-02 bg-theme-card p-4">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting || error !== null}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}

// Asks for one line of text, such as the name of a new file.
export function PromptDialog({ isOpen, title, ...formProps }: PromptDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // A layout effect, so the input inside can take focus as soon as it mounts.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // Escape fires "cancel"; state stays the single owner of whether the dialog is open.
      onCancel={(event) => {
        event.preventDefault();
        formProps.onCancel();
      }}
      className="m-auto w-[420px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-theme-border-02 bg-theme-bg p-0 text-theme-text shadow-flyout backdrop:bg-black/50"
    >
      <h2 id={titleId} className="px-6 pt-6 text-base">
        {title}
      </h2>
      {isOpen && <PromptForm {...formProps} />}
    </dialog>
  );
}
