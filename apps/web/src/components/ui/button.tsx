import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border text-sm font-medium whitespace-nowrap transition-[transform,background-color,border-color,color] duration-150 ease-out outline-none select-none hover:-translate-y-px focus-visible:ring-3 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-brand bg-brand font-semibold text-on-brand hover:border-brand-strong hover:bg-brand-strong",
        outline:
          "border-line-strong bg-panel-2 text-text hover:border-muted-foreground aria-expanded:border-brand",
        secondary: "border-line bg-brand-soft text-brand-strong hover:border-brand",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-panel-2 hover:text-text aria-expanded:bg-panel-2 aria-expanded:text-text",
        destructive:
          "border-transparent bg-danger-soft text-danger hover:border-danger focus-visible:ring-danger/40",
        link: "h-auto border-transparent px-0 text-brand underline underline-offset-4 hover:translate-y-0 hover:text-brand-strong active:scale-100",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-[0.8125rem]",
        xs: "h-6 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
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
