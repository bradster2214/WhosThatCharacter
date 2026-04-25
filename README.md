# Who's That Character?

A configurable Twitch/OBS browser-source guessing game where viewers identify silhouetted characters from chat.

Bring your own images and character list. The app loads a local character file, picks a random entry, displays the image as a silhouette, listens to Twitch chat, and reveals the answer when someone guesses correctly.

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

4. **Create `config.local.json`** with your Twitch channel and credentials:

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

5. **Start a local server** from the project folder:

   ```powershell
   python -m http.server 8787
   ```

6. **Add an OBS Browser Source** pointing to:

   ```
   http://127.0.0.1:8787/index.html
   ```

   Recommended size: **1920 × 1080** (or match your scene canvas).

---

## OBS Browser Source Tips

- Enable **"Refresh browser when scene becomes active"** for clean reloads.
- Set **"Shutdown source when not visible"** if you want the game to pause off-stream.
- The overlay background is transparent by default — place it over your other sources.

---

## Twitch Authentication

You need a Twitch user access token with the `chat:read` scope.

1. Create (or use) a bot account on Twitch.
2. Generate a token with `chat:read` at [twitchtokengenerator.com](https://twitchtokengenerator.com) or via the Twitch CLI.
3. Add credentials to `config.local.json` (never commit this file):

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

---

## Character List Format

Each line in `characters.txt` follows this format:

```
Canonical Character Name|alias one|alias two|nickname
```

- The **canonical name** is what gets displayed when the answer is revealed.
- The canonical name **must match the image filename** (without extension).
- Every entry on the line (including the canonical name) is a valid answer.
- Lines starting with `#` are comments. Blank lines are ignored.

**Example:**

```
# My characters
Blue Wizard|wizard|mage|blue mage
Red Knight|knight|red knight|armored warrior
Green Archer|archer|ranger|green ranger
```

---

## Adding Images

Place images in the `/images` folder. The filename (without extension) must match the canonical name exactly:

| `characters.txt` canonical name | Expected image file |
|---|---|
| `Blue Wizard` | `images/Blue Wizard.png` |
| `Red Knight` | `images/Red Knight.png` |
| `Green Archer` | `images/Green Archer.png` |

Set the image extension in `config.json` (or `config.local.json`):

```json
"files": {
  "imageExtension": "png"
}
```

If an image is missing, the game shows the placeholder and keeps running.

---

## Keyboard Controls

| Key | Action |
|-----|--------|
| `N` | Start next round |
| `R` | Reveal current answer |
| `D` | Toggle debug panel |
| `S` | Toggle silhouette effect |
| `Space` | Reveal (if hidden) / Next round (if revealed) |

Controls can be disabled in `config.json`:

```json
"controls": {
  "enableKeyboardControls": false
}
```

---

## Debug Mode

Enable the debug panel to see connection status, current character, aliases, last guess, and errors:

**Via URL parameter (recommended for testing in OBS):**

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

Override config values from the OBS browser source URL:

| Parameter | Effect |
|-----------|--------|
| `?channel=name` | Override Twitch channel |
| `?debug=1` | Enable debug panel |
| `?autostart=0` | Disable automatic first round |
| `?title=My+Game` | Override game title |

---

## Configuration

All settings live in `config.json`. Override any setting locally by creating `config.local.json` — it is deep-merged over the base config and is gitignored by default.

Key settings:

```json
{
  "branding": {
    "gameTitle": "Who's That Character?",
    "promptText": "Type your guess in chat!",
    "correctText": "Correct!",
    "winnerTextTemplate": "{winner} got it!",
    "answerTextTemplate": "It was {character}!"
  },
  "round": {
    "autoStart": true,
    "roundDurationSeconds": 0,
    "revealDurationSeconds": 7,
    "betweenRoundsSeconds": 2,
    "avoidImmediateRepeats": true
  },
  "matching": {
    "allowContains": false
  }
}
```

`roundDurationSeconds: 0` means no timeout — the round continues until someone guesses correctly.

---

## How Guess Matching Works

The game normalizes both the chat message and each alias before comparing:

- Case-insensitive
- Hyphens and underscores treated as spaces
- Apostrophes removed
- Extra spaces collapsed
- Most punctuation removed
- Unicode letters and numbers preserved

**Example aliases for `Blue Wizard`:**

All of the following are accepted:
```
Blue Wizard
blue wizard
BLUE WIZARD
blue-wizard
blue_wizard
wizard
mage
blue mage
```

Matching is **exact normalized match only** by default. Partial/contains matching is off to prevent accidental hits on short aliases.

---

## Branding / Rebranding

To rename the game (for example, for a specific franchise in your local setup):

`config.local.json`:
```json
{
  "branding": {
    "gameTitle": "Guess That Uma",
    "promptText": "Guess the trainee in chat!"
  },
  "files": {
    "characterList": "characters.txt",
    "imageExtension": "png"
  }
}
```

This file is gitignored — your private branding stays local.

---

## Assets and Character Packs

This project does not include copyrighted franchise assets, official character artwork, or official logos.

Add your own local images to `/images` and create your own `characters.txt`.

The sample images included in this repository (`images/Blue Wizard.svg`, etc.) are original generic placeholder illustrations created for this project.

The code in this repository is licensed under MIT. Any images, character names, or other assets you add locally are your responsibility and are not covered by this repository's license.

---

## License

MIT — see `LICENCE.txt`.
