"use client"

import { useState, useEffect, useCallback } from "react"
import { connect, disconnect, isConnected, getLocalStorage } from "@stacks/connect"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { LogIn, LogOut } from "lucide-react" // Added UserCircle

interface AuthProps {
  onConnect: (address: string) => void
  onDisconnect: () => void
}

export default function Auth({ onConnect, onDisconnect }: AuthProps) {
  const [stxAddress, setStxAddress] = useState<string | null>(null)
  const { toast } = useToast()

  const getStxAddressFromStorage = useCallback(() => {
    if (!isConnected()) return null
    const storage = getLocalStorage()
    const stxAddresses = storage?.addresses?.stx
    if (stxAddresses && stxAddresses.length > 0 && stxAddresses[0].address) {
      return stxAddresses[0].address
    }
    return null
  }, [])

  useEffect(() => {
    const address = getStxAddressFromStorage()
    if (address) {
      setStxAddress(address)
      // Call onConnect only if it hasn't been called for this address yet,
      // or if the component is re-initializing with a connected state.
      // This avoids redundant onConnect calls on every re-render.
      if (stxAddress !== address) {
        // Check if address actually changed
        onConnect(address)
      }
    } else {
      // If disconnected, ensure local state is null
      if (stxAddress !== null) {
        setStxAddress(null)
        // onDisconnect(); // Potentially call onDisconnect if state was previously connected
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getStxAddressFromStorage]) // Removed onConnect and stxAddress from deps to control calls

  const handleConnectWallet = async () => {
    try {
      await connect({
        onFinish: (payload) => {
          // Use onFinish for better UX
          const address = payload.stxAddress
          if (address) {
            setStxAddress(address)
            onConnect(address) // This onConnect is from props, for parent component
            // toast({ title: "Wallet Connected", description: `Address: ${address.substring(0, 6)}...` }) // Toast handled by parent
          } else {
            throw new Error("Could not retrieve STX address after connecting.")
          }
        },
        onCancel: () => {
          toast({
            title: "Connection Canceled",
            description: "Wallet connection process was canceled.",
            variant: "default",
          })
        },
      })
    } catch (error) {
      console.error("Error connecting wallet:", error)
      toast({ title: "Connection Error", description: (error as Error).message, variant: "destructive" })
    }
  }

  const handleDisconnectWallet = async () => {
    try {
      await disconnect()
      setStxAddress(null)
      onDisconnect() // This onDisconnect is from props
      // toast({ title: "Wallet Disconnected" }) // Toast handled by parent
    } catch (error) {
      console.error("Error disconnecting wallet:", error)
      toast({ title: "Disconnection Error", description: (error as Error).message, variant: "destructive" })
    }
  }

  if (stxAddress) {
    return (
      <Button
        onClick={handleDisconnectWallet}
        variant="outline"
        size="sm"
        className="border-slate-600 hover:bg-slate-700 hover:text-slate-100"
      >
        <LogOut className="mr-2 h-4 w-4" />
        <span className="font-mono text-xs">
          {stxAddress.substring(0, 5)}...{stxAddress.substring(stxAddress.length - 3)}
        </span>
      </Button>
    )
  }

  return (
    <Button
      onClick={handleConnectWallet}
      variant="ghost"
      className="text-slate-300 hover:bg-slate-700 hover:text-sky-400"
    >
      <LogIn className="mr-2 h-4 w-4" />
      Connect Wallet
    </Button>
  )
}
