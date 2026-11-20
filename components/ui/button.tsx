import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] text-[13px] leading-4 font-semibold transition-colors disabled:pointer-events-none disabled:bg-chip disabled:text-quaternary',
  {
    variants: {
      variant: {
        primary: 'bg-brand-fill text-white hover:bg-[#2457c9]',
        secondary: 'border border-line-strong bg-white text-foreground hover:bg-hover',
        ghost: 'bg-transparent text-secondary hover:bg-hover',
        danger: 'border border-line-strong bg-white text-danger hover:bg-bad-bg',
      },
      size: {
        md: 'h-[34px] px-3',
        sm: 'h-7 px-2',
        icon: 'size-[34px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp type={asChild ? undefined : 'button'} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
