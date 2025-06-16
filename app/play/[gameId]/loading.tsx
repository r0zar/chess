"use client"

export default function LoadingGame() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-2 h-2 bg-amber-400/30 rounded-full animate-pulse" />
        <div className="absolute top-40 right-32 w-1 h-1 bg-blue-400/40 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-1/4 w-1.5 h-1.5 bg-amber-300/20 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-20 right-20 w-1 h-1 bg-blue-300/30 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-1/3 left-1/2 w-1 h-1 bg-amber-400/25 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-amber-400/5 via-transparent to-transparent" />

      <div className="relative z-10 flex flex-col items-center space-y-12 p-8 max-w-2xl mx-auto">
        {/* Header with crown */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-xl scale-150 animate-pulse" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-amber-400/20 to-amber-600/20 rounded-2xl border border-amber-400/30 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-8 h-8 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 16L3 21h18l-2-5H5zm2.7-2h8.6l.9-2H6.8l.9 2zm9.6-4h2.4L17 4h-2l2.3 6zM9 4H7l-2.7 6h2.4L9 4zm3-2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-amber-100 to-white bg-clip-text text-transparent">
            Chess
          </h1>
          <p className="text-neutral-400 text-lg">Loading your game...</p>
        </div>

        {/* Epic chess board skeleton */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 via-transparent to-blue-400/10 rounded-3xl blur-2xl scale-110" />

          {/* Board container */}
          <div className="relative w-80 h-80 sm:w-96 sm:h-96 bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 backdrop-blur-xl rounded-3xl border border-neutral-800/60 p-6 shadow-2xl">
            {/* Chess board grid */}
            <div className="w-full h-full grid grid-cols-8 gap-0 rounded-2xl overflow-hidden border border-neutral-700/40">
              {Array.from({ length: 64 }).map((_, i) => {
                const row = Math.floor(i / 8)
                const col = i % 8
                const isLight = (row + col) % 2 === 0
                const delay = (i * 0.02) % 2

                return (
                  <div
                    key={i}
                    className={`aspect-square ${isLight
                      ? 'bg-amber-100/20 hover:bg-amber-100/30'
                      : 'bg-neutral-800/60 hover:bg-neutral-700/60'
                      } transition-all duration-300`}
                    style={{
                      animation: `pulse 2s ease-in-out infinite`,
                      animationDelay: `${delay}s`
                    }}
                  >
                    {/* Occasional piece silhouettes */}
                    {(i === 0 || i === 7 || i === 56 || i === 63) && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-4 h-4 bg-gradient-to-br from-amber-400/30 to-amber-600/30 rounded-full animate-pulse"
                          style={{ animationDelay: `${delay + 1}s` }} />
                      </div>
                    )}
                    {(i === 3 || i === 4 || i === 59 || i === 60) && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-5 h-5 bg-gradient-to-br from-blue-400/30 to-blue-600/30 rounded-lg animate-pulse"
                          style={{ animationDelay: `${delay + 0.5}s` }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Loading indicator overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/20 backdrop-blur-sm rounded-3xl">
              <div className="flex flex-col items-center space-y-4">
                {/* Spinning loader */}
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-neutral-700/30 rounded-full" />
                  <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-amber-400 rounded-full animate-spin" />
                  <div className="absolute inset-2 w-8 h-8 border-2 border-transparent border-t-blue-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                </div>

                {/* Loading text */}
                <div className="text-center space-y-1">
                  <div className="text-sm font-medium text-white">
                    Initializing game state...
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-neutral-400">
                    <div className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-1 h-1 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom status indicators */}
        <div className="flex items-center space-x-6">
          {/* Connection status */}
          <div className="flex items-center space-x-2 bg-neutral-900/40 backdrop-blur-sm border border-neutral-800/40 rounded-full px-4 py-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-neutral-300">Connecting...</span>
          </div>

          {/* Loading progress */}
          <div className="flex items-center space-x-2 bg-neutral-900/40 backdrop-blur-sm border border-neutral-800/40 rounded-full px-4 py-2">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-sm text-neutral-300">Loading assets</span>
          </div>
        </div>

        {/* Floating action hint */}
        <div className="text-center space-y-2 opacity-60">
          <p className="text-xs text-neutral-500">
            Preparing your strategic battlefield
          </p>
          <div className="flex items-center justify-center space-x-4 text-xs text-neutral-600">
            <span>🏰 Setting up pieces</span>
            <span>⚡ Syncing game state</span>
            <span>🎯 Ready to play</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        
        .bg-gradient-radial {
          background: radial-gradient(circle at center, var(--tw-gradient-stops));
        }
      `}</style>
    </div>
  )
}