# Who's That Character?

A configurable Twitch/OBS browser-source guessing game where viewers identify silhouetted characters from chat.

Bring your own images and character list. The app displays a character image as a solid black silhouette, listens to Twitch chat for guesses, and reveals the answer when someone gets it right. Win messages and streak announcements are posted to chat automatically.

---

## Screenshot

*(Add your own screenshot here once the overlay is running.)*

---

## Quick Start

1. **Clone the repo.**

2. **Copy the example character list:**

   ```
   cp characters.example.txt characters.txt
   ```

3. **Add matching images to `/images`.**  
   Each image filename must match the canonical character name (without extension).  
   Example: `characters.txt` line `Blue Wizard|wizard|mage` → image file `images/Blue Wizard.png`

4. **Copy the config template and fill in your details:**

   ```
   cp config.local.template.json config.local.json
   ```

   Edit `config.local.json` with your Twitch channel, bot credentials, and any settings you want to override.

5. **Start the local server.**

   - **Windows:** double-click `start-server.bat`. It will show a clear error if Python is not installed — download it from [python.org](https://www.python.org/downloads/) and check **"Add Python to PATH"** during installation.
   - **Mac / Linux:** run `bash start-server.sh` in a terminal (or `chmod +x start-server.sh` once, then `./start-server.sh`).

   Close the window / terminal to stop the server.

6. **Add an OBS Browser Source** pointing to:

   ```
   http://127.0.0.1:8787/index.html
   ```

   Recommended size: **1920 × 1080** (or match your scene canvas).

---

## OBS Browser Source Tips

- The overlay background is transparent by default — place it over your other sources.
- The game automatically pauses (timers stop, chat disconnects) when the source is hidden in OBS, and resumes cleanly when it becomes visible again.
- For a hard reset on each scene switch, enable **"Shutdown source when not visible"** in the browser source properties.

---

## Twitch Authentication

You need a Twitch user access token with **`chat:read`** and **`chat:write`** scopes. `chat:write` is required because the game posts results and streak announcements to chat.

1. Create a dedicated bot account on Twitch (or use your main account).
2. Generate a token at [twitchtokengenerator.com](https://twitchtokengenerator.com) — select a **Custom Scope Token** and tick `chat:read` and `chat:write`.
3. Add credentials to `config.local.json`:

   ```json
   {
     "channel": "your_channel_name",
     "twitch": {
       "useAuth": true,
       "username": "your_bot_account",
       "oauthToken": "oauth:your_token_here"
     }
   }
   ```

   > **Note:** If you use your main account as the bot, set `ignoreBotAccount: false` so your own chat messages count as valid guesses. With a separate bot account, leave it `true` so the bot's win announcements don't accidentally trigger a match.

---

## Character List Format

Each line in `characters.txt` follows this format:

```
Canonical Character Name|alias one|alias two|/regex pattern/
```

- The **canonical name** (first entry) is displayed when the answer is revealed and must match the image filename.
- Every entry including the canonical name is a valid guess.
- Aliases can be plain text **or** a `/regex/` pattern (see below).
- Lines starting with `#` are comments. Blank lines are ignored.

**Example:**

```
# My characters
Blue Wizard|wizard|mage|blue mage
Red Knight|knight|red knight|armored warrior
Agnes Tachyon|agnes tachyon|/^a\w+\s+t\w+/
```

---

## How Guess Matching Works

All chat messages are normalized before matching:

- Lowercased
- Hyphens and underscores treated as spaces
- Apostrophes and periods removed
- Extra spaces collapsed
- Unicode letters and numbers preserved

**Matching rules:**

1. **Exact match** — if the normalized message exactly equals an alias, it always wins regardless of other characters.
2. **Contains match** — if the message contains an alias anywhere (e.g. `"I think this is Blue Wizard"`), it matches — but only if no other character also matches. Ambiguous guesses are rejected.
3. **Regex aliases** — entries written as `/pattern/` or `/pattern/flags` are tested against the full normalized message.

**Regex alias example:**

```
Agnes Tachyon|agnes tachyon|/a\w+\s+t\w+/
```

This matches `apple tart`, `alpha tango`, `I think it's agnes tachyon`, etc.

---

## Adding Images

Place images in the `/images` folder. The filename (without extension) must match the canonical name exactly:

| `characters.txt` canonical name | Expected image file |
|---|---|
| `Blue Wizard` | `images/Blue Wizard.png` |
| `Christmas Biwa Hayahide` | `images/Christmas Biwa Hayahide.png` |

Set the image extension in `config.local.json`:

```json
"files": {
  "imageExtension": "png"
}
```

If an image is missing the game shows a placeholder and keeps running.

---

## Streak Tracking

The game tracks consecutive correct answers by the same viewer. The current streak holder and count are saved to `streak.json` on disk after every change, and reloaded at the start of each round — so streaks survive an overlay reload or server restart.

- The streak **increases** each time the same viewer answers correctly back-to-back.
- The streak **resets** when a different viewer answers correctly, or when a round times out with no winner.
- Once the streak reaches `announceThreshold`, the count is included in the win message posted to chat.

Configure in `config.local.json`:

```json
"streak": {
  "enabled": true,
  "announceThreshold": 2,
  "overlayTemplate": "{winner} x{streak}"
}
```

Chat messages use templates defined in the `branding` section:

```json
"branding": {
  "winnerText": "{winner} got it! It was {character}!",
  "winnerStreakText": "{winner} got it! It was {character}! {streak} streak!",
  "noWinnerText": "No one got it! It was {character}!"
}
```

---

## Round Flow

Each round follows this sequence:

1. A random character is picked and displayed as a silhouette.
2. Chat messages are checked for a matching guess.
3. If someone guesses correctly → the image is revealed, a win message is posted to chat, and the streak is updated.
4. If the timer runs out with no correct guess → the image is revealed and a no-winner message is posted.
5. After `revealDurationSeconds` the screen goes blank.
6. After `betweenRoundsSeconds` the next round begins automatically.

Configure timers in `config.local.json`:

```json
"round": {
  "roundDurationSeconds": 60,
  "revealDurationSeconds": 7,
  "betweenRoundsSeconds": 3
}
```

- `autoStart` — when `true`, the first round begins as soon as the overlay loads. Set to `false` if you want to start manually with the `N` key.
- `roundDurationSeconds` — how long viewers have to guess before the answer is revealed automatically. Set to `0` to disable the timer entirely (the round runs until someone answers correctly).
- `revealDurationSeconds` — how long the revealed image stays on screen before the overlay goes blank.
- `betweenRoundsSeconds` — the blank gap between the screen clearing and the next character appearing. Useful for giving chat a moment to react.
- `avoidImmediateRepeats` — when `true`, the game tracks recently shown characters and avoids picking them again until the pool cycles through. This prevents the same character appearing twice in a row.
- `recentHistorySize` — how many recent picks to remember when avoiding repeats. With 250 characters and a history of 10, the same character won't reappear for at least 10 rounds.
- `pauseWhenNotLive` — when `true`, the next round won't start unless OBS is actively streaming or recording. The current round completes normally and the screen goes blank; the game just waits until you go live before showing the next character. Useful during actual streams. Set to `false` when testing offline.

---

## Image-Only Mode & Slide Animations

Enable `imageOnly` to hide the game title and prompt text, leaving only the character silhouette on screen. Pair it with slide animations for a clean presentation:

```json
"display": {
  "imageOnly": true,
  "slideOutDirection": "left",
  "slideInDirection": "left",
  "slideDurationSeconds": 0.5
}
```

- `slideOutDirection` — the direction the image exits when a round ends (`none`, `left`, `right`, `up`, `down`).
- `slideInDirection` — the direction the new image enters at the start of a round. Can be different from slide-out to create a carousel effect.
- `slideDurationSeconds` — how long the slide animation takes.

---

## Keyboard Controls

| Key | Action |
|-----|--------|
| `N` | Start next round immediately |
| `R` | Reveal the current answer early |
| `D` | Toggle debug panel |
| `S` | Toggle silhouette on/off (peek at the answer) |
| `P` | Force a specific character by typing a partial name |
| `Space` | Reveal (if round is active) / Next round (if revealed) |

Disable keyboard controls entirely in `config.local.json`:

```json
"controls": {
  "enableKeyboardControls": false
}
```

---

## Debug Mode

Enable the debug panel to see connection status, current character, aliases, normalized guesses, recent IRC lines, and errors. Useful for diagnosing matching issues or Twitch connection problems.

**Via URL parameter (easiest for OBS testing):**

```
http://127.0.0.1:8787/index.html?debug=1
```

**Via config:**

```json
"display": {
  "showDebugPanel": true
}
```

---

## URL Parameters

| Parameter | Effect |
|-----------|--------|
| `?channel=name` | Override the Twitch channel without editing the config |
| `?debug=1` | Enable the debug panel |
| `?autostart=0` | Prevent the first round from starting automatically |
| `?title=My+Game` | Override the game title |

---

## Configuration Reference

All settings live in `config.json`. Override any value by adding it to `config.local.json` — it is deep-merged over the base config and is gitignored by default. Config files support `//` line comments.

Copy `config.local.template.json` as a starting point — it includes all settings with comments explaining each one.

### `branding`

Text shown on the overlay and posted to chat. Supports `{winner}`, `{character}`, and `{streak}` placeholders.

| Key | Description |
|-----|-------------|
| `gameTitle` | Title shown at the top of the overlay |
| `promptText` | Text shown below the silhouette while a round is active |
| `winnerText` | Chat message when someone guesses correctly (no active streak). Use `{winner}` and `{character}` |
| `winnerStreakText` | Chat message when someone guesses correctly and has an active streak. Use `{winner}`, `{character}`, and `{streak}` |
| `noWinnerText` | Chat message when the timer runs out with no correct guess. Use `{character}` |

### `twitch`

| Key | Default | Description |
|-----|---------|-------------|
| `useAuth` | `true` | Whether to use an authenticated bot account. Required to post to chat |
| `username` | `""` | Twitch username of the bot account |
| `oauthToken` | `""` | OAuth token for the bot. Needs `chat:read` and `chat:write` scopes |
| `ignoreBotAccount` | `true` | When `true`, the bot's own chat messages are ignored so win announcements can't accidentally trigger a match. Set to `false` if your bot and channel account are the same |

### `display`

| Key | Default | Description |
|-----|---------|-------------|
| `showConnectionStatus` | `true` | Shows a small indicator in the corner confirming the Twitch connection is active |
| `showDebugPanel` | `false` | Shows the debug panel with connection info, current character, recent guesses, and a streak event log |
| `transparentBackground` | `true` | Transparent background for OBS compositing. Set to `false` for a dark background when testing in a browser |
| `imageOnly` | `false` | Hides the game title and prompt text, leaving only the character image. Designed for use with slide animations |
| `slideOutDirection` | `"none"` | Direction the image slides off screen when a round ends (`none`, `left`, `right`, `up`, `down`) |
| `slideInDirection` | `"none"` | Direction the new image slides in from when a round starts. Can differ from slide-out to create a wipe effect |
| `slideDurationSeconds` | `0.5` | How long each slide animation takes in seconds |
| `maxImageHeight` | `"70vh"` | Maximum height of the character image as a CSS value. Reduce this if the image overlaps other overlay elements |
| `maxImageWidth` | `"90vw"` | Maximum width of the character image |

### `round`

| Key | Default | Description |
|-----|---------|-------------|
| `autoStart` | `true` | Starts the first round automatically when the overlay loads. Set to `false` to wait for a manual `N` keypress |
| `roundDurationSeconds` | `0` | How long viewers have to guess before the answer is auto-revealed. `0` disables the timer — the round runs indefinitely until someone guesses correctly |
| `revealDurationSeconds` | `7` | How long the revealed image stays visible before the screen goes blank |
| `betweenRoundsSeconds` | `2` | How long the screen stays blank between rounds. Gives chat a moment to react before the next character appears |
| `avoidImmediateRepeats` | `true` | Prevents the same character from appearing again until enough other characters have been shown |
| `recentHistorySize` | `10` | How many recent picks to remember when avoiding repeats |
| `pauseWhenNotLive` | `false` | When `true`, no round will start unless OBS is actively streaming or recording. This applies to the very first round on load as well as between rounds. The game polls every 5 seconds until you go live. Set to `false` when testing offline |
| `goLiveDelaySeconds` | `0` | How many seconds to wait after detecting that OBS went live before starting the first round. Gives you time to get settled. Only applies when `pauseWhenNotLive` is `true` |

### `files`

| Key | Default | Description |
|-----|---------|-------------|
| `characterList` | `"characters.txt"` | Path to your character list file |
| `fallbackCharacterList` | `"characters.example.txt"` | Used automatically if `characterList` is missing |
| `imageFolder` | `"images"` | Folder where character images are stored |
| `imageExtension` | `"png"` | File extension for character images |
| `placeholderImage` | `"images/placeholder.png"` | Image shown when a character's image file is missing |

### `streak`

| Key | Default | Description |
|-----|---------|-------------|
| `enabled` | `true` | Enables streak tracking. When disabled, no streak is tracked or displayed |
| `announceThreshold` | `2` | How many consecutive correct answers before the streak count appears in the chat win message. At `2`, the streak is mentioned from the second correct answer onward |
| `overlayTemplate` | `"{winner} x{streak}"` | Text shown on the overlay while a streak is active. Hidden when the streak count is below `announceThreshold` |

### `controls`

| Key | Default | Description |
|-----|---------|-------------|
| `enableKeyboardControls` | `true` | Enables keyboard shortcuts. Disable if keypresses are interfering with other software |

---

## Assets and Character Packs

This project does not include copyrighted franchise assets, official character artwork, or official logos.

Add your own local images to `/images` and create your own `characters.txt`. Both are gitignored by default so they won't be committed.

The only image committed to this repository is `images/placeholder.png`, which is shown when a character's image file is missing.

The code in this repository is licensed under MIT. Any images, character names, or other assets you add locally are your responsibility and are not covered by this repository's license.

---

## License

MIT — see `LICENCE.txt`.
