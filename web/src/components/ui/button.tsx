import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[16px] border-2 border-slate-950 text-sm font-semibold transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 hover:-translate-y-0.5",
  {
    variants: {
      variant: {
        default:
          "bg-[#10313a] text-primary-foreground shadow-[4px_4px_0_0_rgba(15,23,42,0.18)] hover:bg-[#0d2a31]",
        destructive:
          "bg-destructive text-white shadow-[4px_4px_0_0_rgba(127,29,29,0.16)] hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "bg-background text-foreground shadow-[4px_4px_0_0_rgba(15,23,42,0.08)] hover:bg-[#efe6d6]",
        secondary:
          "bg-[#fff4d7] text-slate-950 shadow-[4px_4px_0_0_rgba(15,23,42,0.08)] hover:bg-[#f6e7bb]",
        ghost:
          "border-transparent bg-transparent text-foreground shadow-none hover:border-slate-950 hover:bg-[#efe6d6]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-[12px] px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-[14px] px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded-[18px] px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-[12px] [&_svg:not([class*='size-'])]:size-3",
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
