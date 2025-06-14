"use client"

import { useState, useEffect, useCallback } from "react"
import { connect, disconnect, isConnected, getLocalStorage } from "@stacks/connect"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
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
    if (address && stxAddress !== address) {
      // Only call onConnect when the address actually changes (not on every mount)
      setStxAddress(address)
      onConnect(address)
    } else if (!address && stxAddress !== null) {
      // Only call onDisconnect when we actually disconnect
      setStxAddress(null)
      onDisconnect()
    } else if (address && stxAddress === null) {
      // Silent re-initialization - just update state without triggering callbacks
      setStxAddress(address)
    }
  }, [stxAddress, getStxAddressFromStorage, onConnect, onDisconnect])

  const handleConnectWallet = async () => {
    try {
      await connect()

      // Get the address after successful connection
      const address = getStxAddressFromStorage()
      if (address) {
        setStxAddress(address)
        onConnect(address) // This onConnect is from props, parent component handles the success toast
      } else {
        throw new Error("Could not retrieve STX address after connecting.")
      }
    } catch (error) {
      console.error("Error connecting wallet:", error)

      // Check if it was user cancellation vs actual error
      const errorMessage = (error as Error).message
      if (errorMessage.includes("User denied") || errorMessage.includes("cancelled") || errorMessage.includes("canceled")) {
        toast({
          title: "Connection Canceled",
          description: "Wallet connection process was canceled.",
          variant: "default",
        })
      } else {
        toast({
          title: "Connection Error",
          description: errorMessage,
          variant: "destructive"
        })
      }
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
        variant="secondary"
        size="sm"
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
      variant="secondary"
    >
      <LogIn className="mr-2 h-4 w-4" />
      Connect Wallet
    </Button>
  )
}
