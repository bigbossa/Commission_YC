"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  Home, 
  Database, 
  FileText, 
  Coins, 
  Menu,
  X,
  BookOpen,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"

const routes = [
  {
    label: "Dashboard",
    icon: Home,
    href: "/",
  },
  {
    label: "CustSettleCache",
    icon: Database,
    href: "/sales",
  },
  {
    label: "SALESCOMMISSION",
    icon: Database,
    href: "/products",
  },
  {
    label: "คำนวนค่า Commission",
    icon: Coins,
    href: "/analytics",
  },
  {
    label: "ยอดค้างชำระ QTY",
    icon: AlertCircle,
    href: "/outstanding",
  },
  {
    label: "สูตรคำนวณ",
    icon: BookOpen,
    href: "/formula",
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  return (
    <>
      {/* Mobile Hamburger */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="outline" size="icon" className="fixed top-4 left-4 z-40">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <SidebarContent pathname={pathname} onLinkClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-screen w-64 border-r bg-card">
        <SidebarContent pathname={pathname} />
      </div>
    </>
  )
}

function SidebarContent({ 
  pathname, 
  onLinkClick 
}: { 
  pathname: string
  onLinkClick?: () => void 
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <ThemeToggle />
        </div>
        <p className="text-sm text-muted-foreground">Commission Management</p>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {routes.map((route) => {
          const Icon = route.icon
          const isActive = pathname === route.href
          
          return (
            <Link
              key={route.href}
              href={route.href}
              onClick={onLinkClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
                isActive 
                  ? "bg-accent text-accent-foreground" 
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {route.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          © 2026 Commission Dashboard
        </p>
      </div>
    </div>
  )
}
