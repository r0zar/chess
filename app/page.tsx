"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card" // Removed CardDescription for now
import { Badge } from "@/components/ui/badge"
import type { GameData } from "@/lib/chess-data.types"
import RelativeTimeDisplay from "@/components/relative-time-display"
import CreateGameButton from "./create-game-button"
import ChallengeRequestButton from "@/components/challenge-request-button"
import Auth from "@/components/auth"
import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { isConnected, getLocalStorage } from "@stacks/connect"
import { ListChecks, Loader2, Users, Crown, CircleUser } from "lucide-react" // Added CircleUser

// The GameData type should already include playerWhiteId and playerBlackId from lib/chess-data.types.ts

async function fetchGamesListClientSide(): Promise<GameData[]> {
  try {
    const response = await fetch("/api/games")
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || "Failed to fetch games list")
    }
    return response.json()
  } catch (e: unknown) {
    console.error("Exception in fetchGamesListClientSide:", e)
    return []
  }
}

export default function HomePage() {
  const [stxAddress, setStxAddress] = useState<string | null>(null)
  const [games, setGames] = useState<GameData[]>([])
  const [isLoadingGames, setIsLoadingGames] = useState(true)
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
    setStxAddress(getStxAddressFromStorage())
  }, [getStxAddressFromStorage])

  const loadGames = useCallback(async () => {
    setIsLoadingGames(true)
    try {
      const gamesList = await fetchGamesListClientSide()
      setGames(gamesList)
    } catch (error) {
      toast({ title: "Error Loading Games", description: (error as Error).message, variant: "destructive" })
      setGames([])
    } finally {
      setIsLoadingGames(false)
    }
  }, [toast])

  useEffect(() => {
    loadGames()
  }, [loadGames])

  const handleAuthConnect = (address: string) => {
    setStxAddress(address)
    toast({
      title: "Wallet Connected",
      description: `Welcome, ${address.substring(0, 6)}...${address.substring(address.length - 4)}!`,
    })
    loadGames() // Refresh games list to show updated STX address associations
  }

  const handleAuthDisconnect = () => {
    setStxAddress(null)
    toast({ title: "Wallet Disconnected" })
    loadGames() // Refresh games list
  }

  const getStatusBadgeVariant = (status: string | null): "default" | "secondary" | "outline" | "destructive" => {
    if (!status) return "secondary"
    if (status.includes("wins")) return "default"
    if (status === "ongoing") return "default"
    if (status === "pending") return "secondary"
    if (status.includes("draw") || status === "stalemate") return "outline"
    return "destructive"
  }

  const getPlayerDisplay = (address: string | null | undefined, id: string | null | undefined): string => {
    if (address) {
      return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
    }
    if (id) {
      // Shorten user ID display for compactness
      return `User ${id.substring(0, 4)}...`
    }
    return "Open Slot"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50">
      {/* Header / Navigation */}
      <header className="py-4 px-4 sm:px-6 lg:px-8 sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-sky-400 mt-0.5 mb-1.5" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-crimson">Chess</h1>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="text-sm text-slate-300 hover:text-sky-400 transition-colors">
              Admin
            </Link>
            <Auth onConnect={handleAuthConnect} onDisconnect={handleAuthDisconnect} />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Hero Section */}
        <section className="text-center py-12 sm:py-16 md:py-20 rounded-xl bg-slate-800/50 shadow-xl mb-12">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6 tracking-tight font-playfair">
            <span className="block">Welcome to Stacks Chess</span>
            <span className="block text-sky-400">Challenge Your Mind.</span>
          </h2>
          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-slate-300 mb-10">
            Engage in classic chess battles on the Stacks blockchain. Connect your wallet to create games, track your
            record, or play as a guest.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <CreateGameButton />
            <ChallengeRequestButton />
          </div>
          {stxAddress && (
            <p className="mt-6 text-sm text-slate-400">
              Connected as:{" "}
              <span className="font-mono text-sky-300">
                {stxAddress.substring(0, 6)}...{stxAddress.substring(stxAddress.length - 4)}
              </span>
            </p>
          )}
        </section>

        {/* Games List Section */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-3xl font-semibold tracking-tight font-crimson">Available Games</h3>
            <Button variant="secondary" onClick={loadGames} disabled={isLoadingGames}>
              {isLoadingGames ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ListChecks className="mr-2 h-4 w-4" />
              )}
              Refresh List
            </Button>
          </div>

          {isLoadingGames && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-slate-800/70 border-slate-700 shadow-md animate-pulse">
                  <CardHeader className="p-3">
                    <div className="h-5 bg-slate-700 rounded w-3/4 mb-1"></div>
                    <div className="h-4 bg-slate-700 rounded w-1/3"></div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-1.5">
                    <div className="h-3.5 bg-slate-700 rounded w-full"></div>
                    <div className="h-3.5 bg-slate-700 rounded w-full"></div>
                  </CardContent>
                  <CardFooter className="p-3 pt-1 flex flex-col items-stretch space-y-1.5">
                    <div className="h-8 bg-slate-700 rounded w-full"></div>
                    <div className="h-3 bg-slate-700 rounded w-1/2 self-center"></div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {!isLoadingGames && games.length === 0 && (
            <Card className="bg-slate-800/70 border-slate-700 shadow-lg text-center py-12">
              <CardContent>
                <Users className="mx-auto h-12 w-12 text-slate-500 mb-4" />
                <p className="text-xl font-medium text-slate-300 font-crimson">No Active Games</p>
                <p className="text-slate-400">Be the first to start a new challenge!</p>
              </CardContent>
            </Card>
          )}

          {!isLoadingGames && games.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {games.map((game) => (
                <Card
                  key={game.id}
                  className="bg-slate-800/70 border-slate-700 shadow-md hover:border-sky-500/70 transition-all duration-200 flex flex-col"
                >
                  <CardHeader className="p-3">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-xs font-mono text-sky-400 leading-tight">
                        {game.id.substring(0, 8)}
                      </CardTitle>
                      <Badge
                        variant={getStatusBadgeVariant(game.status)}
                        className="shrink-0"
                      >
                        {game.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-1.5 text-xs flex-grow">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center text-slate-400">
                        <CircleUser className="w-3 h-3 mr-1 text-slate-900 bg-white rounded-full p-0.5" />
                        White:
                      </span>
                      <span className="font-mono text-slate-200 truncate max-w-[100px] sm:max-w-[120px]">
                        {getPlayerDisplay(game.playerWhiteAddress, game.playerWhiteId)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center text-slate-400">
                        <CircleUser className="w-3 h-3 mr-1 text-white bg-slate-900 rounded-full p-0.5" />
                        Black:
                      </span>
                      <span className="font-mono text-slate-200 truncate max-w-[100px] sm:max-w-[120px]">
                        {getPlayerDisplay(game.playerBlackAddress, game.playerBlackId)}
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="p-3 pt-2 flex flex-col items-stretch space-y-1.5">
                    <Button asChild size="sm" className="w-full">
                      <Link href={`/play/${game.id}`}>
                        {game.status === "pending" &&
                          (!game.playerWhiteId ||
                            !game.playerBlackId ||
                            (stxAddress &&
                              (game.playerWhiteAddress === stxAddress || game.playerBlackAddress === stxAddress)))
                          ? "Join Game"
                          : "View Game"}
                      </Link>
                    </Button>
                    <div className="text-center text-slate-500 text-[10px] pt-0.5">
                      <RelativeTimeDisplay dateString={new Date(game.updatedAt).toISOString()} />
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-slate-700 mt-12">
        <p className="text-sm text-slate-400">&copy; {new Date().getFullYear()} Stacks Chess. All rights reserved.</p>
      </footer>
    </div>
  )
}
