"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { createAndNavigateToGame } from "./actions" // Server Action
import { Loader2 } from "lucide-react" // For loading indicator

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
      console.error("Error creating new game:", error)
      toast({
        title: "Error Creating Game",
        description: (error as Error).message || "Could not create a new game. Please try again.",
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
      className="bg-sky-500 hover:bg-sky-600 text-white text-base px-8 py-3"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Creating Game...
        </>
      ) : (
        "Start New Game"
      )}
    </Button>
  )
}
