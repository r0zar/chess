# 🛠️ Development Setup Guide

## 🚀 **One Command Development**

Your dev script now runs both servers automatically:

```bash
pnpm run dev
```

This starts:
- **Next.js** on `http://localhost:3000` (blue logs)
- **PartyKit** on `http://localhost:1999` (magenta logs)

## 📊 **What You'll See**

```
[Next.js] ⚡ Ready on http://localhost:3000
[PartyKit] 🎈 PartyKit ready on http://localhost:1999
```

## 🎮 **Testing Real-Time Chess**

1. **Start development**: `pnpm run dev`
2. **Open two browser windows**: `http://localhost:3000`
3. **Join the same game** in both windows
4. **Make moves** - they appear instantly! ⚡

## 🔧 **Individual Scripts**

If you need to run servers separately:

```bash
# Next.js only
pnpm run dev:next

# PartyKit only  
pnpm run dev:party

# Deploy PartyKit to production
pnpm run party:deploy
```

## 🎯 **Log Colors**

- **🔵 Blue**: Next.js logs (API routes, build info)
- **🟣 Magenta**: PartyKit logs (connections, broadcasts)

## 🏗️ **Architecture**

```
┌─────────────────┐    ┌─────────────────┐
│   Next.js       │    │   PartyKit      │
│   :3000         │◄──►│   :1999         │
│                 │    │                 │
│ • Chess API     │    │ • Real-time     │
│ • Game Logic    │    │ • WebSockets    │
│ • Authentication│    │ • Broadcasting  │
└─────────────────┘    └─────────────────┘
```

## 🎊 **Benefits**

- ✅ **Single command** starts everything
- ✅ **Color-coded logs** for easy debugging  
- ✅ **Automatic restarts** when code changes
- ✅ **Production-ready** PartyKit deployment

Happy coding! 🚀 