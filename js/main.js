import { Game } from "./Game.js";
import {
  CHARACTER_LIST,
  DEFAULT_CHARACTER_ID,
  PLAYER_STORAGE_KEYS
} from "./config.js";

/*
  ============================================================
  main.js
  ------------------------------------------------------------
  起動＋画面制御
  ============================================================
*/

// ==========================
// ランキングAPI
// ==========================
const RANKING_API_URL = "https://script.google.com/macros/s/AKfycbxvxTnoL5KB58ZzftpQCimqcP4xW5JcyfQlGiIlccSMk3ijppf29-IWGwbCYKEvHMSCLA/exec";

// ==========================
// DOM取得
// ==========================
const dom = {
  gameBoard: document.getElementById("gameBoard"),
  playfield: document.getElementById("playfield"),
  backgroundLayerA: document.getElementById("backgroundLayerA"),
  backgroundLayerB: document.getElementById("backgroundLayerB"),
  worldLayer: document.getElementById("worldLayer"),
  overlay: document.getElementById("overlay"),
  startButton: document.getElementById("startButton"),
  scoreValue: document.getElementById("scoreValue"),
  highScoreValue: document.getElementById("highScoreValue"),
  leftButton: document.getElementById("leftButton"),
  rightButton: document.getElementById("rightButton")
};

// ==========================
// ゲーム初期化
// ==========================
const game = new Game(dom);
game.initialize();

// ==========================
// 設定・モーダル関連DOM
// ==========================
const modalSettings = document.getElementById("modalSettings");
const modalRanking = document.getElementById("modalRanking");
const btnSettings = document.getElementById("btnSettings");
const btnRanking = document.getElementById("btnRanking");
const inputName = document.getElementById("inputName");
const saveSettingsButton = document.getElementById("saveSettings");
const rankingList = document.getElementById("rankingList");

// ==========================
// 初期値読み込み
// ==========================
let selectedCharacterId =
  localStorage.getItem(PLAYER_STORAGE_KEYS.characterId) ??
  DEFAULT_CHARACTER_ID;

const savedName =
  localStorage.getItem(PLAYER_STORAGE_KEYS.name) ?? "";

if (inputName) {
  inputName.value = savedName;
}

// playerId を初回だけ生成
getOrCreatePlayerId();

// ==========================
// 共通関数
// ==========================
function getOrCreatePlayerId() {
  let playerId = localStorage.getItem(PLAYER_STORAGE_KEYS.playerId);

  if (!playerId) {
    playerId = crypto.randomUUID();
    localStorage.setItem(PLAYER_STORAGE_KEYS.playerId, playerId);
  }

  return playerId;
}

function getCurrentPlayerName() {
  return localStorage.getItem(PLAYER_STORAGE_KEYS.name) || "プレイヤー";
}

function getCurrentCharacterId() {
  return (
    localStorage.getItem(PLAYER_STORAGE_KEYS.characterId) ||
    DEFAULT_CHARACTER_ID
  );
}

function getCharacterById(characterId) {
  return (
    CHARACTER_LIST.find((character) => character.id === characterId) ||
    CHARACTER_LIST[0]
  );
}

function getCurrentScoreFromOverlay() {
  const scoreStrong = document.querySelector(".overlay-text strong");
  const scoreText = scoreStrong?.textContent ?? "0";
  const score = Number(scoreText);

  return Number.isFinite(score) ? score : 0;
}

// ==========================
// API通信
// ==========================
async function submitScore(score) {
  const playerId = getOrCreatePlayerId();
  const name = getCurrentPlayerName();
  const characterId = getCurrentCharacterId();

  const response = await fetch(RANKING_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      playerId,
      name,
      score,
      characterId
    })
  });

  if (!response.ok) {
    throw new Error("スコア送信に失敗しました。");
  }

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.message || "スコア送信に失敗しました。");
  }

  return result;
}

async function fetchRanking() {
  const response = await fetch(`${RANKING_API_URL}?action=ranking`);

  if (!response.ok) {
    throw new Error("ランキング取得に失敗しました。");
  }

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.message || "ランキング取得に失敗しました。");
  }

  return result.ranking ?? [];
}

// ==========================
// キャラ選択UI
// ==========================
document.querySelectorAll(".chara-item").forEach((img) => {
  if (img.dataset.id === selectedCharacterId) {
    img.classList.add("selected");
  }

  img.addEventListener("click", () => {
    document.querySelectorAll(".chara-item").forEach((item) => {
      item.classList.remove("selected");
    });

    img.classList.add("selected");
    selectedCharacterId = img.dataset.id ?? DEFAULT_CHARACTER_ID;
  });
});

// ==========================
// 設定保存
// ==========================
if (saveSettingsButton) {
  saveSettingsButton.addEventListener("click", () => {
    const playerName = inputName?.value?.trim() ?? "";

    localStorage.setItem(PLAYER_STORAGE_KEYS.name, playerName);
    localStorage.setItem(PLAYER_STORAGE_KEYS.characterId, selectedCharacterId);

    modalSettings?.classList.add("hidden");
  });
}

// ==========================
// ランキング表示
// ==========================
function renderRanking(ranking) {
  if (!rankingList) {
    return;
  }

  if (!Array.isArray(ranking) || ranking.length === 0) {
    rankingList.innerHTML = `
      <li>
        <span>まだランキングデータがありません。</span>
      </li>
    `;
    return;
  }

  rankingList.innerHTML = ranking
    .slice(0, 20)
    .map((item) => {
      const character = getCharacterById(item.characterId);

      return `
        <li>
          <span>${item.rank}位</span>
          <span>${escapeHtml(item.name)}</span>
          <img
            src="${character.src}"
            alt="${escapeHtml(character.name)}"
            style="width:32px;height:32px;object-fit:contain;"
          />
          <span>${item.score}</span>
        </li>
      `;
    })
    .join("");
}

async function openRankingModal() {
  if (!rankingList) {
    return;
  }

  rankingList.innerHTML = `
    <li>
      <span>読み込み中...</span>
    </li>
  `;

  modalRanking?.classList.remove("hidden");

  try {
    const ranking = await fetchRanking();
    renderRanking(ranking);
  } catch (error) {
    console.error(error);

    rankingList.innerHTML = `
      <li>
        <span>ランキングの取得に失敗しました。</span>
      </li>
    `;
  }
}

// ==========================
// モーダル開閉
// ==========================
function openSettingsModal() {
  modalSettings?.classList.remove("hidden");
}

if (btnSettings) {
  btnSettings.addEventListener("click", openSettingsModal);
}

if (btnRanking) {
  btnRanking.addEventListener("click", openRankingModal);
}

document.querySelectorAll(".backButton").forEach((btn) => {
  btn.addEventListener("click", () => {
    modalSettings?.classList.add("hidden");
    modalRanking?.classList.add("hidden");
  });
});

// ==========================
// 動的ボタン対応
// ゲームオーバー画面のボタンは後から生成される
// ==========================
document.addEventListener("click", async (event) => {
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

  if (target.id === "submitScoreButton") {
    const score = getCurrentScoreFromOverlay();

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
});

// ==========================
// HTMLエスケープ
// ==========================
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}