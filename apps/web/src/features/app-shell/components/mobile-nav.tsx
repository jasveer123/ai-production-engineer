"use client"

import * as React from "react"
import { Menu } from "lucide-react"
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui"
import { NavList } from "./nav-list"

export function MobileNav() {
  const [open, setOpen] = React.useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />}
      >
        <Menu />
      </DrawerTrigger>
      <DrawerContent className="right-auto left-0 max-w-72 border-r border-l-0 data-open:slide-in-from-left data-closed:slide-out-to-left">
        <DrawerHeader>
          <DrawerTitle>Menu</DrawerTitle>
        </DrawerHeader>
        <NavList onNavigate={() => setOpen(false)} />
      </DrawerContent>
    </Drawer>
  )
}
