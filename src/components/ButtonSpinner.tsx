import { Loader2 } from 'lucide-react';

interface ButtonSpinnerProps {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ButtonSpinnerProps['size']>, string> = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
};

export function ButtonSpinner({ size = 'md', className = '' }: ButtonSpinnerProps) {
  return (
    <Loader2
      className={`animate-spin shrink-0 ${SIZE_CLASSES[size]} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
