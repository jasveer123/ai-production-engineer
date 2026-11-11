import { NavList } from "./nav-list"

export function AppRail() {
  return (
    <aside
      aria-label="Navigation"
      className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-line bg-panel py-5 lg:block"
    >
      <NavList />
    </aside>
  )
}
