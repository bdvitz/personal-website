# Removed: Chess.com guest lookup & client-triggered refreshes

Removed 2026-09-27. The last commit with the full implementation is `8df46b7`. To restore a file:
`git show 8df46b7:<path>`.

## Why it was removed
Every one of these endpoints made the Railway server call api.chess.com on behalf of an anonymous visitor,
for any username. On the free tier that spent the server's compute and network budget, and it could be abused.
The site now serves only the stored user's data from Postgres (kept fresh by the nightly scheduler) plus the static snapshot.

## Removed backend endpoints
| Endpoint | Controller method | Service call |
|---|---|---|
| `POST /api/chess/stats/refresh?username=` | `ChessStatsController.refreshStats` | `ChessStatsService.fetchAndUpdateCurrentStats` (still used by the scheduler) |
| `GET /api/chess/stats/guest-current?username=` | `ChessStatsController.fetchGuestCurrentStats` | `ChessStatsService.fetchCurrentStats` -> `ChessComApiService.fetchChessStats` |
| `GET /api/chess/stats/verify?username=` | `ChessStatsController.verifyUser` | `ChessStatsService.verifyUserExists` -> `ChessComApiService.getUserInfo` |
| `POST /api/chess/history/refresh?username=&year=&month=` | `ChessHistoryController.refreshMonthHistory` | `ChessHistoryService.fetchAndUpdateMonthHistory` (still used by the scheduler) |
| `GET /api/chess/history/guest-month?username=&year=&month=` | `ChessHistoryController.fetchGuestMonthHistory` | `ChessHistoryService.fetchMonthHistory` |

`verify` mapped errors as follows: 404 when the user doesn't exist (`HttpClientErrorException.NotFound`), 503 when the message contains
"unavailable"/"timeout"/"null response", and 500 otherwise. It returned `{exists, username, joinedTimestamp, message}`.

## Removed backend code
- `ChessComApiService.getUserInfo(username)` fetched `GET https://api.chess.com/pub/player/{username}` and read the `joined`
  field (Unix seconds). It returned `model/UserVerificationResponse(exists, username, joinedTimestamp)`.
- `model/UserVerificationResponse` was a plain POJO with fields `exists`, `username` and `joinedTimestamp`.
- `ChessStatsService.verifyUserExists` was a pass-through to `getUserInfo`.
- The live-API fallbacks were removed:
  - `ChessStatsService.getCurrentStats` used to fall back to a live Chess.com fetch when the DB had no row. Note that it used `orElse`, so it
    actually called Chess.com on every request, even when the row existed.
  - `ChessHistoryService.getMonthHistory` used to fetch live when `existsByUsername` was false (the "guest" path).

## Removed client code
- `client/lib/api.ts`: `refreshChessStats`, `fetchMonthHistory` (guest-month, 30 s timeout), `refreshMonthHistory`
  (30 s timeout), `verifyChessComUser` (2 s timeout, maps errors to friendly messages) and `getGuestStats`.
  `getChessStats` no longer auto-calls refresh on a 404.
- `client/types/chess.ts`: `UserVerificationResponse`.
- `client/app/chess/page.tsx`:
  - **Guest mode** (`userMode === 'guest'`): the "Search User" toggle showed a username input and a "Verify User" button.
    `handleGuestSearch` called verify and then `getGuestStats`. It stored `guestUsername`, `userVerified`, and `userJoinDate`
    (from `joinedTimestamp * 1000`). The "all" time range started at the join date, and the "Update Rating from Chess.com" button ran
    `HistoricalDataFetcher` with `dataSource: 'guest'`, fetching month by month and caching all-or-nothing. A help box noted
    about 5-10 s per year of data because of rate limiting.
  - **Stored mode**, "Update Rating from Chess.com" (`handleUpdateFromApi`): ran `HistoricalDataFetcher` with
    `dataSource: 'update'`, which POSTed `/history/refresh` for each month in range to re-sync the DB from Chess.com.
  - **On mount and "Refresh Stats"**: both called `getGuestStats` (live) for the stored user.
- `HistoricalDataFetcher.tsx`: the `'update'` and `'guest'` data sources (only `'database'` remains).

## Re-implementation notes
- If this comes back, put it behind auth or a strict rate limit. Anything public on this server has no protection.
- `ChessComApiService.fetchMonthlyGames` (with 429 backoff) and `fetchChessStats` remain and are reusable.
