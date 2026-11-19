import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { disabled, focusRing, lift } from "./tactile";

export const buttonVariants = cva(
  `hit-area inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-border-firm font-medium whitespace-nowrap ${focusRing} ${lift} ${disabled}`,
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-1),var(--inset-hi)] hover:bg-primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground shadow-1 hover:border-input hover:bg-lane",
        ghost:
          "border-transparent bg-transparent text-secondary-foreground hover:bg-lane hover:shadow-none",
        destructive:
          "border-transparent bg-destructive text-primary-foreground shadow-1 hover:opacity-90",
      },
      size: {
        sm: "h-control-sm px-3 text-[length:var(--text-small)]",
        md: "h-control-md px-4 text-[length:var(--text-ui)]",
        lg: "h-control-lg px-5 text-[length:var(--text-ui)]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
