"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ListChecks, LayoutDashboard } from "lucide-react"

const adminMenuItems = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Games", href: "/admin/games", icon: ListChecks },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  return (
    <div className="bg-slate-800/70 min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <nav className="w-full flex items-center text-sidebar-foreground border-b border-sidebar-border/10 px-6 py-3 gap-2">
        <h1 className="text-3xl font-bold font-crimson text-slate-100">Admin Dashboard</h1>
        {adminMenuItems.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors font-medium text-sm
              ${pathname === item.href ? "text-sidebar-accent-foreground" : "hover:text-sidebar-accent-foreground"}
            `}
          >
            <item.icon className="w-5 h-5 text-slate-100" />
            <span className="text-slate-100 font-semibold text-sm">{item.title}</span>
          </Link>
        ))}
        <Link
          href="/admin/sessions"
          className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors font-medium text-sm
            ${pathname === "/admin/sessions" ? "text-sidebar-accent-foreground" : "hover:text-sidebar-accent-foreground"}
          `}
        >
          <LayoutDashboard className="w-5 h-5 text-slate-100" />
          <span className="text-slate-100 font-semibold text-sm">Sessions</span>
        </Link>
      </nav>
      <main className="p-4 md:p-8 bg-slate-900/50 overflow-auto text-slate-50 min-h-[calc(100vh-56px)]">
        {children}
      </main>
    </div >
  )
}
