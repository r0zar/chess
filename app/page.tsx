"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { GameData } from "@/lib/chess-data.types"
import RelativeTimeDisplay from "@/components/relative-time-display"
import CreateGameButton from "@/components/lobby/create-game-button"
import ChallengeRequestButton from "@/components/lobby/challenge-request-button"
import Auth from "@/components/auth"
import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { Crown, CircleUser, Trophy, Zap, Users, TrendingUp } from "lucide-react"
import GameCard from "@/components/lobby/game-card"

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

function isUsersTurn(game: GameData, userUuid: string | null): boolean {
  if (!userUuid || !game.currentFen) return false;
  if (game.status !== "ongoing") return false;
  const fenParts = game.currentFen.split(' ');
  const fenTurn = fenParts[1];
  let userColor: 'w' | 'b' | null = null;
  if (game.playerWhiteId === userUuid) userColor = 'w';
  if (game.playerBlackId === userUuid) userColor = 'b';
  return userColor === fenTurn;
}

export default function HomePage() {
  const [games, setGames] = useState<GameData[]>([])
  const [isLoadingGames, setIsLoadingGames] = useState(true)
  const { toast } = useToast()

  const userUuid = typeof window !== 'undefined' ? localStorage.getItem('user-uuid') : null;

  const endedGames = games.filter(
    (game) => game.status !== 'pending' && game.status !== 'ongoing'
  ).sort((a, b) => b.updatedAt - a.updatedAt)

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

  useEffect(() => {
    console.log('[HomePage] Component mounted');
  }, []);

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
    return "Open"
  }

  const yourTurnGames = yourGames.filter((game) => isUsersTurn(game, userUuid)).sort((a, b) => b.updatedAt - a.updatedAt)
  const notYourTurnGames = yourGames.filter((game) => !isUsersTurn(game, userUuid)).sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-800/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-3">
              <div className="relative">
                <Crown className="h-7 w-7 text-amber-400" />
                <div className="absolute -inset-1 bg-amber-400/20 rounded-full blur-sm" />
              </div>
              <span className="text-xl font-semibold text-white tracking-tight">Stacks Chess</span>
            </Link>
            <div className="flex items-center space-x-6">
              <Link
                href="/admin/dashboard"
                className="text-sm font-medium text-neutral-400 hover:text-white transition-colors duration-200"
              >
                Admin
              </Link>
              <Auth />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950" />
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-amber-400/3 rounded-full blur-3xl transform -translate-y-1/2" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-blue-400/3 rounded-full blur-3xl" />

        {/* Minimal floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-20 text-2xl animate-levitate opacity-60">✨</div>
          <div className="absolute top-1/3 right-20 text-2xl animate-drift opacity-40">⭐</div>
          <div className="absolute bottom-32 left-1/3 text-2xl animate-levitate-delayed opacity-50">💫</div>
          <div className="absolute bottom-20 right-1/4 text-2xl animate-drift-delayed opacity-30">✨</div>
        </div>

        <div className="relative max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
            {/* Left side - Hero content (2/3 width) */}
            <div className="lg:col-span-2 space-y-10">
              <div className="space-y-6">
                <h1 className="text-5xl md:text-6xl xl:text-7xl font-bold text-white tracking-tight leading-[1.1]">
                  Strategic
                  <span className="block bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent">
                    Chess Mastery
                  </span>
                </h1>
                <p className="text-xl text-neutral-300 leading-relaxed max-w-2xl">
                  Experience chess like never before on the blockchain. Every move matters, every victory counts.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <CreateGameButton />
                <ChallengeRequestButton />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-6 max-w-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{games.length}</div>
                  <div className="text-sm text-neutral-400 mt-1">Active Games</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{yourTurnGames.length}</div>
                  <div className="text-sm text-neutral-400 mt-1">Your Turn</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400">{availableGames.length}</div>
                  <div className="text-sm text-neutral-400 mt-1">Available</div>
                </div>
              </div>

              {/* User Status */}
              {userUuid && (
                <div className="inline-flex items-center space-x-2 bg-neutral-800/40 backdrop-blur-sm border border-neutral-700/50 rounded-full px-4 py-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-sm text-neutral-300">Connected</span>
                  <code className="text-sm font-mono text-amber-400">
                    {`${userUuid.substring(0, 6)}...${userUuid.substring(userUuid.length - 4)}`}
                  </code>
                </div>
              )}
            </div>

            {/* Right side - EXP Rewards (1/3 width) */}
            <div className="relative lg:col-span-1">
              <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800/60 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 via-transparent to-amber-600/5" />

                <div className="relative z-10 space-y-5">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <div className="text-xl animate-gentle-bounce">✨</div>
                      <h3 className="text-lg font-semibold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                        EXP Rewards
                      </h3>
                    </div>
                    <p className="text-neutral-400 text-sm">Level up with every move</p>
                  </div>

                  <div className="space-y-3">
                    {/* Move reward */}
                    <div className="flex items-center justify-between bg-neutral-800/60 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <Zap className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium">Every Move</div>
                          <div className="text-neutral-500 text-xs">Strategic play</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-400">+10</div>
                        <div className="text-xs text-neutral-500">EXP</div>
                      </div>
                    </div>

                    {/* Win reward */}
                    <div className="flex items-center justify-between bg-amber-900/30 rounded-xl p-4 border border-amber-500/20">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                          <Trophy className="h-4 w-4 text-amber-400" />
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium">Victory</div>
                          <div className="text-neutral-500 text-xs">Win the game</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-amber-400">+200</div>
                        <div className="text-xs text-neutral-500">EXP</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-neutral-800/40 rounded-lg p-3 space-y-1">
                    <div className="flex items-center space-x-2 text-xs">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                      <span className="text-neutral-300">Connect wallet for rewards</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full" />
                      <span className="text-neutral-400">Play as guest for fun</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Games Section */}
      <section className="px-6 lg:px-8 pb-20">
        <div className="max-w-7xl mx-auto">
          {!isLoadingGames && userUuid !== undefined && (
            <>
              {/* Your Games */}
              {yourGames.length > 0 && (
                <div className="my-16">
                  <div className="flex items-center space-x-3 mb-8">
                    <TrendingUp className="h-6 w-6 text-amber-400" />
                    <h2 className="text-2xl font-semibold text-white">Your Games</h2>
                    <div className="bg-amber-400/10 text-amber-400 text-sm font-medium px-3 py-1 rounded-full">
                      {yourTurnGames.length} awaiting
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...yourTurnGames, ...notYourTurnGames].map((game) => {
                      const yourTurn = isUsersTurn(game, userUuid);
                      return (
                        <GameCard
                          key={game.id}
                          game={game}
                          userUuid={userUuid}
                          getStatusBadgeVariant={getStatusBadgeVariant}
                          getPlayerDisplay={getPlayerDisplay}
                          yourTurn={yourTurn}
                          footer={
                            <>
                              <Button
                                asChild
                                className="w-full bg-gradient-to-r from-neutral-800 to-neutral-700 hover:from-neutral-700 hover:to-neutral-600 border border-neutral-600/50 hover:border-neutral-500 text-white font-medium h-10 rounded-xl transition-all duration-200 group-hover:shadow-lg"
                                size="sm"
                              >
                                <Link href={`/play/${game.id}`}>
                                  {game.status === "pending" &&
                                    (!game.playerWhiteId ||
                                      !game.playerBlackId ||
                                      (userUuid &&
                                        (game.playerWhiteId === userUuid || game.playerBlackId === userUuid)))
                                    ? "Join Game"
                                    : "Continue"}
                                </Link>
                              </Button>
                              <div className="text-[10px] text-neutral-500 mt-1 text-right w-full">
                                <RelativeTimeDisplay
                                  dateString={new Date(game.updatedAt).toISOString()}
                                  className="inline"
                                />
                              </div>
                            </>
                          }
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Available Games */}
              {availableGames.length > 0 && (
                <div className="mb-16">
                  <div className="flex items-center space-x-3 mb-8">
                    <Users className="h-6 w-6 text-blue-400" />
                    <h2 className="text-2xl font-semibold text-white">Open Games</h2>
                    <div className="bg-blue-400/10 text-blue-400 text-sm font-medium px-3 py-1 rounded-full">
                      {availableGames.length} available
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {availableGames.map((game) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        userUuid={userUuid}
                        getStatusBadgeVariant={getStatusBadgeVariant}
                        getPlayerDisplay={getPlayerDisplay}
                        footer={
                          <>
                            <Button
                              asChild
                              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium h-10 rounded-xl transition-all duration-200 group-hover:shadow-lg shadow-blue-500/25"
                              size="sm"
                            >
                              <Link href={`/play/${game.id}`}>Join Game</Link>
                            </Button>
                            <div className="text-[10px] text-neutral-500 mt-1 text-right w-full">
                              <RelativeTimeDisplay
                                dateString={new Date(game.updatedAt).toISOString()}
                                className="inline"
                              />
                            </div>
                          </>
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Other Games */}
              {otherGames.length > 0 && (
                <div className="mb-16">
                  <div className="flex items-center space-x-3 mb-8">
                    <Trophy className="h-6 w-6 text-neutral-400" />
                    <h2 className="text-2xl font-semibold text-white">Live Games</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {otherGames.map((game) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        userUuid={userUuid}
                        getStatusBadgeVariant={getStatusBadgeVariant}
                        getPlayerDisplay={getPlayerDisplay}
                        footer={
                          <>
                            <Button
                              asChild
                              variant="outline"
                              className="w-full border-neutral-700/60 bg-neutral-800/40 hover:bg-neutral-700/60 text-neutral-300 hover:text-white font-medium h-10 rounded-xl transition-all duration-200"
                              size="sm"
                            >
                              <Link href={`/play/${game.id}`}>Spectate</Link>
                            </Button>
                            <div className="text-[10px] text-neutral-500 mt-1 text-right w-full">
                              <RelativeTimeDisplay
                                dateString={new Date(game.updatedAt).toISOString()}
                                className="inline"
                              />
                            </div>
                          </>
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Loading State */}
          {(isLoadingGames || userUuid === undefined) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-neutral-900/40 backdrop-blur-sm border border-neutral-800/50 rounded-2xl p-6 animate-pulse"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="h-4 bg-neutral-800 rounded w-16" />
                      <div className="h-5 bg-neutral-800 rounded w-20" />
                    </div>
                    <div className="h-4 bg-neutral-800 rounded w-24" />
                    <div className="space-y-2">
                      <div className="h-3 bg-neutral-800 rounded w-full" />
                      <div className="h-3 bg-neutral-800 rounded w-3/4" />
                    </div>
                    <div className="h-8 bg-neutral-800 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Finished Games */}
          {endedGames.length > 0 && (
            <div className="mt-16">
              <div className="flex items-center space-x-3 mb-8">
                <Trophy className="h-6 w-6 text-neutral-500" />
                <h2 className="text-2xl font-semibold text-white">Recent Matches</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {endedGames.slice(0, 8).map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    userUuid={userUuid}
                    getStatusBadgeVariant={getStatusBadgeVariant}
                    getPlayerDisplay={getPlayerDisplay}
                    footer={
                      <>
                        <Button
                          asChild
                          variant="ghost"
                          className="w-full text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800/50 font-medium h-10 rounded-xl transition-all duration-200"
                          size="sm"
                        >
                          <Link href={`/play/${game.id}`}>Review</Link>
                        </Button>
                        <div className="text-[10px] text-neutral-500 mt-1 text-right w-full">
                          <RelativeTimeDisplay
                            dateString={new Date(game.updatedAt).toISOString()}
                            className="inline"
                          />
                        </div>
                      </>
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800/50 bg-neutral-950/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center">
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} Stacks Chess. Engineered for excellence.
          </p>
        </div>
      </footer>
    </div>
  )
}