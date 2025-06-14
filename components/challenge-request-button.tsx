"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Swords, Loader2 } from "lucide-react"

export default function ChallengeRequestButton() {
    const [isOpen, setIsOpen] = useState(false)
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()

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

        setIsLoading(true)
        console.log('[ChallengeRequestButton] *** Starting API call to /api/challenge')

        try {
            const response = await fetch('/api/challenge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message.trim() })
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
                    className="border-sky-500 text-sky-400 hover:bg-sky-500 hover:text-white transition-colors text-base px-8 py-3"
                >
                    <Swords className="w-4 h-4 mr-2" />
                    Send Challenge
                </Button>
            </SheetTrigger>
            <SheetContent className="bg-slate-900 border-slate-700">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2 text-slate-100">
                        <Swords className="w-5 h-5 text-sky-400" />
                        Send Challenge Request
                    </SheetTitle>
                    <SheetDescription className="text-slate-300">
                        Broadcast a message to all online players that you're looking for a game.
                    </SheetDescription>
                </SheetHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <label htmlFor="message" className="text-sm font-medium text-slate-200">Your Message</label>
                        <Input
                            id="message"
                            placeholder="Enter your challenge message..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            maxLength={100}
                            disabled={isLoading}
                            className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:ring-sky-500"
                        />
                        <div className="text-xs text-slate-400 text-right">
                            {message.length}/100 characters
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-slate-200">Quick Messages:</label>
                        <div className="grid grid-cols-1 gap-1">
                            {defaultMessages.map((defaultMessage, index) => (
                                <Button
                                    key={index}
                                    variant="ghost"
                                    size="sm"
                                    className="justify-start text-xs h-8 text-slate-300 hover:text-slate-100 hover:bg-slate-800"
                                    onClick={() => handleQuickMessage(defaultMessage)}
                                    disabled={isLoading}
                                >
                                    "{defaultMessage}"
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                <SheetFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                        disabled={isLoading}
                        className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSendChallenge}
                        disabled={isLoading || !message.trim()}
                        className="bg-sky-500 hover:bg-sky-600 text-white"
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