import { ChevronDown } from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui"
import { Row, Section } from "../components"

export function OverlaysSection() {
  return (
    <Section id="overlays" title="Dialog, menu, select and tooltip">
      <Row>
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve this fix?</DialogTitle>
              <DialogDescription>
                Pull request #214 changes 2 files. Nothing is merged until you approve.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost">Not now</Button>
              <Button>Approve</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            Actions <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Pause source</DropdownMenuItem>
            <DropdownMenuItem>
              Rotate token <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Remove</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" />}>Hover for tooltip</TooltipTrigger>
          <TooltipContent>Tooltips also show on keyboard focus</TooltipContent>
        </Tooltip>
      </Row>
    </Section>
  )
}
