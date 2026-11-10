import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-[1.375rem] w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-sm border px-2 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-brand/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-line bg-panel-2 text-muted-foreground [a]:hover:border-line-strong [a]:hover:text-text",
        brand: "border-transparent bg-brand-soft text-brand-strong [a]:hover:border-brand",
        ai: "border-transparent bg-ai-soft text-ai-ink before:size-1.5 before:rounded-full before:bg-ai before:content-[''] [a]:hover:border-ai",
        success: "border-transparent bg-ok-soft text-ok [a]:hover:border-ok",
        warning: "border-transparent bg-warn-soft text-warn [a]:hover:border-warn",
        destructive: "border-transparent bg-danger-soft text-danger [a]:hover:border-danger",
        info: "border-transparent bg-info-soft text-info [a]:hover:border-info",
        outline: "border-line-strong bg-transparent text-text [a]:hover:bg-panel-2",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: { slot: "badge", variant },
  })
}

export { Badge, badgeVariants }
