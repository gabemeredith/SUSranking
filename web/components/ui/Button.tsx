import Link from "next/link";
import { ComponentProps, ReactNode } from "react";

const VARIANTS = {
  primary:
    "bg-accent text-white font-bold hover:bg-[#e65c00] transition rounded-lg",
  outline:
    "border border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:text-neutral-900 transition rounded-lg",
} as const;

const SIZES = {
  sm: "px-3.5 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
} as const;

type Variant = keyof typeof VARIANTS;
type Size = keyof typeof SIZES;

function classes(variant: Variant, size: Size, extra?: string) {
  return [VARIANTS[variant], SIZES[size], extra].filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <button className={classes(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <Link className={`inline-block ${classes(variant, size, className)}`} {...props}>
      {children}
    </Link>
  );
}
