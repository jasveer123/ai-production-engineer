import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm font-medium whitespace-nowrap transition-colors duration-100 outline-none select-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand text-on-brand hover:bg-brand-strong",
        outline: "border-line-strong bg-panel text-text hover:bg-panel-2 aria-expanded:bg-panel-2",
        secondary: "border-transparent bg-brand-soft text-brand-strong hover:border-brand/40",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-panel-2 hover:text-text aria-expanded:bg-panel-2 aria-expanded:text-text",
        destructive:
          "border-transparent bg-danger-soft text-danger hover:border-danger/40 focus-visible:ring-danger/40",
        link: "h-auto border-transparent px-0 text-brand underline underline-offset-4 hover:text-brand-strong",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-3 text-[0.8125rem]",
        xs: "h-6 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        lg: "h-12 px-6 text-base",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
