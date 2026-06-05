# Changelog

All notable changes to this project will be documented here.

---

## [1.6.0] — 2026-06-05

### Added
- **Currency feature** — a calculated amount can be appended to every win message posted to chat (e.g. `+1200`). Controlled by a new `currency` config section with `enabled`, `formula`, and `currencyTemplate` fields. The formula supports a `streak` variable so the reward can scale with the current streak count. `currencyTemplate` controls the formatting — `{currency}` is replaced with the calculated value (e.g. `"(+{currency})"` → `(+1200)`)
- `autoStartAfterWin` config flag (default `true`) — when set to `false`, the next round is not scheduled after a correct guess. Fixes a ghost-pick issue where the reveal timers fire during the OBS source unload window (caused by "Shutdown source when not visible"), adding a character to `recentPicks` and `streak.json` before the page fully closes. Timeouts always continue automatically regardless of this setting

---

## [1.5.1] — 2026-06-05

### Fixed
- Regex aliases now participate in the same longest-match-wins pool as literal aliases — a more specific regex (e.g. Alt Agnes Tachyon matching `"alt apple tart"` at 14 chars) correctly beats a less specific one (Agnes Tachyon matching `"apple tart"` at 10 chars)

---

## [1.5.0] — 2026-06-05

### Added
- **Persistence system** — recent pick history and streak state are now saved to `streak.json` at the start of every round and restored on startup, so both survive an OBS source hide/show or server restart
- New `persistence.enabled` config flag as the master switch for all disk state. `streak.enabled` still controls streak tracking independently, but requires persistence to be on in order to survive restarts
- `recentHistorySize` now works across restarts — previously the repeat-avoidance history was lost every time the source reloaded

### Fixed
- Guesses with trailing punctuation (e.g. `"Mihono Bourbon?"`, `"Ballroom Mejiro Ardan ?"`) no longer fail to match — punctuation removal could leave a trailing space that prevented the exact match from firing
- Guesses with extra words before or after the character name (e.g. `"Oh Valentine Taiki Shuttle"`, `"alt k.s miracle meow meow"`) now resolve correctly using a longest-match-wins rule — previously these were rejected as ambiguous because a shorter alias from a related character also appeared in the message

---

## [1.4.0] — 2026-04-28

### Fixed
- Slide-in animation now plays correctly on the very first round — previously the transition was skipped because the browser hadn't committed the starting state. Fixed with a forced reflow before adding the animation class
- Streak state is now loaded once at startup (awaited) before the first round begins, eliminating a race condition where the first round could start with stale streak data

### Added
- `start-server.sh` for Mac / Linux users
- Streak event log shown in the debug panel for easier diagnosis
- `server.py` now sends `Cache-Control: no-store` on all responses so OBS always fetches fresh files rather than serving a cached version of the overlay

### Changed
- `start-server.bat` now tries `python3` before falling back to `python`, matching the behaviour of the new shell script
- Image element starts hidden in `index.html` to prevent a flash of alt text before the first image loads
- Streak module rebuilt from scratch (`streakLoad` / `streakOnWin` / `streakOnReset` / `streakRender`) with cleaner separation of concerns

---

## [1.3.0] — 2026-04-26

### Added
- `goLiveDelaySeconds` config option — how long to wait after OBS goes live before starting the first round, giving the streamer time to get settled
- `noWinnerText` now supports the `{character}` placeholder

### Changed
- `winnerTextTemplate` renamed to `winnerText` and now includes `{character}` so the revealed name can appear in the win message
- `winnerStreakTextTemplate` renamed to `winnerStreakText` for consistency
- `answerTextTemplate` removed — the answer is now always derived from the winning message templates
- All round-start code paths now go through `startRoundWhenReady()`, so `pauseWhenNotLive` is correctly respected on initial load and when the source becomes visible again (previously it was only checked between rounds)

### Fixed
- When `pauseWhenNotLive` is enabled and a round times out while OBS is not streaming, the streak is now preserved — the timer expiring was not the viewer's fault

---

## [1.2.0] — 2026-04-26

### Added
- **Slide animations** — character images can slide in and out in configurable directions (`left`, `right`, `up`, `down`, or `none`)
- `imageOnly` display mode — hides the game title and prompt text, leaving only the character silhouette. Designed to be used alongside slide animations
- `slideInDirection`, `slideOutDirection`, and `slideDurationSeconds` config options
- **Streak persistence** — streak state is now written to `streak.json` via the local server after every change, and reloaded at startup. Streaks survive overlay reloads and server restarts
- `server.py` — Python development server that handles static file serving and the `POST /write-streak` endpoint for saving streak state to disk

---

## [1.1.0] — 2026-04-25

### Added
- **Regex aliases** — character list entries can include `/pattern/flags` style regex aliases (e.g. `Agnes Tachyon|/\b[Aa]\w* [Tt]\w*\b/`) in addition to plain text aliases
- **JSON comment support** — `config.json` and `config.local.json` now support `//` line comments and `/* */` block comments, making the config template much easier to read and annotate
- `findMatchingCharacters()` — new internal function that splits matches into exact, contains, and regex categories, with clear ambiguity rules: exact matches always win; contains and regex matches only win if the current character is the sole match
- `start-server.bat` — Windows batch script to launch the development server with a clear error message if Python is not installed
- `images/placeholder.png` — shown when a character's image file is missing, preventing a broken image from stopping the round

### Changed
- `normalizeGuess()` now strips periods and dots, so aliases like `K.S. Miracle` normalize correctly
- Character list parsing now separates literal aliases from regex aliases at load time

---

## [1.0.0] — 2026-04-25

Initial release.

### Features
- OBS browser source overlay that displays random characters as black silhouettes
- Twitch chat integration via IRC WebSocket — listens for guesses, posts win and no-winner messages to chat
- Character list loaded from `characters.txt` with pipe-delimited aliases (`Canonical Name|alias one|alias two`)
- Two-layer config system — `config.json` holds defaults, `config.local.json` overrides (gitignored)
- Streak tracking — consecutive correct answers by the same viewer, with configurable announce threshold and overlay display
- Repeat avoidance — configurable recent pick history prevents the same character appearing too soon
- `pauseWhenNotLive` — rounds only start when OBS is actively streaming or recording
- Keyboard controls — `N` next round, `R` reveal, `D` debug panel, `S` silhouette toggle, `P` pick by name, `Space` reveal/next
- Debug panel with connection status, current character, recent guesses, IRC log, and warnings
- Transparent background for OBS compositing
- `config.local.template.json` with all settings documented inline
