"use client"

import { useState, useEffect, useCallback } from "react"
import { connect, disconnect, isConnected, getLocalStorage } from "@stacks/connect"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { LogIn, LogOut } from "lucide-react" // Added UserCircle
import { useGlobalEvents } from "@/components/global-events-provider"

export default function Auth() {
  const { toast } = useToast()
  const { stxAddress, setStxAddress } = useGlobalEvents()

  const handleConnectWallet = async () => {
    try {
      await connect()
      // After successful connection, get the address from local storage
      const storage = getLocalStorage()
      const address = storage?.addresses?.stx?.[0]?.address
      if (address) setStxAddress(address)
    } catch (error) {
      const errorMessage = (error as Error).message
      if (/denied|cancelled|canceled/i.test(errorMessage)) {
        toast({
          title: "Connection Canceled",
          description: "Wallet connection process was canceled.",
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
    } catch (error) {
      toast({
        title: "Disconnection Error",
        description: (error as Error).message,
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    // On mount, check for an existing stx address in local storage
    const storage = getLocalStorage()
    const address = storage?.addresses?.stx?.[0]?.address
    if (address) {
      setStxAddress(address)
    }
  }, [setStxAddress])

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
