"use client"

import { useState, useEffect, useCallback } from "react"
import { connect, disconnect, isConnected, getLocalStorage } from "@stacks/connect"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { LogIn, LogOut, Wallet, User } from "lucide-react"
import { useGlobalEvents } from "@/components/global-events-provider"
import { associateWalletWithUser } from '@/app/actions'

export default function Auth() {
  const { toast } = useToast()
  const { stxAddress, setStxAddress, userUuid } = useGlobalEvents()

  const handleConnectWallet = async () => {
    try {
      await connect()
      // After successful connection, get the address from local storage
      const storage = getLocalStorage()
      const address = storage?.addresses?.stx?.[0]?.address
      if (address) {
        setStxAddress(address)
        if (userUuid) {
          try {
            await associateWalletWithUser(userUuid, address)
          } catch (err) {
            toast({
              title: "Server Error",
              description: (err as Error).message,
              variant: "destructive"
            })
          }
        }
      }
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
        variant="outline"
        size="sm"
        className="border-neutral-700/60 bg-neutral-800/40 text-neutral-300 hover:bg-neutral-700/60 hover:text-white hover:border-neutral-600 transition-all duration-200 backdrop-blur-sm group"
      >
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
            <User className="h-3 w-3 text-emerald-400" />
          </div>
          <span className="font-mono text-xs">
            {stxAddress.substring(0, 5)}...{stxAddress.substring(stxAddress.length - 3)}
          </span>
        </div>
      </Button>
    )
  }

  return (
    <Button
      onClick={handleConnectWallet}
      className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white border-0 transition-all duration-200 shadow-lg hover:shadow-xl backdrop-blur-sm group"
    >
      <div className="flex items-center space-x-2">
        <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
          <Wallet className="h-3 w-3" />
        </div>
        <span className="font-medium">Connect Wallet</span>
      </div>
    </Button>
  )
}