"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { createAndNavigateToGame } from "../../app/actions" // Server Action
import { Loader2, Sparkles, Zap, Crown } from "lucide-react" // For loading indicator and effects

export default function CreateGameButton() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const handleCreateGame = async () => {
    setIsLoading(true)
    try {
      // Server action now handles game creation anonymously.
      // The user (creator) will be assigned a slot via session ID
      // when they land on the game page through the /api/game/[gameId]/identify route.
      await createAndNavigateToGame()
      // Server action handles redirection, no client-side navigation needed here.
    } catch (error) {
      // Check if this is a Next.js redirect error (which is expected)
      const errorMessage = (error as Error).message || ""
      if (errorMessage.includes("NEXT_REDIRECT")) {
        // This is a successful redirect, not an actual error
        console.log("Game created successfully, redirecting...")
        return
      }

      // Only show toast for actual errors
      console.error("Error creating new game:", error)
      toast({
        title: "Error Creating Game",
        description: errorMessage || "Could not create a new game. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleCreateGame}
      size="lg"
      disabled={isLoading}
      className="group relative overflow-hidden bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:via-amber-700 hover:to-amber-800 text-white font-semibold text-base px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0 transform hover:scale-[1.02] disabled:hover:scale-100 disabled:opacity-70"
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />

      {/* Floating sparkles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1 left-2 text-white/30 animate-gentle-bounce">
          <Sparkles className="h-2 w-2" />
        </div>
        <div className="absolute bottom-1 right-3 text-white/20 animate-gentle-bounce-delayed">
          <Sparkles className="h-2 w-2" />
        </div>
      </div>

      {/* Shine effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />

      <div className="relative flex items-center justify-center space-x-3">
        {isLoading ? (
          <>
            <div className="relative">
              <Loader2 className="h-5 w-5 animate-spin" />
              <div className="absolute inset-0 bg-white/20 rounded-full blur-sm animate-pulse" />
            </div>
            <span className="tracking-wide">Rallying the troops...</span>
          </>
        ) : (
          <>
            <div className="relative">
              <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <Crown className="h-4 w-4" />
              </div>
              <div className="absolute -inset-1 bg-white/10 rounded-lg blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="tracking-wide">Start New Game</span>
            <div className="opacity-60 group-hover:opacity-100 transition-opacity">
              <Zap className="h-4 w-4" />
            </div>
          </>
        )}
      </div>

      {/* Bottom glow effect */}
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </Button>
  )
}