"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Swords, Loader2 } from "lucide-react"
import { useGlobalEvents } from "@/components/global-events-provider"

export default function ChallengeRequestButton() {
    const [isOpen, setIsOpen] = useState(false)
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()
    const { userUuid } = useGlobalEvents()

    const defaultMessages = [
        "Anyone up for a quick game?",
        "Looking for a challenging opponent!",
        "Who wants to play chess?",
        "Ready for a battle of minds!",
        "Seeking worthy opponent..."
    ]

    const handleSendChallenge = async () => {
        console.log('[ChallengeRequestButton] *** handleSendChallenge called with message:', message.trim())

        if (!message.trim()) {
            console.log('[ChallengeRequestButton] *** Message validation failed - showing error toast')
            toast({
                title: "Message Required",
                description: "Please enter a message to send with your challenge request.",
                variant: "destructive"
            })
            return
        }

        if (!userUuid) {
            toast({
                title: "User ID Missing",
                description: "Could not find your user ID. Please refresh the page.",
                variant: "destructive"
            })
            return
        }

        setIsLoading(true)
        console.log('[ChallengeRequestButton] *** Starting API call to /api/challenge')

        try {
            const response = await fetch('/api/challenge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message.trim(), userUuid })
            })

            console.log('[ChallengeRequestButton] *** API response status:', response.status)
            const data = await response.json()
            console.log('[ChallengeRequestButton] *** API response data:', data)

            if (data.success) {
                console.log('[ChallengeRequestButton] *** Challenge successful - showing success toast')
                toast({
                    title: "⚔️ Challenge Sent!",
                    description: "Your challenge request has been broadcast to all online players.",
                    duration: 4000
                })
                setMessage('')
                setIsOpen(false)
            } else {
                console.log('[ChallengeRequestButton] *** Challenge failed - showing error toast:', data.message)
                toast({
                    title: "Error",
                    description: data.message || "Failed to send challenge request.",
                    variant: "destructive"
                })
            }
        } catch (error) {
            console.error('[ChallengeRequestButton] *** Exception in challenge request:', error)
            toast({
                title: "Error",
                description: "Failed to send challenge request. Please try again.",
                variant: "destructive"
            })
        } finally {
            setIsLoading(false)
            console.log('[ChallengeRequestButton] *** Challenge request completed')
        }
    }

    const handleQuickMessage = (quickMessage: string) => {
        setMessage(quickMessage)
    }

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="lg"
                    className="border-blue-500/50 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all duration-200 text-base px-8 py-3 backdrop-blur-sm"
                >
                    <Swords className="w-4 h-4 mr-2" />
                    Send Challenge
                </Button>
            </SheetTrigger>
            <SheetContent className="bg-neutral-950/95 backdrop-blur-xl border-neutral-800/60 text-white">
                <SheetHeader className="space-y-3">
                    <SheetTitle className="flex items-center gap-2 text-white text-xl">
                        <Swords className="w-5 h-5 text-blue-400" />
                        Send Challenge Request
                    </SheetTitle>
                    <SheetDescription className="text-neutral-300 text-base">
                        Broadcast a message to all online players that you're looking for a game.
                    </SheetDescription>
                </SheetHeader>

                <div className="grid gap-6 py-6">
                    <div className="grid gap-3">
                        <label htmlFor="message" className="text-sm font-medium text-white">Your Message</label>
                        <Input
                            id="message"
                            placeholder="Enter your challenge message..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            maxLength={100}
                            disabled={isLoading}
                            className="bg-neutral-900/60 border-neutral-700/60 text-white placeholder:text-neutral-400 focus:border-blue-500 focus:ring-blue-500/20 h-12 text-base backdrop-blur-sm"
                        />
                        <div className="text-xs text-neutral-400 text-right">
                            {message.length}/100 characters
                        </div>
                    </div>

                    <div className="grid gap-3">
                        <label className="text-sm font-medium text-white">Quick Messages</label>
                        <div className="grid gap-2">
                            {defaultMessages.map((defaultMessage, index) => (
                                <Button
                                    key={index}
                                    variant="ghost"
                                    className="justify-start text-sm h-10 text-neutral-300 hover:text-white hover:bg-neutral-800/60 border border-neutral-800/40 hover:border-neutral-700/60 transition-all duration-200 rounded-lg"
                                    onClick={() => handleQuickMessage(defaultMessage)}
                                    disabled={isLoading}
                                >
                                    "{defaultMessage}"
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                <SheetFooter className="gap-3 pt-4 border-t border-neutral-800/50">
                    <Button
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                        disabled={isLoading}
                        className="border-neutral-700/60 bg-neutral-900/40 text-neutral-300 hover:bg-neutral-800/60 hover:text-white hover:border-neutral-600 transition-all duration-200 flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSendChallenge}
                        disabled={isLoading || !message.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex-1"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Swords className="w-4 h-4 mr-2" />
                                Send Challenge
                            </>
                        )}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}