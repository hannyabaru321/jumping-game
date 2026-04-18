import { Game } from "./Game.js";
import {
  API_CONFIG,
  CHARACTER_LIST,
  DEFAULT_CHARACTER_ID,
  DEFAULT_UNLOCKED_CHARACTER_IDS,
  STORAGE_KEYS,
  UI_ASSETS
} from "./config.js";

/*
============================================================
main.js
------------------------------------------------------------
アプリ起動処理と画面UI制御を担当する。

【主な役割】
- DOM参照の初期化
- 設定 / ランキングモーダル制御
- キャラクター解放 / 選択管理
- ランキングAPI通信
- スコア送信 / アクセスログ送信
============================================================
*/

/* ============================================================
   DOM参照
   ============================================================ */

const dom = {
  gameBoard: document.getElementById("gameBoard"),
  playfield: document.getElementById("playfield"),
  backgroundLayerA: document.getElementById("backgroundLayerA"),
  backgroundLayerB: document.getElementById("backgroundLayerB"),
  effectLayer: document.getElementById("effectLayer"),
  worldLayer: document.getElementById("worldLayer"),
  overlay: document.getElementById("overlay"),
  startButton: document.getElementById("startButton"),
  scoreValue: document.getElementById("scoreValue"),
  highScoreValue: document.getElementById("highScoreValue"),
  leftButton: document.getElementById("leftButton"),
  rightButton: document.getElementById("rightButton")
};

const ui = {
  modalSettings: document.getElementById("modalSettings"),
  modalRanking: document.getElementById("modalRanking"),
  btnSettings: document.getElementById("btnSettings"),
  btnRanking: document.getElementById("btnRanking"),
  inputName: document.getElementById("inputName"),
  saveSettingsButton: document.getElementById("saveSettings"),
  rankingList: document.getElementById("rankingList"),

  unlockModal: document.getElementById("unlockModal"),
  unlockCharacterImage: document.getElementById("unlockCharacterImage"),
  unlockCharacterName: document.getElementById("unlockCharacterName"),
  unlockModalCloseButton: document.getElementById("unlockModalCloseButton"),

  lockedCharacterModal: document.getElementById("lockedCharacterModal"),
  lockedCharacterImage: document.getElementById("lockedCharacterImage"),
  lockedCharacterName: document.getElementById("lockedCharacterName"),
  lockedCharacterCondition: document.getElementById("lockedCharacterCondition"),
  lockedCharacterModalCloseButton: document.getElementById(
    "lockedCharacterModalCloseButton"
  )
};

/* ============================================================
   定数
   ============================================================ */

/*
  config.js に移してもよい候補。
  今回は main.js 単体で読みやすいようにここへまとめている。
*/
const MAIN_CONFIG = {
  rankingDisplayCount: 20,
  playerNameMaxLength: 10,
  defaultPlayerName: "プレイヤー",
  accessLogStorageKeyPrefix: "jumping-game-last-access-log-date-"
};

const PLAYER_NAME_NG_WORDS = [
  "うんこ", "うんち", "ちんこ", "ちんちん", "まんこ", "まんまん",
  "ちくび", "おっぱい", "ぱいぱい", "せっくす", "えっち", "エッチ",
  "ばか", "バカ", "あほ", "アホ", "くそ", "クソ", "死ね", "しね",
  "殺す", "ころす", "殺害", "消えろ", "消え失せろ",
  "レイプ", "強姦", "暴行", "虐待",
  "sex", "fuck", "fuk", "shit", "bitch", "ass", "dick", "pussy", "cock",
  "www", "www.", "http", "https", ".com", ".net", ".jp"
];

/* ============================================================
   画面状態
   ============================================================ */

const state = {
  selectedCharacterId:
    localStorage.getItem(STORAGE_KEYS.characterId) ?? DEFAULT_CHARACTER_ID,
  unlockQueue: [],
  isUnlockModalShowing: false
};

/* ============================================================
   ゲーム生成 / 起動
   ============================================================ */

const game = new Game(dom);
initializeApp();

/**
 * アプリ全体を初期化する。
 */
function initializeApp() {
  initializePlayerSettings();
  game.initialize();
  renderCharacterList();
  bindStaticEvents();

  sendAccessLogOncePerDay().catch((error) => {
    console.error("access log error:", error);
  });
}

/* ============================================================
   イベント登録
   ============================================================ */

/**
 * 初期表示時に存在する固定要素へイベントを登録する。
 */
function bindStaticEvents() {
  ui.btnSettings?.addEventListener("click", openSettingsModal);
  ui.btnRanking?.addEventListener("click", () => {
    void openRankingModal();
  });

  ui.saveSettingsButton?.addEventListener("click", savePlayerSettings);
  ui.unlockModalCloseButton?.addEventListener("click", closeUnlockModal);
  ui.lockedCharacterModalCloseButton?.addEventListener(
    "click",
    closeLockedCharacterModal
  );

  document.querySelectorAll(".backButton").forEach((button) => {
    button.addEventListener("click", closeAllModals);
  });

  document.querySelectorAll(".chara-button").forEach((button) => {
    button.addEventListener("click", () => {
      selectCharacter(button.dataset.id ?? "");
    });
  });

  /*
    ゲームオーバー時のボタンは動的生成されるため、
    document 側でイベント委譲している。
  */
  document.addEventListener("click", (event) => {
    void handleDynamicButtonClick(event);
  });
}

/* ============================================================
   プレイヤー設定初期化
   ============================================================ */

/**
 * プレイヤー設定を初期化する。
 * - 名前
 * - 解放済みキャラ
 * - 新規解放キャラ
 * - 選択キャラ
 * - プレイヤーID
 */
function initializePlayerSettings() {
  const savedName = localStorage.getItem(STORAGE_KEYS.playerName) ?? "";

  if (ui.inputName) {
    ui.inputName.value = savedName;
  }

  ensureStorageArray(STORAGE_KEYS.unlockedCharacters, DEFAULT_UNLOCKED_CHARACTER_IDS);
  ensureStorageArray(STORAGE_KEYS.newUnlockedCharacters, []);

  if (!isValidCharacterId(state.selectedCharacterId)) {
    state.selectedCharacterId = DEFAULT_CHARACTER_ID;
    localStorage.setItem(STORAGE_KEYS.characterId, DEFAULT_CHARACTER_ID);
  }

  getOrCreatePlayerId();
}

/**
 * localStorage 上に配列データが無ければ初期値を保存する。
 */
function ensureStorageArray(storageKey, defaultValue) {
  if (!localStorage.getItem(storageKey)) {
    localStorage.setItem(storageKey, JSON.stringify(defaultValue));
  }
}

/**
 * キャラクターIDが定義済みか判定する。
 */
function isValidCharacterId(characterId) {
  return CHARACTER_LIST.some((character) => character.id === characterId);
}

/* ============================================================
   localStorage 補助
   ============================================================ */

/**
 * プレイヤーIDを取得する。
 * 未作成なら新しく発行して保存する。
 */
function getOrCreatePlayerId() {
  let playerId = localStorage.getItem(STORAGE_KEYS.playerId);

  if (!playerId) {
    playerId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.playerId, playerId);
  }

  return playerId;
}

/**
 * 現在のプレイヤー名を返す。
 * 未設定時は既定値を返す。
 */
function getCurrentPlayerName() {
  return localStorage.getItem(STORAGE_KEYS.playerName) || MAIN_CONFIG.defaultPlayerName;
}

/**
 * 現在選択されているキャラIDを返す。
 */
function getCurrentCharacterId() {
  return localStorage.getItem(STORAGE_KEYS.characterId) || DEFAULT_CHARACTER_ID;
}

/**
 * ハイスコアを返す。
 */
function getHighScore() {
  return Number(localStorage.getItem(STORAGE_KEYS.highScore)) || 0;
}

/**
 * 指定IDのキャラクター情報を返す。
 * 見つからない場合は先頭キャラを返す。
 */
function getCharacterById(characterId) {
  return (
    CHARACTER_LIST.find((character) => character.id === characterId) ||
    CHARACTER_LIST[0]
  );
}

/**
 * localStorage からJSON配列を読む。
 * 不正値なら fallbackValue を複製して返す。
 */
function readJsonArrayFromStorage(storageKey, fallbackValue) {
  const rawValue = localStorage.getItem(storageKey);

  if (!rawValue) {
    return [...fallbackValue];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [...fallbackValue];
  } catch {
    return [...fallbackValue];
  }
}

function getUnlockedCharacters() {
  return readJsonArrayFromStorage(
    STORAGE_KEYS.unlockedCharacters,
    DEFAULT_UNLOCKED_CHARACTER_IDS
  );
}

function saveUnlockedCharacters(characterIds) {
  localStorage.setItem(
    STORAGE_KEYS.unlockedCharacters,
    JSON.stringify(characterIds)
  );
}

function getNewUnlockedCharacters() {
  return readJsonArrayFromStorage(STORAGE_KEYS.newUnlockedCharacters, []);
}

function saveNewUnlockedCharacters(characterIds) {
  localStorage.setItem(
    STORAGE_KEYS.newUnlockedCharacters,
    JSON.stringify(characterIds)
  );
}

/* ============================================================
   キャラクター解放 / 選択
   ============================================================ */

/**
 * ハイスコアに応じてキャラ解放状態を更新する。
 * 新しく解放されたキャラID一覧を返す。
 */
function updateUnlocksByScore() {
  const highScore = getHighScore();
  const unlocked = getUnlockedCharacters();
  const newlyUnlocked = [];

  for (const character of CHARACTER_LIST) {
    const canUnlock = highScore >= character.unlockScore;
    const alreadyUnlocked = unlocked.includes(character.id);

    if (canUnlock && !alreadyUnlocked) {
      unlocked.push(character.id);
      newlyUnlocked.push(character.id);
    }
  }

  if (newlyUnlocked.length > 0) {
    saveUnlockedCharacters(unlocked);

    const mergedNewUnlocked = [
      ...new Set([...getNewUnlockedCharacters(), ...newlyUnlocked])
    ];

    saveNewUnlockedCharacters(mergedNewUnlocked);
  }

  return newlyUnlocked;
}

/**
 * キャラ一覧の見た目を更新する。
 * - 解放済み / 未解放
 * - 選択状態
 * - NEWバッジ
 */
function renderCharacterList() {
  const unlockedCharacters = getUnlockedCharacters();
  const newUnlockedCharacters = getNewUnlockedCharacters();

  document.querySelectorAll(".chara-button").forEach((button) => {
    const characterId = button.dataset.id ?? "";
    const image = button.querySelector(".chara-item");
    const badge = button.querySelector(".chara-new-badge");
    const character = getCharacterById(characterId);
    const isUnlocked = unlockedCharacters.includes(characterId);
    const isNew = newUnlockedCharacters.includes(characterId);
    const isSelected = isUnlocked && state.selectedCharacterId === characterId;

    if (!(image instanceof HTMLImageElement)) {
      return;
    }

    image.src = isUnlocked ? character.src : UI_ASSETS.lockedCharacterImage;
    image.alt = character.name;
    image.classList.toggle("locked", !isUnlocked);
    image.classList.toggle("selected", isSelected);

    if (badge instanceof HTMLElement) {
      badge.classList.toggle("hidden", !isUnlocked || !isNew);
    }
  });
}

/**
 * キャラ選択処理。
 * 未解放なら条件モーダルを表示する。
 */
function selectCharacter(characterId) {
  if (!characterId) {
    return;
  }

  const unlockedCharacters = getUnlockedCharacters();

  if (!unlockedCharacters.includes(characterId)) {
    showLockedCharacterMessage(characterId);
    return;
  }

  state.selectedCharacterId = characterId;
  clearNewBadge(characterId);
  renderCharacterList();
}

/**
 * NEWバッジを消す。
 */
function clearNewBadge(characterId) {
  const filtered = getNewUnlockedCharacters().filter((id) => id !== characterId);
  saveNewUnlockedCharacters(filtered);
}

/**
 * 未解放キャラの解放条件モーダルを表示する。
 */
function showLockedCharacterMessage(characterId) {
  const character = getCharacterById(characterId);

  if (
    !ui.lockedCharacterImage ||
    !ui.lockedCharacterName ||
    !ui.lockedCharacterCondition ||
    !ui.lockedCharacterModal
  ) {
    return;
  }

  ui.lockedCharacterImage.src = UI_ASSETS.lockedCharacterImage;
  ui.lockedCharacterName.textContent = character.name;
  ui.lockedCharacterCondition.textContent =
    `解放条件: スコア ${character.unlockScore} 以上`;
  ui.lockedCharacterModal.classList.remove("hidden");
}

/**
 * 未解放キャラ条件モーダルを閉じる。
 */
function closeLockedCharacterModal() {
  ui.lockedCharacterModal?.classList.add("hidden");
}

/* ============================================================
   解放演出
   ============================================================ */

/**
 * 解放演出キューへ追加する。
 * 複数解放時は順番に表示する。
 */
function enqueueUnlockEffects(characterIds) {
  for (const characterId of characterIds) {
    const character = getCharacterById(characterId);

    if (character) {
      state.unlockQueue.push(character);
    }
  }

  showNextUnlockEffect();
}

/**
 * 次の解放演出を表示する。
 */
function showNextUnlockEffect() {
  if (state.isUnlockModalShowing || state.unlockQueue.length === 0) {
    return;
  }

  const character = state.unlockQueue.shift();

  if (
    !character ||
    !ui.unlockModal ||
    !ui.unlockCharacterImage ||
    !ui.unlockCharacterName
  ) {
    return;
  }

  ui.unlockCharacterImage.src = character.src;
  ui.unlockCharacterName.textContent = character.name;
  ui.unlockModal.classList.remove("hidden");
  state.isUnlockModalShowing = true;
}

/**
 * 解放演出モーダルを閉じる。
 * 閉じた後、次の演出があれば続けて表示する。
 */
function closeUnlockModal() {
  ui.unlockModal?.classList.add("hidden");
  state.isUnlockModalShowing = false;
  showNextUnlockEffect();
}

/* ============================================================
   モーダル制御
   ============================================================ */

/**
 * 設定モーダルを開く。
 * 開く前にスコアによる解放更新も行う。
 */
function openSettingsModal() {
  const newlyUnlocked = updateUnlocksByScore();

  renderCharacterList();
  ui.modalSettings?.classList.remove("hidden");

  if (newlyUnlocked.length > 0) {
    enqueueUnlockEffects(newlyUnlocked);
  }
}

/**
 * ランキングモーダルを開いてランキングを読み込む。
 */
async function openRankingModal() {
  if (!ui.rankingList) {
    return;
  }

  ui.rankingList.innerHTML = '<li><span>読み込み中...</span></li>';
  ui.modalRanking?.classList.remove("hidden");

  try {
    const ranking = await fetchRanking();
    renderRanking(ranking);
  } catch (error) {
    console.error(error);
    ui.rankingList.innerHTML =
      '<li><span>ランキングの取得に失敗しました。</span></li>';
  }
}

/**
 * すべてのモーダルを閉じる。
 */
function closeAllModals() {
  ui.modalSettings?.classList.add("hidden");
  ui.modalRanking?.classList.add("hidden");
  ui.lockedCharacterModal?.classList.add("hidden");
  ui.unlockModal?.classList.add("hidden");

  state.isUnlockModalShowing = false;
}

/* ============================================================
   プレイヤー設定保存
   ============================================================ */

/**
 * 設定画面の入力内容を保存する。
 */
function savePlayerSettings() {
  const playerName = ui.inputName?.value?.trim() ?? "";
  const errorMessage = validatePlayerName(playerName);

  if (errorMessage) {
    alert(errorMessage);
    return;
  }

  localStorage.setItem(STORAGE_KEYS.playerName, playerName);
  localStorage.setItem(STORAGE_KEYS.characterId, state.selectedCharacterId);

  renderCharacterList();
  ui.modalSettings?.classList.add("hidden");
}

/**
 * プレイヤー名を検証する。
 * 問題がある場合はエラーメッセージを返す。
 * 問題がない場合は空文字を返す。
 */
function validatePlayerName(name) {
  const trimmed = String(name || "").trim();

  if (trimmed.length === 0) {
    return "名前を入力してください。";
  }

  if (trimmed.length > MAIN_CONFIG.playerNameMaxLength) {
    return `名前は${MAIN_CONFIG.playerNameMaxLength}文字以内で入力してください。`;
  }

  /*
    スプレッドシート等へ貼り付けた際の式解釈を避けるため、
    先頭が = + - @ の名前は禁止する。
  */
  if (/^[=+\-@]/.test(trimmed)) {
    return "その名前は使用できません。";
  }

  /*
    使える文字を制限する。
    ひらがな / カタカナ / 漢字 / 英数字 / 全角英数字 / 一部記号のみ許可。
  */
  if (!/^[ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９Ａ-Ｚａ-ｚ _-]+$/.test(trimmed)) {
    return "使用できない文字が含まれています。";
  }

  const lowerName = trimmed.toLowerCase();
  const containsNgWord = PLAYER_NAME_NG_WORDS.some((word) =>
    lowerName.includes(word.toLowerCase())
  );

  return containsNgWord ? "その名前は使用できません。" : "";
}

/* ============================================================
   API通信
   ============================================================ */

/**
 * APIへJSONをPOSTする共通関数。
 */
async function postJson(url, bodyObject) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(bodyObject)
  });

  if (!response.ok) {
    throw new Error("通信に失敗しました。");
  }

  return response.json();
}

/**
 * APIからJSONを取得する共通関数。
 */
async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("通信に失敗しました。");
  }

  return response.json();
}

/**
 * スコアを送信する。
 */
async function submitScore(score) {
  const result = await postJson(API_CONFIG.rankingApiUrl, {
    playerId: getOrCreatePlayerId(),
    name: getCurrentPlayerName(),
    score,
    characterId: getCurrentCharacterId()
  });

  if (!result.ok) {
    throw new Error(result.message || "スコア送信に失敗しました。");
  }

  return result;
}

/**
 * ランキングを取得する。
 */
async function fetchRanking() {
  const result = await fetchJson(`${API_CONFIG.rankingApiUrl}?action=ranking`);

  if (!result.ok) {
    throw new Error(result.message || "ランキング取得に失敗しました。");
  }

  return result.ranking ?? [];
}

/**
 * ランキング一覧を画面へ描画する。
 */
function renderRanking(ranking) {
  if (!ui.rankingList) {
    return;
  }

  if (!Array.isArray(ranking) || ranking.length === 0) {
    ui.rankingList.innerHTML =
      '<li><span>まだランキングデータがありません。</span></li>';
    return;
  }

  ui.rankingList.innerHTML = ranking
    .slice(0, MAIN_CONFIG.rankingDisplayCount)
    .map((item) => {
      const character = getCharacterById(item.characterId);

      return `
        <li>
          <span>${item.rank}位</span>
          <span>${escapeHtml(item.name)}</span>
          <img
            src="${character.src}"
            alt="${escapeHtml(character.name)}"
            class="ranking-character-image"
          />
          <span>${item.score}</span>
        </li>
      `;
    })
    .join("");
}

/* ============================================================
   アクセスログ
   ============================================================ */

/**
 * 今日の日付を YYYY-MM-DD 形式で返す。
 */
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * 1日1回だけアクセスログを送信する。
 * 同一プレイヤーIDごとに送信日を記録する。
 */
async function sendAccessLogOncePerDay() {
  const playerId = getOrCreatePlayerId();
  const today = getTodayString();
  const storageKey =
    `${MAIN_CONFIG.accessLogStorageKeyPrefix}${playerId}`;
  const lastSentDate = localStorage.getItem(storageKey);

  if (lastSentDate === today) {
    return;
  }

  const result = await postJson(API_CONFIG.rankingApiUrl, {
    action: "logAccess",
    playerId,
    name: getCurrentPlayerName(),
    date: today
  });

  if (!result.ok) {
    throw new Error(result.message || "アクセスログ送信に失敗しました。");
  }

  localStorage.setItem(storageKey, today);
}

/* ============================================================
   動的ボタン処理
   ============================================================ */

/**
 * 動的に生成されたボタン押下を処理する。
 * 主にゲームオーバー画面内のボタン用。
 */
async function handleDynamicButtonClick(event) {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.id === "btnSettingsGameOver") {
    openSettingsModal();
    return;
  }

  if (target.id === "btnRankingGameOver") {
    await openRankingModal();
    return;
  }

  if (target.id !== "submitScoreButton") {
    return;
  }

  const score = game.getScore();

  try {
    target.setAttribute("disabled", "true");
    target.textContent = "送信中...";

    await submitScore(score);

    target.textContent = "送信済み";
    alert("スコアを送信しました。");
  } catch (error) {
    console.error(error);
    target.removeAttribute("disabled");
    target.textContent = "スコア送信";
    alert("スコア送信に失敗しました。");
  }
}

/* ============================================================
   文字列補助
   ============================================================ */

/**
 * HTML文字列をエスケープする。
 */
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}