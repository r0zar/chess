// This component uses the shadcn sidebar structure [^1]
// Ensure you have the sidebar components from `components/ui/sidebar.tsx` as described in shadcn docs.
// I will assume `components/ui/sidebar.tsx` exists and is correctly implemented.
"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar" // This path must exist with shadcn sidebar code
import { Button } from "@/components/ui/button"
import { ListChecks, Settings, LayoutDashboard, LogOut } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const adminMenuItems = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Games", href: "/admin/games", icon: ListChecks },
  // { title: "Users", href: "/admin/users", icon: Users },
  // { title: "Settings", href: "/admin/settings", icon: Settings },
]

function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      {" "}
      {/* Using icon collapsible variant [^1] */}
      <SidebarHeader className="p-2 border-b border-sidebar-border">
        <Link href="/admin/dashboard" className="flex items-center gap-2 p-2 hover:bg-sidebar-accent rounded-md">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-primary">
            <path
              d="M12 2L2 7L12 12L22 7L12 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 17L12 22L22 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 12L12 17L22 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">Chess Admin</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href))
                    }
                    tooltip={{ children: item.title, side: "right", align: "center" }}
                  >
                    <Link href={item.href}>
                      <item.icon className="w-5 h-5" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-sidebar-border group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:aspect-square group-data-[collapsible=icon]:p-2"
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src="/placeholder.svg?height=32&width=32" alt="Admin" />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
              <span className="ml-2 group-data-[collapsible=icon]:hidden">Admin User</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Persisted state for sidebar example from docs [^1]
  // In a real app, you might fetch this from cookies on the server for SSR.
  // For client-side only, this is fine.
  // const defaultOpen = typeof window !== "undefined" ? document.cookie.includes("sidebar:state=true") : true;

  return (
    // <SidebarProvider defaultOpen={defaultOpen}> // Enable if using cookie persistence [^1]
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-8 bg-slate-900/50 overflow-auto text-slate-50">
          <div className="md:hidden mb-4">
            {" "}
            {/* Mobile trigger */}
            <SidebarTrigger className="text-slate-200 hover:text-slate-50" />
          </div>
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}
