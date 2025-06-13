import type React from "react"
import AdminLayoutComponent from "@/components/admin/admin-layout"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayoutComponent>{children}</AdminLayoutComponent>
}
