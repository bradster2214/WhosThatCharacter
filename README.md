# Who's That Character?

A configurable Twitch/OBS browser-source guessing game where viewers identify silhouetted characters from chat.

Bring your own images and character list. The app loads a local character file, picks a random entry, displays the image as a silhouette, listens to Twitch chat, and reveals the answer when someone guesses correctly. Results and streak announcements are posted to chat automatically.

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

5. **Start the local server** by double-clicking `start-server.bat`.

   Alternatively, run it manually from the project folder:

   ```powershell
   python -m http.server 8787
   ```

   The batch file will show a clear error if Python is not installed. Download it from [python.org](https://www.python.org/downloads/) and make sure to check **"Add Python to PATH"** during installation.

6. **Add an OBS Browser Source** pointing to:

   ```
   http://127.0.0.1:8787/index.html
   ```

   Recommended size: **1920 × 1080** (or match your scene canvas).

---

## OBS Browser Source Tips

- The overlay background is transparent by default — place it over your other sources.
- The game automatically pauses (timers stop, WebSocket disconnects) when the source is hidden in OBS, and resumes cleanly when it becomes visible again.
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

   > **Note:** If you use your main account as the bot, your own chat messages will be filtered out and won't count as valid guesses. Use a separate bot account to avoid this.

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
2. **Contains match** — if the message contains an alias anywhere (e.g. `"I think this is Blue Wizard"`), it matches — but only if no other character also matches. Ambiguous guesses (e.g. `"Christmas Biwa Hayahide"` when the current character is `"Biwa Hayahide"`) are rejected because `"Christmas Biwa Hayahide"` is an exact alias for a different character.
3. **Regex aliases** — entries written as `/pattern/` or `/pattern/flags` are tested against the full normalized message. Useful for matching any two words starting with specific letters, abbreviation variants, etc.

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

The game tracks consecutive correct answers by the same viewer. When a streak reaches `announceThreshold`, the streak count is included in the win message posted to chat.

Configure in `config.local.json`:

```json
"streak": {
  "enabled": true,
  "announceThreshold": 2,
  "overlayTemplate": "{winner} x{streak}"
}
```

The streak resets when a different viewer gets the correct answer, or when a round times out with no winner.

Chat messages use templates defined in the `branding` section:

```json
"branding": {
  "winnerTextTemplate": "{winner} got it!",
  "winnerStreakTextTemplate": "{winner} got it! It was {character}! {streak} streak!",
  "answerTextTemplate": "It was {character}!",
  "noWinnerText": "No one got it!"
}
```

---

## Round Timers

```json
"round": {
  "roundDurationSeconds": 60,
  "revealDurationSeconds": 7,
  "betweenRoundsSeconds": 3
}
```

- `roundDurationSeconds` — how long before the answer is auto-revealed with no correct guess. Set to `0` to disable (round runs until someone guesses correctly).
- `revealDurationSeconds` — how long the revealed image is shown before the screen goes blank.
- `betweenRoundsSeconds` — gap between the screen going blank and the next character appearing.

---

## Keyboard Controls

| Key | Action |
|-----|--------|
| `N` | Start next round |
| `R` | Reveal current answer |
| `D` | Toggle debug panel |
| `S` | Toggle silhouette on/off |
| `P` | Force a specific character (type a partial name) |
| `Space` | Reveal (if active) / Next round (if revealed) |

Disable in `config.local.json`:

```json
"controls": {
  "enableKeyboardControls": false
}
```

---

## Debug Mode

Enable the debug panel to see connection status, current character, aliases, normalized guesses, recent IRC lines, and errors.

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
| `?channel=name` | Override Twitch channel |
| `?debug=1` | Enable debug panel |
| `?autostart=0` | Disable automatic first round |
| `?title=My+Game` | Override game title |

---

## Configuration Reference

All settings live in `config.json`. Override any value by adding it to `config.local.json` — it is deep-merged over the base config and is gitignored by default. Config files support `//` line comments.

Copy `config.local.template.json` as a starting point — it includes all commonly adjusted settings with comments explaining each one.

### `branding`
Controls all text shown on the overlay and posted to chat. Supports `{winner}`, `{character}`, and `{streak}` placeholders.

### `display`

| Key | Default | Description |
|-----|---------|-------------|
| `showConnectionStatus` | `true` | Show/hide the connection indicator |
| `hideText` | `false` | Hide the game title and prompt text (image-only mode) |
| `showDebugPanel` | `false` | Show the debug panel |
| `maxImageHeight` | `"70vh"` | Max height of the character image |
| `maxImageWidth` | `"90vw"` | Max width of the character image |
| `transparentBackground` | `true` | Transparent background for OBS |

### `round`

| Key | Default | Description |
|-----|---------|-------------|
| `autoStart` | `true` | Start a round automatically on load |
| `roundDurationSeconds` | `0` | Auto-reveal timeout (0 = disabled) |
| `revealDurationSeconds` | `7` | How long to show the answer |
| `betweenRoundsSeconds` | `2` | Gap before next round |
| `avoidImmediateRepeats` | `true` | Avoid recently shown characters |
| `recentHistorySize` | `10` | How many recent picks to exclude |

### `streak`

| Key | Default | Description |
|-----|---------|-------------|
| `enabled` | `true` | Enable streak tracking |
| `announceThreshold` | `2` | Streak count before it appears in the win message |
| `overlayTemplate` | `"{winner} x{streak}"` | Text shown on the overlay during a streak |

---

## Assets and Character Packs

This project does not include copyrighted franchise assets, official character artwork, or official logos.

Add your own local images to `/images` and create your own `characters.txt`. Both are gitignored by default so they won't be committed.

The sample images included in this repository (`images/Blue Wizard.svg`, etc.) are original generic placeholder illustrations created for this project.

The code in this repository is licensed under MIT. Any images, character names, or other assets you add locally are your responsibility and are not covered by this repository's license.

---

## License

MIT — see `LICENCE.txt`.
