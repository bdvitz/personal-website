'use client'

import { Loader2, WifiOff } from 'lucide-react'

// Shown until the first state arrives; turns into an error if the socket keeps failing
export default function ConnectingNotice({ code, unreachable }: { code: string; unreachable: boolean }) {
  if (!unreachable) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-purple-200">
        <Loader2 className="h-6 w-6 animate-spin" /> Connecting to room {code}...
      </div>
    )
  }
  return (
    <div className="card mx-auto max-w-md space-y-3 text-center">
      <WifiOff className="mx-auto h-10 w-10 text-yellow-300" />
      <p className="text-xl font-bold text-white">Can't reach the game server</p>
      <p className="text-purple-200">
        It may be waking up or restarting. Still trying to connect to room {code}; you can also refresh the page.
      </p>
      <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-300" />
    </div>
  )
}
