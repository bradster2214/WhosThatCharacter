/* ============================================================
   Who's That Character? — app.js
   Vanilla JS, no build step, OBS Browser Source compatible.
   ============================================================ */

"use strict";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  config: null,
  connected: false,
  connecting: false,
  socket: null,
  reconnectAttempt: 0,

  characters: [],
  currentCharacter: null,

  roundActive: false,
  revealed: false,
  winner: null,
  winningMessage: "",

  lastUser: "",
  lastMessage: "",
  lastNormalizedGuess: "",
  lastGuessMatched: false,

  recentPicks: [],

  timers: {
    reveal: null,
    nextRound: null,
    roundTimeout: null,
    reconnect: null
  },

  warnings: [],
  errors: [],
  recentIrcLines: []
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function deepMerge(base, override) {
  const result = Object.assign({}, base);
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null &&
      typeof override[key] === "object" &&
      !Array.isArray(override[key]) &&
      typeof base[key] === "object" &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

async function loadJson(path, optional = false) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      if (optional) return null;
      throw new Error(`HTTP ${response.status} loading ${path}`);
    }
    return await response.json();
  } catch (err) {
    if (optional) return null;
    throw err;
  }
}

async function loadConfig() {
  const base = await loadJson("config.json");
  const local = await loadJson("config.local.json", true);
  let config = base;
  if (local) {
    config = deepMerge(base, local);
  }
  config = applyQueryOverrides(config);
  return config;
}

function applyQueryOverrides(config) {
  const params = new URLSearchParams(window.location.search);

  if (params.has("channel")) {
    config.channel = params.get("channel");
  }
  if (params.get("debug") === "1") {
    config.display = config.display || {};
    config.display.showDebugPanel = true;
  }
  if (params.get("autostart") === "0") {
    config.round = config.round || {};
    config.round.autoStart = false;
  }
  if (params.has("title")) {
    config.branding = config.branding || {};
    config.branding.gameTitle = params.get("title");
  }
  return config;
}

// ---------------------------------------------------------------------------
// Character list
// ---------------------------------------------------------------------------

function normalizeGuess(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[-_]/g, " ")
    .replace(/[^\p{L}\p{N}\s.]/gu, "")
    .replace(/\s+/g, " ");
}

function parseCharacterLine(line, cfg) {
  const parts = line.split("|").map(p => p.trim()).filter(p => p.length > 0);
  if (parts.length === 0) return null;

  const canonicalName = parts[0];
  const aliases = parts;
  const normalizedAliases = aliases.map(normalizeGuess);
  const imageFolder = cfg.files.imageFolder || "images";
  const imageExtension = cfg.files.imageExtension || "png";
  const imagePath = `${imageFolder}/${canonicalName}.${imageExtension}`;

  return {
    canonicalName,
    aliases,
    normalizedAliases,
    imagePath,
    rawLine: line
  };
}

function parseCharacterList(text, cfg) {
  const lines = text.split(/\r?\n/);
  const characters = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const character = parseCharacterLine(line, cfg);
    if (character) characters.push(character);
  }

  return characters;
}

function validateCharacterList(characters) {
  const warnings = [];

  // Duplicate canonical names
  const canonicalSeen = new Map();
  for (const char of characters) {
    if (canonicalSeen.has(char.canonicalName)) {
      warnings.push(`Duplicate canonical name: "${char.canonicalName}"`);
    }
    canonicalSeen.set(char.canonicalName, true);
  }

  // Duplicate aliases across characters
  const aliasSeen = new Map();
  for (const char of characters) {
    for (const alias of char.normalizedAliases) {
      if (aliasSeen.has(alias) && aliasSeen.get(alias) !== char.canonicalName) {
        warnings.push(
          `Alias "${alias}" appears for both "${aliasSeen.get(alias)}" and "${char.canonicalName}"`
        );
      } else {
        aliasSeen.set(alias, char.canonicalName);
      }
    }
  }

  return warnings;
}

async function loadCharacterList() {
  const cfg = state.config;
  const primaryPath = cfg.files.characterList || "characters.txt";
  const fallbackPath = cfg.files.fallbackCharacterList || "characters.example.txt";

  let text = null;
  let usedPath = primaryPath;

  try {
    const response = await fetch(primaryPath);
    if (response.ok) {
      text = await response.text();
    }
  } catch (_) {
    // swallow, try fallback
  }

  if (!text) {
    usedPath = fallbackPath;
    try {
      const response = await fetch(fallbackPath);
      if (response.ok) {
        text = await response.text();
        state.warnings.push(`"${primaryPath}" not found — using fallback "${fallbackPath}"`);
      }
    } catch (_) {
      // swallow
    }
  }

  if (!text) {
    throw new Error(
      `Could not load character list from "${primaryPath}" or fallback "${fallbackPath}". ` +
      `Create a characters.txt file in the project folder.`
    );
  }

  const characters = parseCharacterList(text, cfg);

  if (characters.length === 0) {
    throw new Error(
      `"${usedPath}" contains no valid character entries. ` +
      `Check the format: CanonicalName|alias one|alias two`
    );
  }

  const validationWarnings = validateCharacterList(characters);
  state.warnings.push(...validationWarnings);

  return characters;
}

// ---------------------------------------------------------------------------
// Guess checking
// ---------------------------------------------------------------------------

function checkGuess(message) {
  if (!state.roundActive || state.revealed || !state.currentCharacter) {
    return false;
  }

  const guess = normalizeGuess(message);
  state.lastNormalizedGuess = guess;

  if (!guess) {
    state.lastGuessMatched = false;
    return false;
  }

  const matched = state.currentCharacter.normalizedAliases.includes(guess);
  state.lastGuessMatched = matched;
  return matched;
}

// ---------------------------------------------------------------------------
// Round logic
// ---------------------------------------------------------------------------

function clearRoundTimers() {
  clearTimeout(state.timers.reveal);
  clearTimeout(state.timers.nextRound);
  clearTimeout(state.timers.roundTimeout);
  state.timers.reveal = null;
  state.timers.nextRound = null;
  state.timers.roundTimeout = null;
}

function pickRandomCharacter() {
  let pool = state.characters;

  if (state.config.round.avoidImmediateRepeats && state.recentPicks.length > 0) {
    const recent = new Set(state.recentPicks);
    const filtered = state.characters.filter(c => !recent.has(c.canonicalName));
    if (filtered.length > 0) {
      pool = filtered;
    } else {
      state.recentPicks = [];
    }
  }

  const picked = pool[Math.floor(Math.random() * pool.length)];

  state.recentPicks.push(picked.canonicalName);
  state.recentPicks = state.recentPicks.slice(-state.config.round.recentHistorySize);

  return picked;
}

function startRound() {
  clearRoundTimers();

  const character = pickRandomCharacter();
  state.currentCharacter = character;
  state.roundActive = true;
  state.revealed = false;
  state.winner = null;
  state.winningMessage = "";
  state.lastUser = "";
  state.lastMessage = "";
  state.lastNormalizedGuess = "";
  state.lastGuessMatched = false;

  // UI
  const cfg = state.config;
  const img = document.getElementById("characterImage");
  const placeholder = document.getElementById("imagePlaceholder");
  const answerPanel = document.getElementById("answerPanel");
  const promptText = document.getElementById("promptText");

  img.classList.add("silhouette", "loading");
  img.classList.remove("hidden");
  placeholder.classList.add("hidden");
  answerPanel.classList.add("hidden");
  promptText.textContent = cfg.branding.promptText;
  promptText.classList.remove("hidden");

  loadCharacterImage(character);

  // Round timeout
  const roundSecs = cfg.round.roundDurationSeconds;
  if (roundSecs > 0) {
    state.timers.roundTimeout = setTimeout(() => handleRoundTimeout(), roundSecs * 1000);
  }

  updateDebugPanel();
}

function loadCharacterImage(character) {
  const img = document.getElementById("characterImage");
  const placeholder = document.getElementById("imagePlaceholder");
  const placeholderSrc = state.config.files.placeholderImage || "images/placeholder.svg";

  img.onload = null;
  img.onerror = null;

  img.onload = () => {
    img.classList.remove("loading");
  };

  img.onerror = () => {
    state.warnings.push(`Image not found: ${character.imagePath} — using placeholder`);
    img.onerror = null;
    img.onload = () => { img.classList.remove("loading"); };
    if (placeholderSrc) {
      img.src = placeholderSrc;
      img.onerror = () => {
        img.classList.add("hidden");
        img.classList.remove("loading");
        placeholder.classList.remove("hidden");
        updateDebugPanel();
      };
    } else {
      img.classList.add("hidden");
      img.classList.remove("loading");
      placeholder.classList.remove("hidden");
    }
    updateDebugPanel();
  };

  img.src = character.imagePath;
}

function revealAnswer(reason) {
  if (state.revealed) return;
  state.revealed = true;
  state.roundActive = false;
  clearRoundTimers();

  const cfg = state.config;
  const img = document.getElementById("characterImage");
  const answerPanel = document.getElementById("answerPanel");
  const correctTextEl = document.getElementById("correctText");
  const answerNameEl = document.getElementById("answerName");
  const winnerNameEl = document.getElementById("winnerName");
  const winningMessageEl = document.getElementById("winningMessage");
  const promptText = document.getElementById("promptText");

  img.classList.remove("silhouette");

  const character = state.currentCharacter;
  const answerTemplate = cfg.branding.answerTextTemplate || "It was {character}!";
  const answerText = answerTemplate.replace("{character}", character.canonicalName);

  if (state.winner) {
    const winnerTemplate = cfg.branding.winnerTextTemplate || "{winner} got it!";
    const winnerText = winnerTemplate.replace("{winner}", state.winner);
    sendChatMessage(`${winnerText} ${answerText}`);
  } else {
    const noWinner = cfg.branding.noWinnerText || "No one got it!";
    sendChatMessage(`${noWinner} ${answerText}`);
  }

  promptText.textContent = cfg.branding.nextRoundText || "Next character coming up...";

  scheduleNextRound();
  updateDebugPanel();
}

function handleCorrectGuess(displayName, message) {
  if (state.revealed) return;
  state.winner = displayName;
  state.winningMessage = message;
  revealAnswer("correct");
}

function handleRoundTimeout() {
  if (state.revealed) return;
  state.winner = null;
  revealAnswer("timeout");
}

function scheduleNextRound() {
  const cfg = state.config;
  if (!cfg.round.autoStart) return;

  const delay =
    ((cfg.round.revealDurationSeconds || 7) + (cfg.round.betweenRoundsSeconds || 2)) * 1000;

  state.timers.nextRound = setTimeout(() => startRound(), delay);
}

// ---------------------------------------------------------------------------
// Twitch IRC over WebSocket
// ---------------------------------------------------------------------------

const IRC_WS = "wss://irc-ws.chat.twitch.tv:443";
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

function sendIrc(line) {
  if (state.socket && state.socket.readyState === WebSocket.OPEN) {
    state.socket.send(line + "\r\n");
  }
}

function sendChatMessage(text) {
  const channel = (state.config.channel || "").toLowerCase().trim();
  if (!channel || !state.connected) return;
  sendIrc(`PRIVMSG #${channel} :${text}`);
}

function parseIrcTags(tagString) {
  const tags = {};
  if (!tagString) return tags;
  for (const part of tagString.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      tags[part] = true;
    } else {
      tags[part.slice(0, eq)] = part.slice(eq + 1);
    }
  }
  return tags;
}

function parsePrivmsg(line) {
  // Handle optional tag prefix
  let rest = line;
  let tags = {};

  if (rest.startsWith("@")) {
    const spaceIdx = rest.indexOf(" ");
    if (spaceIdx === -1) return null;
    tags = parseIrcTags(rest.slice(1, spaceIdx));
    rest = rest.slice(spaceIdx + 1).trimStart();
  }

  // :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
  if (!rest.startsWith(":")) return null;
  const prefixEnd = rest.indexOf(" ");
  if (prefixEnd === -1) return null;
  const prefix = rest.slice(1, prefixEnd);
  rest = rest.slice(prefixEnd + 1).trimStart();

  if (!rest.startsWith("PRIVMSG")) return null;
  rest = rest.slice("PRIVMSG".length).trimStart();

  // #channel :message
  const chanEnd = rest.indexOf(" ");
  if (chanEnd === -1) return null;
  const channel = rest.slice(1, chanEnd); // strip leading #
  rest = rest.slice(chanEnd + 1);

  // message body starts after first :
  const msgStart = rest.indexOf(":");
  if (msgStart === -1) return null;
  const message = rest.slice(msgStart + 1);

  // login from prefix (user!user@host)
  const bangIdx = prefix.indexOf("!");
  const login = bangIdx !== -1 ? prefix.slice(0, bangIdx) : prefix;
  const displayName = tags["display-name"] || login;

  return {
    type: "PRIVMSG",
    channel,
    login,
    displayName,
    message,
    tags,
    raw: line
  };
}

function handleIrcLine(line) {
  if (!line.trim()) return;

  // Log every line for debug
  state.recentIrcLines.push(line);
  state.recentIrcLines = state.recentIrcLines.slice(-8);

  // Keepalive
  if (line.startsWith("PING")) {
    const rest = line.slice(4).trim();
    sendIrc(`PONG ${rest}`);
    return;
  }

  // Server-requested reconnect
  if (line.includes(" RECONNECT")) {
    addDebugLine("Server requested RECONNECT — reconnecting...");
    if (state.socket) state.socket.close();
    return;
  }

  // Authentication failure
  if (line.includes("Login authentication failed") || line.includes("NOTICE * :Login")) {
    state.errors.push("Twitch authentication failed. Check username and oauthToken in config.");
    setConnectionStatus("Auth failed", "error");
    updateDebugPanel();
    return;
  }

  // Only process PRIVMSG
  if (!line.includes("PRIVMSG")) return;

  const parsed = parsePrivmsg(line);
  if (!parsed) return;

  // Ignore own bot messages so the answer announcement can't trigger a match
  const botLogin = (state.config.twitch.username || "").toLowerCase();
  if (botLogin && parsed.login.toLowerCase() === botLogin) return;

  state.lastUser = parsed.displayName;
  state.lastMessage = parsed.message;

  if (checkGuess(parsed.message)) {
    handleCorrectGuess(parsed.displayName, parsed.message);
  }

  updateDebugPanel();
}

function handleIrcPayload(payload) {
  const lines = payload.split(/\r?\n/);
  for (const line of lines) {
    handleIrcLine(line);
  }
}

function connectTwitchChat() {
  if (state.connecting || state.connected) return;

  const cfg = state.config;
  const channel = (cfg.channel || "").toLowerCase().trim();
  if (!channel || channel === "your_channel_here") {
    setConnectionStatus("No channel configured", "warn");
    addDebugLine("Set 'channel' in config.json or config.local.json to connect to Twitch.");
    updateDebugPanel();
    return;
  }

  // Credential check
  if (cfg.twitch.useAuth) {
    if (!cfg.twitch.username || !cfg.twitch.oauthToken) {
      setConnectionStatus("Missing Twitch credentials", "warn");
      state.warnings.push(
        "useAuth is true but username or oauthToken is empty. " +
        "Add credentials to config.local.json."
      );
      updateDebugPanel();
      return;
    }
  }

  state.connecting = true;
  setConnectionStatus("Connecting...", "warn");

  const ws = new WebSocket(IRC_WS);
  state.socket = ws;

  ws.onopen = () => {
    state.reconnectAttempt = 0;
    sendIrc("CAP REQ :twitch.tv/tags twitch.tv/commands");

    if (cfg.twitch.useAuth) {
      let token = cfg.twitch.oauthToken.trim();
      if (!token.startsWith("oauth:")) token = "oauth:" + token;
      sendIrc(`PASS ${token}`);
      sendIrc(`NICK ${cfg.twitch.username.toLowerCase()}`);
    } else {
      sendIrc("PASS SCHMOOPIIE");
      sendIrc("NICK justinfan12345");
    }

    sendIrc(`JOIN #${channel}`);
  };

  ws.onmessage = (event) => {
    if (!state.connected) {
      state.connected = true;
      state.connecting = false;
      setConnectionStatus(`#${channel}`, "ok");
      updateDebugPanel();
    }
    handleIrcPayload(event.data);
  };

  ws.onerror = () => {
    state.connecting = false;
    state.connected = false;
    setConnectionStatus("Connection error", "error");
    updateDebugPanel();
  };

  ws.onclose = () => {
    state.connected = false;
    state.connecting = false;
    setConnectionStatus("Disconnected — reconnecting...", "warn");
    scheduleReconnect();
  };
}

function disconnectTwitchChat() {
  clearTimeout(state.timers.reconnect);
  state.timers.reconnect = null;
  if (state.socket) {
    state.socket.onclose = null;
    state.socket.close();
    state.socket = null;
  }
  state.connected = false;
  state.connecting = false;
}

function scheduleReconnect() {
  clearTimeout(state.timers.reconnect);
  const delays = RECONNECT_DELAYS;
  const delay = delays[Math.min(state.reconnectAttempt, delays.length - 1)];
  state.reconnectAttempt++;
  state.timers.reconnect = setTimeout(() => {
    state.socket = null;
    connectTwitchChat();
  }, delay);
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function applyBranding() {
  const branding = state.config.branding || {};
  const titleEl = document.getElementById("title");
  if (titleEl && branding.gameTitle) {
    titleEl.textContent = branding.gameTitle;
    document.title = branding.gameTitle;
  }

  const promptEl = document.getElementById("promptText");
  if (promptEl && branding.promptText) {
    promptEl.textContent = branding.promptText;
  }

  // CSS custom properties from display config
  const display = state.config.display || {};
  if (display.maxImageHeight) {
    document.documentElement.style.setProperty("--max-image-height", display.maxImageHeight);
  }
  if (display.maxImageWidth) {
    document.documentElement.style.setProperty("--max-image-width", display.maxImageWidth);
  }

  // Transparent background
  if (display.transparentBackground === false) {
    document.body.style.background = "#1a1a2e";
  }
}

function setConnectionStatus(text, status) {
  const el = document.getElementById("connectionStatus");
  if (!el) return;

  const display = state.config && state.config.display;
  if (display && display.showConnectionStatus === false) {
    el.classList.add("hidden");
    return;
  }

  el.textContent = text;
  el.classList.remove("hidden", "status-ok", "status-warn", "status-error");
  if (status) el.classList.add(`status-${status}`);
}

function showError(message) {
  state.errors.push(message);
  updateDebugPanel();

  // Show on-screen error overlay
  let overlay = document.getElementById("errorOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "errorOverlay";
    overlay.className = "error-overlay";
    document.getElementById("app").appendChild(overlay);
  }

  const box = document.createElement("div");
  box.className = "error-box";
  box.innerHTML = `<strong>Error</strong>${escapeHtml(message)}`;
  overlay.appendChild(box);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function addWarning(message) {
  if (!state.warnings.includes(message)) {
    state.warnings.push(message);
  }
}

function addDebugLine(message) {
  // Ephemeral log to debug panel (not persisted in state.errors/warnings)
  const content = document.getElementById("debugContent");
  if (content) {
    const line = document.createElement("div");
    line.textContent = message;
    content.appendChild(line);
  }
}

function updateDebugPanel() {
  const cfg = state.config;
  const panel = document.getElementById("debugPanel");
  const content = document.getElementById("debugContent");
  if (!panel || !content) return;

  const showDebug = cfg && cfg.display && cfg.display.showDebugPanel;
  if (!showDebug) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");

  const char = state.currentCharacter;
  const lines = [
    `Connection : ${state.connected ? "connected" : state.connecting ? "connecting..." : "disconnected"}`,
    `Channel    : ${cfg ? cfg.channel : "—"}`,
    `Characters : ${state.characters.length}`,
    `Round      : ${state.roundActive ? "active" : "idle"}  Revealed: ${state.revealed}`,
    ``,
    `Current    : ${char ? char.canonicalName : "—"}`,
    `Aliases    : ${char ? char.aliases.join(" | ") : "—"}`,
    `Image path : ${char ? char.imagePath : "—"}`,
    ``,
    `Last user  : ${state.lastUser || "—"}`,
    `Last msg   : ${state.lastMessage || "—"}`,
    `Normalized : ${state.lastNormalizedGuess || "—"}`,
    `Matched    : ${state.lastGuessMatched}`,
    `Winner     : ${state.winner || "—"}`,
    ``,
    `Recent picks: ${state.recentPicks.join(", ") || "—"}`
  ];

  if (state.recentIrcLines.length > 0) {
    lines.push(``, `RECENT IRC:`);
    for (const l of state.recentIrcLines) lines.push(`  ${l.slice(0, 120)}`);
  }

  if (state.warnings.length > 0) {
    lines.push(``, `WARNINGS:`);
    for (const w of state.warnings) lines.push(`  ! ${w}`);
  }

  if (state.errors.length > 0) {
    lines.push(``, `ERRORS:`);
    for (const e of state.errors) lines.push(`  !! ${e}`);
  }

  content.textContent = lines.join("\n");
}

// ---------------------------------------------------------------------------
// Keyboard controls
// ---------------------------------------------------------------------------

function setupKeyboardControls() {
  if (!state.config.controls || !state.config.controls.enableKeyboardControls) return;

  document.addEventListener("keydown", (e) => {
    // Ignore if a text input is focused
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;

    switch (e.key.toUpperCase()) {
      case "N":
        startRound();
        break;
      case "R":
        if (!state.revealed) revealAnswer("keyboard");
        break;
      case "D":
        toggleDebugPanel();
        break;
      case "S":
        toggleSilhouette();
        break;
      case " ":
        e.preventDefault();
        if (!state.revealed) {
          revealAnswer("keyboard");
        } else {
          startRound();
        }
        break;
    }
  });
}

function toggleDebugPanel() {
  if (!state.config) return;
  state.config.display = state.config.display || {};
  state.config.display.showDebugPanel = !state.config.display.showDebugPanel;
  updateDebugPanel();
}

function toggleSilhouette() {
  const img = document.getElementById("characterImage");
  if (img) img.classList.toggle("silhouette");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Load config
  try {
    state.config = await loadConfig();
  } catch (err) {
    showFatalError("Failed to load config.json: " + err.message);
    return;
  }

  // Apply CSS variables and branding before anything else renders
  applyBranding();

  // Show debug panel early if enabled
  updateDebugPanel();

  // Load characters
  try {
    state.characters = await loadCharacterList();
  } catch (err) {
    showFatalError(err.message);
    return;
  }

  // Process warnings from loading
  updateDebugPanel();

  // Set up keyboard
  setupKeyboardControls();

  // Connect to Twitch
  connectTwitchChat();

  // Start first round
  if (state.config.round.autoStart) {
    startRound();
  } else {
    const promptEl = document.getElementById("promptText");
    if (promptEl) promptEl.textContent = "Press N to start a round.";
    updateDebugPanel();
  }
}

function showFatalError(message) {
  showError(message);
  console.error("[WhosThatCharacter]", message);
  updateDebugPanel();
}

// Boot
document.addEventListener("DOMContentLoaded", main);
