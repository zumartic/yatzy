import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set, update, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const categories = [
  { id: "ones", label: "Ykköset", max: 5 },
  { id: "twos", label: "Kakkoset", max: 10 },
  { id: "threes", label: "Kolmoset", max: 15 },
  { id: "fours", label: "Neloset", max: 20 },
  { id: "fives", label: "Viitoset", max: 25 },
  { id: "sixes", label: "Kutoset", max: 30 },
  { id: "pair", label: "Pari", max: 12 },
  { id: "twoPairs", label: "Kaksi paria", max: 22 },
  { id: "threeOfKind", label: "Kolme samaa", max: 18 },
  { id: "fourOfKind", label: "Neljä samaa", max: 24 },
  { id: "smallStraight", label: "Pieni suora", max: 15 },
  { id: "largeStraight", label: "Iso suora", max: 20 },
  { id: "fullHouse", label: "Täyskäsi", max: 28 },
  { id: "chance", label: "Sattuma", max: 30 },
  { id: "yatzy", label: "Yatzy", max: 50 }
];
const upperCategories = categories.slice(0, 6);

const state = { gameId: getGameIdFromUrl(), userId: getOrCreateUserId(), user: null, invalidScoreInput: null, playerOrder: [], currentTurnPlayerId: null, finished: false, isHost: false, resultsDismissed: false };
const elements = {
  setupView: document.querySelector("#setup-view"),
  createSection: document.querySelector("#create-section"),
  gameView: document.querySelector("#game-view"),
  createForm: document.querySelector("#create-form"),
  joinForm: document.querySelector("#join-form"),
  joinCard: document.querySelector("#join-card"),
  joinGameLabel: document.querySelector("#join-game-label"),
  setupMessage: document.querySelector("#setup-message"),
  gameMessage: document.querySelector("#game-message"),
  status: document.querySelector("#connection-status"),
  gameCode: document.querySelector("#game-code"),
  shareLink: document.querySelector("#share-link"),
  copyLink: document.querySelector("#copy-link-button"),
  resetGame: document.querySelector("#reset-game-button"),
  homeLink: document.querySelector("#home-link"),
  gameCodePill: document.querySelector("#game-code-pill"),
  playersList: document.querySelector("#players-list"),
  table: document.querySelector("#score-table"),
  showResults: document.querySelector("#show-results-button"),
  resultsModal: document.querySelector("#results-modal"),
  resultsList: document.querySelector("#results-list"),
  playAgain: document.querySelector("#play-again-button"),
  closeResults: document.querySelector("#close-results-button")
};

let database;
let firebaseReady;

function getGameIdFromUrl() {
  return new URLSearchParams(window.location.search).get("game");
}

function getOrCreateUserId() {
  const key = "yatzy-player-id";
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(key, userId);
  }
  return userId;
}

function makeGameId() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
}

function showMessage(target, message = "", kind = "") {
  target.textContent = message;
  target.className = `message ${kind}`;
}

function isConfigured() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("REPLACE_ME") && firebaseConfig.databaseURL && !firebaseConfig.databaseURL.includes("REPLACE_") && firebaseConfig.databaseURL.startsWith("https://");
}

async function startFirebase() {
  if (firebaseReady) return firebaseReady;
  if (!isConfigured()) {
    elements.status.textContent = "Firebase puuttuu";
    showMessage(elements.setupMessage, "Täydennä ensin firebase-config.js Firebase Consolen Web-sovelluksen arvoilla.", "error");
    return false;
  }
  firebaseReady = (async () => {
    try {
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      database = getDatabase(app);
      await signInAnonymously(auth);
      elements.status.textContent = "Yhteys toimii";
      elements.status.classList.add("online");
      return true;
    } catch (error) {
      firebaseReady = null;
      elements.status.textContent = "Yhteysvirhe";
      showMessage(elements.setupMessage, "Firebase-yhteyttä ei saatu avattua. Tarkista asetukset ja Anonymous Authentication.", "error");
      console.error(error);
      return false;
    }
  })();
  return firebaseReady;
}

function showSetup() {
  elements.setupView.classList.remove("hidden");
  elements.gameView.classList.add("hidden");
  elements.gameCodePill.classList.add("hidden");
  const joining = !!state.gameId;
  elements.createSection.classList.toggle("hidden", joining);
  elements.joinCard.classList.toggle("hidden", !joining);
  if (joining) {
    elements.joinGameLabel.textContent = `Pelin tunnus: ${state.gameId}`;
  }
}

function showGame(game) {
  elements.setupView.classList.add("hidden");
  elements.gameView.classList.remove("hidden");
  elements.gameCode.textContent = game.id;
  elements.gameCodePill.classList.remove("hidden");
  const isHost = game.hostId === state.userId;
  const finished = !!game.finished;
  if (finished && !state.finished) state.resultsDismissed = false;
  if (!finished) state.resultsDismissed = false;
  state.finished = finished;
  state.isHost = isHost;
  elements.resetGame.classList.toggle("hidden", !isHost);
  elements.showResults.classList.toggle("hidden", !isHost || finished);
  elements.shareLink.textContent = getShareUrl(game.id);
  const playerOrder = getPlayerOrder(game.players || {}, game.playerOrder);
  const currentTurnPlayerId = game.currentTurnPlayerId || playerOrder[0];
  state.playerOrder = playerOrder;
  state.currentTurnPlayerId = currentTurnPlayerId;
  renderPlayers(game.players || {}, playerOrder, currentTurnPlayerId, isHost);
  renderScoreTable(game.players || {}, game.scores || {}, playerOrder, currentTurnPlayerId, finished);
  elements.resultsModal.classList.toggle("hidden", !finished || state.resultsDismissed);
  if (finished) {
    elements.playAgain.classList.toggle("hidden", !isHost);
    renderResults(game.players || {}, game.scores || {}, playerOrder);
  }
}

function renderResults(players, scores, playerOrder) {
  elements.resultsList.replaceChildren();
  const standings = playerOrder
    .map((playerId) => ({ playerId, name: players[playerId]?.name || "?", total: calculateTotal(scores[playerId] || {}) }))
    .sort((a, b) => b.total - a.total);
  const topScore = standings[0]?.total;
  standings.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = `results-item ${entry.total === topScore ? "winner" : ""}`;
    const rank = document.createElement("span");
    rank.className = "results-rank";
    rank.textContent = `${index + 1}.`;
    const name = document.createElement("span");
    name.className = "results-name";
    name.textContent = entry.playerId === state.userId ? `${entry.name} (sinä)` : entry.name;
    const score = document.createElement("span");
    score.className = "results-score";
    score.textContent = entry.total;
    item.append(rank, name, score);
    elements.resultsList.append(item);
  });
}

function getShareUrl(gameId) {
  const url = new URL(window.location.href);
  url.search = `?game=${encodeURIComponent(gameId)}`;
  return url.toString();
}

async function createGame(name) {
  const gameId = makeGameId();
  const game = { id: gameId, hostId: state.userId, createdAt: Date.now(), players: { [state.userId]: { name } }, playerOrder: [state.userId], currentTurnPlayerId: state.userId, scores: {} };
  await set(ref(database, `games/${gameId}`), game);
  state.gameId = gameId;
  state.user = { name };
  window.history.replaceState({}, "", getShareUrl(gameId));
  listenToGame();
}

async function joinGame(name) {
  const gameSnapshot = await new Promise((resolve, reject) => {
    onValue(ref(database, `games/${state.gameId}`), resolve, reject, { onlyOnce: true });
  });
  if (!gameSnapshot.exists()) {
    showMessage(elements.setupMessage, "Tätä peliä ei löytynyt. Tarkista linkki.", "error");
    return;
  }
  await update(ref(database, `games/${state.gameId}/players/${state.userId}`), { name, joinedAt: Date.now() });
  state.user = { name };
  listenToGame();
}

function listenToGame() {
  onValue(ref(database, `games/${state.gameId}`), (snapshot) => {
    if (!snapshot.exists()) {
      showSetup();
      showMessage(elements.setupMessage, "Peliä ei löytynyt tai se on poistettu.", "error");
      return;
    }
    const game = snapshot.val();
    if (!game.players || !game.players[state.userId]) {
      showSetup();
      return;
    }
    showGame(game);
  }, () => showMessage(elements.gameMessage, "Pelin tietojen lukeminen epäonnistui.", "error"));
}

function getPlayerOrder(players, savedOrder = []) {
  const order = Array.isArray(savedOrder) ? savedOrder.filter((playerId) => players[playerId]) : [];
  const newPlayerIds = Object.keys(players)
    .filter((playerId) => !order.includes(playerId))
    .sort((a, b) => (players[a].joinedAt ?? 0) - (players[b].joinedAt ?? 0));
  order.push(...newPlayerIds);
  return order;
}

function renderPlayers(players, playerOrder, currentTurnPlayerId, isHost) {
  elements.playersList.replaceChildren();
  playerOrder.forEach((playerId, index) => {
    const player = players[playerId];
    const item = document.createElement("div");
    item.className = `player-chip ${playerId === state.userId ? "current" : ""}`;
    const name = document.createElement(isHost ? "button" : "span");
    name.className = "player-name";
    name.textContent = `${index + 1}. ${player.name}`;
    if (isHost) {
      name.type = "button";
      name.dataset.playerAction = "turn";
      name.dataset.playerId = playerId;
      name.setAttribute("aria-label", `Anna vuoro pelaajalle ${player.name}`);
    }
    item.append(name);
    if (playerId === currentTurnPlayerId) {
      const turnLabel = document.createElement("small");
      turnLabel.textContent = "Vuoro";
      item.append(turnLabel);
    }
    if (isHost) {
      const actions = document.createElement("span");
      actions.className = "player-actions";
      actions.innerHTML = `<button type="button" data-player-action="up" data-player-id="${playerId}" aria-label="Siirrä ${player.name} ylemmäs" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-player-action="down" data-player-id="${playerId}" aria-label="Siirrä ${player.name} alemmas" ${index === playerOrder.length - 1 ? "disabled" : ""}>↓</button>`;
      item.append(actions);
    }
    elements.playersList.append(item);
  });
}

function renderScoreTable(players, scores, playerOrder, currentTurnPlayerId, finished) {
  state.invalidScoreInput = null;
  const playerEntries = playerOrder.map((playerId) => [playerId, players[playerId]]);
  const header = elements.table.querySelector("thead");
  const body = elements.table.querySelector("tbody");
  const footer = elements.table.querySelector("tfoot");
  header.replaceChildren();
  body.replaceChildren();
  footer.replaceChildren();

  const headerRow = document.createElement("tr");
  headerRow.innerHTML = "<th scope=\"col\">Kohta</th>";
  playerEntries.forEach(([playerId, player]) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.classList.toggle("active-turn-column", playerId === currentTurnPlayerId);
    cell.textContent = player.name;
    headerRow.append(cell);
  });
  header.append(headerRow);

  categories.forEach((category) => {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = category.label;
    row.append(label);
    playerEntries.forEach(([playerId]) => row.append(createScoreCell(playerId, category, scores[playerId]?.[category.id], playerId === currentTurnPlayerId, finished)));
    body.append(row);

    if (category.id === "sixes") {
      const subtotalRow = document.createElement("tr");
      subtotalRow.className = "subtotal-row";
      subtotalRow.innerHTML = "<th scope=\"row\">Välisumma</th>";
      playerEntries.forEach(([playerId]) => {
        const subtotalCell = document.createElement("td");
        subtotalCell.classList.toggle("active-turn-column", playerId === currentTurnPlayerId);
        subtotalCell.textContent = calculateUpperTotal(scores[playerId] || {});
        subtotalRow.append(subtotalCell);
      });
      body.append(subtotalRow);

      const bonusRow = document.createElement("tr");
      bonusRow.className = "bonus-row";
      const bonusLabel = document.createElement("th");
      bonusLabel.scope = "row";
      bonusLabel.innerHTML = "Bonus<small>63 pistettä = +50</small>";
      bonusRow.append(bonusLabel);
      playerEntries.forEach(([playerId]) => {
        const bonusCell = document.createElement("td");
        bonusCell.classList.toggle("active-turn-column", playerId === currentTurnPlayerId);
        const bonus = calculateBonus(scores[playerId] || {});
        bonusCell.textContent = bonus > 0 ? `+${bonus}` : "-";
        bonusRow.append(bonusCell);
      });
      body.append(bonusRow);
    }
  });

  const totalRow = document.createElement("tr");
  totalRow.className = "total-row";
  totalRow.innerHTML = "<th scope=\"row\">Yhteensä</th>";
  playerEntries.forEach(([playerId]) => {
    const cell = document.createElement("td");
    cell.classList.toggle("active-turn-column", playerId === currentTurnPlayerId);
    cell.textContent = calculateTotal(scores[playerId] || {});
    totalRow.append(cell);
  });
  footer.append(totalRow);
}

function createScoreCell(playerId, category, value, isActiveTurn, finished) {
  const cell = document.createElement("td");
  cell.classList.toggle("active-turn-column", isActiveTurn && !finished);
  const input = document.querySelector("#score-input-template").content.firstElementChild.cloneNode(true);
  input.value = value ?? "";
  input.dataset.playerId = playerId;
  const hadValue = value !== null && value !== undefined;
  input.disabled = finished || !isActiveTurn;
  input.placeholder = "";
  input.setAttribute("aria-label", `${category.label}, ${playerId === state.userId ? "oma" : "pelaaja"}`);
  input.addEventListener("input", () => validateScoreInput(input, category));
  input.addEventListener("change", () => saveScore(playerId, category, input.value, hadValue));
  cell.append(input);
  return cell;
}

function validateScoreInput(input, category) {
  const value = input.value === "" ? null : Number(input.value);
  const isValid = value === null || (Number.isInteger(value) && value >= 0 && value <= category.max);
  input.classList.toggle("invalid", !isValid);
  input.setAttribute("aria-invalid", String(!isValid));
  state.invalidScoreInput = isValid ? null : input;
  setScoreInputsLocked(!isValid, input);
  if (!isValid) {
    showMessage(elements.gameMessage, `Arvon pitää olla välillä 0-${category.max}.`, "error");
  } else if (elements.gameMessage.classList.contains("error")) {
    showMessage(elements.gameMessage);
  }
  return isValid;
}

function setScoreInputsLocked(locked, activeInput = null) {
  elements.table.querySelectorAll(".score-input").forEach((scoreInput) => {
    scoreInput.disabled = scoreInput !== activeInput && (locked || scoreInput.dataset.playerId !== state.currentTurnPlayerId);
  });
}

async function saveScore(playerId, category, rawValue, hadValue) {
  if (state.finished) return;
  const input = document.activeElement;
  if (state.invalidScoreInput || (input?.classList.contains("score-input") && !validateScoreInput(input, category))) return;
  const value = rawValue === "" ? null : Number(rawValue);
  const scoreRef = ref(database, `games/${state.gameId}/scores/${playerId}/${category.id}`);
  await set(scoreRef, value);
  if (value !== null && !hadValue) await advanceTurn();
  showMessage(elements.gameMessage, "Piste tallennettu.", "success");
}

async function advanceTurn() {
  const currentIndex = state.playerOrder.indexOf(state.currentTurnPlayerId);
  if (currentIndex < 0 || state.playerOrder.length < 2) return;
  const nextPlayerId = state.playerOrder[(currentIndex + 1) % state.playerOrder.length];
  await update(ref(database, `games/${state.gameId}`), { currentTurnPlayerId: nextPlayerId });
}

async function resetGame() {
  if (!state.gameId || !confirm("Nollataanko kaikki tämän pelin pisteet? Pelaajat ja pelilinkki säilyvät.")) return;
  try {
    await update(ref(database, `games/${state.gameId}`), { scores: null, finished: false });
    showMessage(elements.gameMessage, "Pisteet nollattu. Pelaajat ja peli säilyivät.", "success");
  } catch (error) {
    showMessage(elements.gameMessage, "Pisteiden nollaus epäonnistui.", "error");
    console.error(error);
  }
}

async function showResults() {
  if (!state.gameId) return;
  try {
    await update(ref(database, `games/${state.gameId}`), { finished: true });
  } catch (error) {
    showMessage(elements.gameMessage, "Tulosten näyttäminen epäonnistui.", "error");
    console.error(error);
  }
}

async function closeResults() {
  if (!state.gameId) return;
  if (!state.isHost) {
    state.resultsDismissed = true;
    elements.resultsModal.classList.add("hidden");
    return;
  }
  try {
    await update(ref(database, `games/${state.gameId}`), { finished: false });
  } catch (error) {
    showMessage(elements.gameMessage, "Tulosnäkymän sulkeminen epäonnistui.", "error");
    console.error(error);
  }
}

async function playAgain() {
  if (!state.gameId || !confirm("Aloitetaanko sama peli alusta? Pisteet nollataan, pelaajat ja linkki säilyvät.")) return;
  try {
    await update(ref(database, `games/${state.gameId}`), { scores: null, finished: false, currentTurnPlayerId: state.playerOrder[0] });
    showMessage(elements.gameMessage, "Uusi kierros alkoi samalla pelillä.", "success");
  } catch (error) {
    showMessage(elements.gameMessage, "Pelin uudelleenkäynnistys epäonnistui.", "error");
    console.error(error);
  }
}

async function updateTurnOrOrder(playerId, action) {
  if (!state.gameId) return;
  const snapshot = await new Promise((resolve, reject) => {
    onValue(ref(database, `games/${state.gameId}`), resolve, reject, { onlyOnce: true });
  });
  if (!snapshot.exists()) return;
  const game = snapshot.val();
  if (game.hostId !== state.userId) return;
  if (action === "turn") {
    await update(ref(database, `games/${state.gameId}`), { currentTurnPlayerId: playerId });
    return;
  }
  const playerOrder = getPlayerOrder(game.players || {}, game.playerOrder);
  const playerIndex = playerOrder.indexOf(playerId);
  const targetIndex = action === "up" ? playerIndex - 1 : playerIndex + 1;
  if (playerIndex < 0 || targetIndex < 0 || targetIndex >= playerOrder.length) return;
  [playerOrder[playerIndex], playerOrder[targetIndex]] = [playerOrder[targetIndex], playerOrder[playerIndex]];
  await update(ref(database, `games/${state.gameId}`), { playerOrder });
}

function calculateTotal(playerScores) {
  const categoryTotal = categories.reduce((total, category) => total + (Number(playerScores[category.id]) || 0), 0);
  return categoryTotal + calculateBonus(playerScores);
}

function calculateUpperTotal(playerScores) {
  return upperCategories.reduce((total, category) => total + (Number(playerScores[category.id]) || 0), 0);
}

function calculateBonus(playerScores) {
  return calculateUpperTotal(playerScores) >= 63 ? 50 : 0;
}

elements.createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = new FormData(event.currentTarget).get("name").trim();
  if (!name || !(await startFirebase())) return;
  try { await createGame(name); } catch (error) { showMessage(elements.setupMessage, "Pelin luominen epäonnistui.", "error"); console.error(error); }
});

elements.joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = new FormData(event.currentTarget).get("name").trim();
  if (!name || !(await startFirebase())) return;
  try { await joinGame(name); } catch (error) { showMessage(elements.setupMessage, "Peliin liittyminen epäonnistui.", "error"); console.error(error); }
});

elements.copyLink.addEventListener("click", async () => {
  await navigator.clipboard.writeText(elements.shareLink.textContent);
  elements.copyLink.textContent = "Kopioitu";
  setTimeout(() => { elements.copyLink.textContent = "Kopioi linkki"; }, 1600);
});

elements.resetGame.addEventListener("click", resetGame);
elements.showResults.addEventListener("click", showResults);
elements.playAgain.addEventListener("click", playAgain);
elements.closeResults.addEventListener("click", closeResults);

elements.playersList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-player-action]");
  if (!button) return;
  try {
    await updateTurnOrOrder(button.dataset.playerId, button.dataset.playerAction);
  } catch (error) {
    showMessage(elements.gameMessage, "Pelaajajärjestyksen tai vuoron päivitys epäonnistui.", "error");
    console.error(error);
  }
});

elements.homeLink.href = window.location.pathname;

if (state.gameId) showSetup();
startFirebase().then((ready) => { if (ready && state.gameId) listenToGame(); });
