import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[16px] border text-sm font-semibold transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-cyan-600 text-white shadow-[0_16px_36px_rgba(8,145,178,0.22)] hover:bg-cyan-700",
        destructive:
          "border-transparent bg-destructive text-white shadow-[0_10px_24px_rgba(127,29,29,0.14)] hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border-border bg-background/90 text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.04)] hover:bg-muted dark:bg-white/[0.04] dark:hover:bg-white/[0.08]",
        secondary:
          "border-border bg-secondary/95 text-secondary-foreground shadow-[0_10px_24px_rgba(15,23,42,0.04)] hover:bg-secondary/80 dark:bg-secondary dark:hover:bg-secondary/85",
        ghost:
          "border-transparent bg-transparent text-foreground shadow-none hover:bg-muted",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-[10px] px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-[12px] px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded-[16px] px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-[10px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
