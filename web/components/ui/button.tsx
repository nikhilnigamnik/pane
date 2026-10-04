import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/web/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'error';
type ButtonSize = 'tiny' | 'small';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isSquare?: boolean;
  // For toggles: drawn held down and announced as pressed.
  isPressed?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-theme-fg text-theme-bg hover:bg-theme-fg-02',
  secondary: 'bg-theme-card-03 text-theme-text shadow-outline-theme hover:bg-theme-card-04',
  tertiary: 'text-theme-text-sec hover:bg-theme-fg-08 hover:text-theme-text',
  error: 'bg-theme-error text-white hover:bg-theme-error/85',
};

const PRESSED_CLASSES = 'bg-theme-fg-15 text-theme-text';

const SIZE_CLASSES: Record<ButtonSize, string> = {
  tiny: 'h-6 text-product-base',
  small: 'h-8 text-sm',
};

// Side padding and the square width are alternatives, never combined. With no class merging,
// a "px-0" added on top of "px-2" loses, and the padding squeezes the icon to a few pixels.
const PADDING_CLASSES: Record<ButtonSize, string> = {
  tiny: 'px-2',
  small: 'px-3.5',
};

const SQUARE_CLASSES: Record<ButtonSize, string> = {
  tiny: 'w-6',
  small: 'w-8',
};

export function Button({
  variant = 'secondary',
  size = 'small',
  isSquare = false,
  isPressed,
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={isPressed}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full whitespace-nowrap outline-none transition-colors',
        'focus-visible:shadow-focus-ring disabled:cursor-not-allowed disabled:bg-theme-card-03 disabled:text-theme-text-tertiary',
        isPressed ? PRESSED_CLASSES : VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        isSquare ? SQUARE_CLASSES[size] : PADDING_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
}
