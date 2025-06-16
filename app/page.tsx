"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card" // Removed CardDescription for now
import { Badge } from "@/components/ui/badge"
import type { GameData } from "@/lib/chess-data.types"
import RelativeTimeDisplay from "@/components/relative-time-display"
import CreateGameButton from "@/components/lobby/create-game-button"
import ChallengeRequestButton from "@/components/lobby/challenge-request-button"
import Auth from "@/components/auth"
import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { Crown, CircleUser } from "lucide-react"

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

// Helper to check if it's the user's turn
function isUsersTurn(game: GameData, userUuid: string | null): boolean {
  if (!userUuid || !game.currentFen) return false;
  if (game.status !== "ongoing") return false;
  const fenParts = game.currentFen.split(' ');
  const fenTurn = fenParts[1]; // 'w' or 'b'
  let userColor: 'w' | 'b' | null = null;
  if (game.playerWhiteId === userUuid) userColor = 'w';
  if (game.playerBlackId === userUuid) userColor = 'b';
  return userColor === fenTurn;
}

export default function HomePage() {
  const [games, setGames] = useState<GameData[]>([])
  const [isLoadingGames, setIsLoadingGames] = useState(true)
  const { toast } = useToast()

  // Use localStorage UUID for user identification
  const userUuid = typeof window !== 'undefined' ? localStorage.getItem('user-uuid') : null;

  // Add ended games section
  const endedGames = games.filter(
    (game) => game.status !== 'pending' && game.status !== 'ongoing'
  ).sort((a, b) => b.updatedAt - a.updatedAt)

  // Only include non-ended games in the other sections
  const nonEndedGames = games.filter(
    (game) => game.status === 'pending' || game.status === 'ongoing'
  )
  const yourGames = nonEndedGames.filter(
    (game) => userUuid && (game.playerWhiteId === userUuid || game.playerBlackId === userUuid)
  )
  const availableGames = nonEndedGames.filter(
    (game) =>
      game.status === 'pending' &&
      (!game.playerWhiteId || !game.playerBlackId) &&
      !(userUuid && (game.playerWhiteId === userUuid || game.playerBlackId === userUuid))
  )
  const otherGames = nonEndedGames.filter(
    (game) =>
      !yourGames.includes(game) && !availableGames.includes(game)
  )

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

  // Debug: log when component mounts
  useEffect(() => {
    console.log('[HomePage] Component mounted');
  }, []);

  // Debug: log when games are loaded (and the number of games)
  useEffect(() => {
    console.log('[HomePage] games loaded:', games.length, 'games');
  }, [games]);

  const getStatusBadgeVariant = (status: string | null): "default" | "secondary" | "outline" | "destructive" => {
    if (!status) return "secondary"
    if (status.includes("wins")) return "default"
    if (status === "ongoing") return "default"
    if (status === "pending") return "secondary"
    if (status.includes("draw") || status === "stalemate") return "outline"
    return "destructive"
  }

  const getPlayerDisplay = (id: string | null | undefined): string => {
    if (id) {
      return `${id.substring(0, 6)}...${id.substring(id.length - 4)}`
    }
    return "Open Slot"
  }

  // For 'Your Games', sort so games where it's your turn are first, both sorted by most recent
  const yourTurnGames = yourGames.filter((game) => isUsersTurn(game, userUuid)).sort((a, b) => b.updatedAt - a.updatedAt)
  const notYourTurnGames = yourGames.filter((game) => !isUsersTurn(game, userUuid)).sort((a, b) => b.updatedAt - a.updatedAt)

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
            <Auth />
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
          {userUuid && (
            <p className="mt-6 text-sm text-slate-400">
              Connected as:{" "}
              <span className="font-mono text-sky-300">
                {userUuid ? `${userUuid.substring(0, 6)}...${userUuid.substring(userUuid.length - 4)}` : "Guest"}
              </span>
            </p>
          )}
        </section>

        {/* Games List Section */}
        <section>
          {!isLoadingGames && userUuid !== undefined && yourGames.length === 0 && availableGames.length === 0 && otherGames.length === 0 && (
            (() => { console.log('[HomePage] Rendering No Games Found card'); return null; })()
          )}

          {!isLoadingGames && userUuid !== undefined && (
            (() => { console.log('[HomePage] Rendering games sections', { yourGames: yourGames.length, availableGames: availableGames.length, otherGames: otherGames.length }); return null; })()
          )}

          {!isLoadingGames && userUuid !== undefined && (
            <>
              {/* Section: Your Games */}
              {yourGames.length > 0 && (
                <div className="mb-10">
                  <h4 className="text-xl font-semibold mb-3 font-crimson">Your Games</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...yourTurnGames, ...notYourTurnGames].map((game) => {
                      const yourTurn = isUsersTurn(game, userUuid);
                      return (
                        <Card
                          key={game.id}
                          className="bg-slate-800/70 border-slate-700 shadow-md hover:border-sky-500/70 transition-all duration-200 flex flex-col"
                        >
                          <CardHeader className="p-3">
                            <div className="flex justify-between items-start gap-2">
                              {yourTurn && (
                                <span className="flex items-center gap-1 text-green-400 font-semibold text-xs">
                                  <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                                  Your move
                                </span>
                              )}
                              <CardTitle className="text-xs font-mono text-sky-400 leading-tight flex items-center gap-2">
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
                                {getPlayerDisplay(game.playerWhiteId)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center text-slate-400">
                                <CircleUser className="w-3 h-3 mr-1 text-white bg-slate-900 rounded-full p-0.5" />
                                Black:
                              </span>
                              <span className="font-mono text-slate-200 truncate max-w-[100px] sm:max-w-[120px]">
                                {getPlayerDisplay(game.playerBlackId)}
                              </span>
                            </div>
                          </CardContent>
                          <CardFooter className="p-3 pt-2 flex flex-col items-stretch space-y-1.5">
                            <Button asChild size="sm" className="w-full">
                              <Link href={`/play/${game.id}`}>
                                {game.status === "pending" &&
                                  (!game.playerWhiteId ||
                                    !game.playerBlackId ||
                                    (userUuid &&
                                      (game.playerWhiteId === userUuid || game.playerBlackId === userUuid)))
                                  ? "Join Game"
                                  : "View Game"}
                              </Link>
                            </Button>
                            <div className="text-center text-slate-500 text-[10px] pt-0.5">
                              <RelativeTimeDisplay dateString={new Date(game.updatedAt).toISOString()} />
                            </div>
                          </CardFooter>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Section: Available Games */}
              {availableGames.length > 0 && (
                <div className="mb-10">
                  <h4 className="text-xl font-semibold mb-3 font-crimson">Available Games</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {availableGames.map((game) => (
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
                              {getPlayerDisplay(game.playerWhiteId)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center text-slate-400">
                              <CircleUser className="w-3 h-3 mr-1 text-white bg-slate-900 rounded-full p-0.5" />
                              Black:
                            </span>
                            <span className="font-mono text-slate-200 truncate max-w-[100px] sm:max-w-[120px]">
                              {getPlayerDisplay(game.playerBlackId)}
                            </span>
                          </div>
                        </CardContent>
                        <CardFooter className="p-3 pt-2 flex flex-col items-stretch space-y-1.5">
                          <Button asChild size="sm" className="w-full">
                            <Link href={`/play/${game.id}`}>
                              {game.status === "pending" &&
                                (!game.playerWhiteId ||
                                  !game.playerBlackId ||
                                  (userUuid &&
                                    (game.playerWhiteId === userUuid || game.playerBlackId === userUuid)))
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
                </div>
              )}

              {/* Section: Other Games */}
              {otherGames.length > 0 && (
                <div className="mb-10">
                  <h4 className="text-xl font-semibold mb-3 font-crimson">Other Games</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {otherGames.map((game) => (
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
                              {getPlayerDisplay(game.playerWhiteId)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center text-slate-400">
                              <CircleUser className="w-3 h-3 mr-1 text-white bg-slate-900 rounded-full p-0.5" />
                              Black:
                            </span>
                            <span className="font-mono text-slate-200 truncate max-w-[100px] sm:max-w-[120px]">
                              {getPlayerDisplay(game.playerBlackId)}
                            </span>
                          </div>
                        </CardContent>
                        <CardFooter className="p-3 pt-2 flex flex-col items-stretch space-y-1.5">
                          <Button asChild size="sm" className="w-full">
                            <Link href={`/play/${game.id}`}>
                              {game.status === "pending" &&
                                (!game.playerWhiteId ||
                                  !game.playerBlackId ||
                                  (userUuid &&
                                    (game.playerWhiteId === userUuid || game.playerBlackId === userUuid)))
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
                </div>
              )}
            </>
          )}
          {(isLoadingGames || userUuid === undefined) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-slate-800/70 border-slate-700 shadow-md rounded-lg animate-pulse flex flex-col"
                  style={{ minHeight: 180 }}
                >
                  <div className="p-3 flex justify-between items-center">
                    <div className="h-4 bg-slate-700 rounded w-1/3" />
                    <div className="h-4 bg-slate-700 rounded w-1/4" />
                  </div>
                  <div className="p-3 pt-0 flex-1 space-y-2">
                    <div className="h-3 bg-slate-700 rounded w-2/3" />
                    <div className="h-3 bg-slate-700 rounded w-1/2" />
                  </div>
                  <div className="p-3 pt-2">
                    <div className="h-8 bg-slate-700 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {/* Finished Games Section */}
        {endedGames.length > 0 && (
          <section className="mt-12">
            <h4 className="text-xl font-semibold mb-3 font-crimson">Finished Games</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {endedGames.map((game) => (
                <Card
                  key={game.id}
                  className="bg-slate-800/70 border-slate-700 shadow-md hover:border-sky-500/70 transition-all duration-200 flex flex-col"
                >
                  <CardHeader className="p-3">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-xs font-mono text-sky-400 leading-tight flex items-center gap-2">
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
                        {getPlayerDisplay(game.playerWhiteId)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center text-slate-400">
                        <CircleUser className="w-3 h-3 mr-1 text-white bg-slate-900 rounded-full p-0.5" />
                        Black:
                      </span>
                      <span className="font-mono text-slate-200 truncate max-w-[100px] sm:max-w-[120px]">
                        {getPlayerDisplay(game.playerBlackId)}
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="p-3 pt-2 flex flex-col items-stretch space-y-1.5">
                    <Button asChild size="sm" className="w-full">
                      <Link href={`/play/${game.id}`}>View Game</Link>
                    </Button>
                    <div className="text-center text-slate-500 text-[10px] pt-0.5">
                      <RelativeTimeDisplay dateString={new Date(game.updatedAt).toISOString()} />
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-slate-700 mt-12">
        <p className="text-sm text-slate-400">&copy; {new Date().getFullYear()} Stacks Chess. All rights reserved.</p>
      </footer>
    </div>
  )
}
