'use client'

interface ServerHealthIndicatorProps {
  serverOnline: boolean | null // null = checking, true = online, false = offline
  usingSnapshot?: boolean
  userMode?: 'stored' | 'guest'
  lastUpdated?: string
}

export default function ServerHealthIndicator({
  serverOnline,
  usingSnapshot = false,
  userMode = 'stored',
  lastUpdated
}: ServerHealthIndicatorProps) {
  // Only show for stored users
  if (userMode !== 'stored') {
    return null
  }

  // State 1: Checking server status
  if (serverOnline === null) {
    return (
      <div className="bg-gray-500/20 border border-gray-400/50 rounded-lg p-4">
        <p className="text-gray-200 font-semibold mb-1">🔍 Checking Server Status...</p>
        <p className="text-gray-100 text-sm">
          Displaying snapshot data while checking server availability.
        </p>
      </div>
    )
  }

  // State 2: Server offline - showing snapshot data
  if (serverOnline === false && usingSnapshot) {
    return (
      <div className="bg-yellow-500/20 border border-yellow-400/50 rounded-lg p-4">
        <p className="text-yellow-200 font-semibold mb-2">⚠️ Server Offline - Using Snapshot Data</p>
        <p className="text-yellow-100 text-sm">
          The backend server is currently sleeping and may take <strong>up to 2 minutes</strong> to come online.
          You are viewing snapshot data from the last backup.
        </p>
        <p className="text-yellow-100 text-sm mt-2">
          Click "Refresh Stats" to attempt reconnection and fetch live data.
        </p>
      </div>
    )
  }

  // State 3: Server online but still showing snapshot (transitioning to live data)
  if (serverOnline === true && usingSnapshot) {
    return (
      <div className="bg-blue-500/20 border border-blue-400/50 rounded-lg p-4">
        <p className="text-blue-200 font-semibold mb-1">📦 Displaying Snapshot Data</p>
        <p className="text-blue-100 text-sm">
          Server is online. You're viewing cached snapshot data. Click "Refresh Stats" to load live data from the server.
        </p>
      </div>
    )
  }

  // State 4: Server online and showing live data
  if (serverOnline === true && !usingSnapshot) {
    return (
      <div className="bg-green-500/20 border border-green-400/50 rounded-lg p-4">
        <p className="text-green-200 font-semibold">
          ✓ Live Data from Server
        </p>
        {lastUpdated && (
          <p className="text-green-100 text-sm mt-1">
            Last updated: {lastUpdated}
          </p>
        )}
      </div>
    )
  }

  return null
}
