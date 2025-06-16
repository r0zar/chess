"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle, AlertCircle, Info, Zap } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-6 right-6 z-[200] flex max-h-screen w-full max-w-[420px] flex-col gap-3 p-4",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start space-x-4 overflow-hidden rounded-2xl border backdrop-blur-xl p-6 pr-10 shadow-2xl transition-all duration-300 data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full hover:scale-[1.02] hover:shadow-3xl",
  {
    variants: {
      variant: {
        default: "border-neutral-700/60 bg-gradient-to-br from-neutral-900/95 to-neutral-950/95 text-white shadow-neutral-900/50",
        destructive: "border-red-500/60 bg-gradient-to-br from-red-950/95 to-red-900/95 text-red-50 shadow-red-900/50",
        success: "border-emerald-500/60 bg-gradient-to-br from-emerald-950/95 to-emerald-900/95 text-emerald-50 shadow-emerald-900/50",
        warning: "border-amber-500/60 bg-gradient-to-br from-amber-950/95 to-amber-900/95 text-amber-50 shadow-amber-900/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-xl border bg-transparent px-3 text-sm font-medium transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      "border-neutral-600/60 hover:bg-neutral-800/60 hover:border-neutral-500 focus:ring-neutral-500",
      "group-[.destructive]:border-red-400/60 group-[.destructive]:hover:bg-red-900/60 group-[.destructive]:hover:border-red-400 group-[.destructive]:focus:ring-red-400",
      "group-[.success]:border-emerald-400/60 group-[.success]:hover:bg-emerald-900/60 group-[.success]:hover:border-emerald-400 group-[.success]:focus:ring-emerald-400",
      "group-[.warning]:border-amber-400/60 group-[.warning]:hover:bg-amber-900/60 group-[.warning]:hover:border-amber-400 group-[.warning]:focus:ring-amber-400",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-3 top-3 rounded-xl p-1.5 text-neutral-400 opacity-70 transition-all duration-200 hover:opacity-100 hover:scale-110 hover:bg-neutral-800/60 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-transparent",
      "group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:hover:bg-red-900/60 group-[.destructive]:focus:ring-red-400",
      "group-[.success]:text-emerald-300 group-[.success]:hover:text-emerald-50 group-[.success]:hover:bg-emerald-900/60 group-[.success]:focus:ring-emerald-400",
      "group-[.warning]:text-amber-300 group-[.warning]:hover:text-amber-50 group-[.warning]:hover:bg-amber-900/60 group-[.warning]:focus:ring-amber-400",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastIcon = ({ variant }: { variant?: "default" | "destructive" | "success" | "warning" | null }) => {
  const iconMap = {
    default: <Info className="h-5 w-5 text-blue-400" />,
    destructive: <AlertCircle className="h-5 w-5 text-red-400" />,
    success: <CheckCircle className="h-5 w-5 text-emerald-400" />,
    warning: <Zap className="h-5 w-5 text-amber-400" />,
  }

  const containerMap = {
    default: "bg-blue-500/20 border-blue-500/30",
    destructive: "bg-red-500/20 border-red-500/30",
    success: "bg-emerald-500/20 border-emerald-500/30",
    warning: "bg-amber-500/20 border-amber-500/30",
  }

  const selectedVariant = variant || "default"

  return (
    <div className={cn(
      "flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center",
      containerMap[selectedVariant]
    )}>
      {iconMap[selectedVariant]}
    </div>
  )
}

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold tracking-tight", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90 mt-1 leading-relaxed", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

// Enhanced Toast Component with built-in icon
const ToastWithIcon = React.forwardRef<
  React.ElementRef<typeof Toast>,
  React.ComponentPropsWithoutRef<typeof Toast> & {
    title?: string
    description?: string
    action?: React.ReactElement<typeof ToastAction>
  }
>(({ className, variant, title, description, action, children, ...props }, ref) => (
  <Toast ref={ref} className={className} variant={variant} {...props}>
    <ToastIcon variant={variant} />
    <div className="flex-1 space-y-1">
      {title && <ToastTitle>{title}</ToastTitle>}
      {description && <ToastDescription>{description}</ToastDescription>}
      {children}
      {action}
    </div>
    <ToastClose />
  </Toast>
))
ToastWithIcon.displayName = "ToastWithIcon"

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  ToastIcon,
  ToastWithIcon,
}