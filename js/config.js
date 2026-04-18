/*
  ============================================================
  config.js
  ------------------------------------------------------------
  ゲーム全体で使う定数・設定値・補助関数をまとめるファイル。

  ■ このファイルの役割
  - ゲーム進行に関する設定値
  - 描画に関する設定値
  - キャラクターやテーマ画像の定義
  - ローカル保存キーの管理
  - スコアに応じたテーマ / 演出の判定

  ■ 運用ルール
  - 調整値を変更したい場合は、まずこのファイルを確認する
  - 値の意味が曖昧にならないよう、できるだけコメントを残す
  - 既存処理を壊さないため、公開している定数名・関数名は維持する
  ============================================================
*/

/* ============================================================
   1. デバッグ設定
   ------------------------------------------------------------
   開発時だけ使う切り替え項目をまとめる。
   ============================================================ */
export const DEBUG_CONFIG = {
  /*
    プレビュー用UIを表示するかどうか。
    true  : 表示する
    false : 表示しない
  */
  enablePreview: false
};

/* ============================================================
   2. 列挙的に使う定数
   ------------------------------------------------------------
   文字列の直書きを減らし、タイプミスを防ぐためにまとめる。
   ============================================================ */

/* プレイヤーの左右レーン */
export const LANE = {
  left: "left",
  right: "right"
};

/* ゲーム全体の状態 */
export const GAME_STATUS = {
  ready: "ready",
  playing: "playing",
  gameOver: "gameOver"
};

/* 足場（ステップ）の状態 */
export const STEP_STATE = {
  stable: "stable",
  collapsing: "collapsing",
  falling: "falling"
};

/* ============================================================
   3. 保存キー
   ------------------------------------------------------------
   localStorage / sessionStorage などに保存する際のキーを定義する。
   キー名を一元管理しておくことで、変更や調査をしやすくする。
   ============================================================ */
export const STORAGE_KEYS = {
  highScore: "jumping-game-high-score",
  playerName: "jumping-game-player-name",
  characterId: "jumping-game-character-id",
  playerId: "jumping-game-player-id",
  unlockedCharacters: "jumping-game-unlocked-characters",
  newUnlockedCharacters: "jumping-game-new-unlocked-characters"
};

/* ============================================================
   4. 外部連携設定
   ------------------------------------------------------------
   ランキング送信先など、外部と通信する設定をまとめる。
   ============================================================ */
export const API_CONFIG = {
  rankingApiUrl:
    "https://script.google.com/macros/s/AKfycbxvxTnoL5KB58ZzftpQCimqcP4xW5JcyfQlGiIlccSMk3ijppf29-IWGwbCYKEvHMSCLA/exec"
};

/* ============================================================
   5. UI用アセット
   ------------------------------------------------------------
   共通UIで使う画像パスをまとめる。
   ============================================================ */
export const UI_ASSETS = {
  lockedCharacterImage: "assets/ui/question.png"
};

/* ============================================================
   6. キャラクター定義
   ------------------------------------------------------------
   キャラクター一覧を定義する。
   unlockScore が 0 のものは最初から使用可能とする。
   ============================================================ */
export const CHARACTER_LIST = [
  {
    id: "chara_01",
    name: "キャラ1",
    src: "assets/chara/chara_01.png",
    unlockScore: 0
  },
  {
    id: "chara_02",
    name: "キャラ2",
    src: "assets/chara/chara_02.png",
    unlockScore: 0
  },
  {
    id: "chara_03",
    name: "キャラ3",
    src: "assets/chara/chara_03.png",
    unlockScore: 100
  },
  {
    id: "chara_04",
    name: "キャラ4",
    src: "assets/chara/chara_04.png",
    unlockScore: 200
  },
  {
    id: "chara_05",
    name: "キャラ5",
    src: "assets/chara/chara_05.png",
    unlockScore: 500
  },
  {
    id: "chara_06",
    name: "キャラ6",
    src: "assets/chara/chara_06.png",
    unlockScore: 800
  },
  {
    id: "chara_07",
    name: "キャラ7",
    src: "assets/chara/chara_07.png",
    unlockScore: 1000
  }
];

/*
  デフォルト選択キャラクター。
  先頭のキャラクターを初期値として採用する。
*/
export const DEFAULT_CHARACTER_ID = CHARACTER_LIST[0].id;

/*
  初期解放キャラクター一覧。
  unlockScore が 0 のキャラクターを抽出する。
*/
export const DEFAULT_UNLOCKED_CHARACTER_IDS = CHARACTER_LIST
  .filter((character) => character.unlockScore === 0)
  .map((character) => character.id);

/* ============================================================
   7. ゲーム進行設定
   ------------------------------------------------------------
   難易度・崩壊速度・障害物出現率など、
   ゲームルールに影響する値をまとめる。
   ============================================================ */
export const GAME_CONFIG = {
  /* 画面内に見せる足場数 */
  visibleStepCount: 8,

  /* 先読み生成しておく予備足場数 */
  reserveStepCount: 12,

  /* ゲーム開始時のプレイヤー位置 */
  playerStartLane: LANE.left,

  /* -----------------------------
     足場崩壊のタイミング設定
     ----------------------------- */
  collapseDelayMs: 1000,
  collapseDelayReductionPer100ScoreMs: 100,
  collapseDelayMinMs: 500,
  warningTimeMs: 300,

  /* -----------------------------
     障害物の出現率設定
     ----------------------------- */
  obstacleSpawnRateBase: 0.3,
  obstacleSpawnRateIncreasePer100Score: 0.07,
  obstacleSpawnRateMaxScore: 1000,

  /* -----------------------------
     動く足場の設定
     ----------------------------- */
  movingStepEnabledScore: 200,
  movingStepSpawnRateBase: 0.1,
  movingStepSpawnRateIncreasePer100Score: 0.1,
  movingStepSpawnRateMax: 0.5,
  movingStepTriggerDistanceEasy: 3,
  movingStepTriggerDistanceHard: 2,
  movingStepHardModeScore: 500,

  /* -----------------------------
     テーマ切替スコア
     0: ～100
     1: 101～200
     2: 201～500
     3: 501～1000
     4: 1001～
     ----------------------------- */
  themeScoreThresholds: [100, 200, 500, 1000]
};

/* ============================================================
   8. 描画設定
   ------------------------------------------------------------
   見た目・配置・描画更新に関わる設定値をまとめる。
   ============================================================ */
export const RENDER_CONFIG = {
  /*
    盤面上の基準Y位置。
    足場の並び全体をどの高さから描き始めるかを決める。
  */
  boardBaseYRatio: 0.85,

  /*
    左右の足場のX方向ずれ量。
    斜めに並んで見えるようにするための比率。
  */
  stepOffsetXRatio: 0.1,

  /*
    足場同士のY方向間隔。
  */
  stepOffsetYRatio: 0.07,

  /*
    崩壊状態の再描画・再計算間隔。
  */
  collapseStateRefreshMs: 50,

  /*
    障害物の候補位置。
    x, y は足場基準の相対位置として扱う前提。
  */
  obstaclePositionCandidates: [
    { x: -1, y: 1 },
    { x: 1, y: 1 },
    { x: -3, y: 1 },
    { x: 3, y: 1 }
  ]
};

/* ============================================================
   9. ステージ演出設定
   ------------------------------------------------------------
   スコア帯ごとにどの演出を出すかを定義する。
   type は CSS / JS 側で参照される識別子。
   ============================================================ */

/* 演出なしの既定値 */
export const DEFAULT_STAGE_EFFECT = {
  type: "none",
  label: "なし"
};

export const STAGE_EFFECTS = [
  { minScore: 0, maxScore: 50, type: "none", label: "なし" },
  { minScore: 51, maxScore: 100, type: "leaves", label: "葉っぱ" },
  { minScore: 101, maxScore: 150, type: "none", label: "なし" },
  { minScore: 151, maxScore: 200, type: "sand", label: "砂嵐" },
  { minScore: 201, maxScore: 350, type: "none", label: "なし" },
  { minScore: 351, maxScore: 500, type: "snow", label: "雪" },
  { minScore: 501, maxScore: 750, type: "none", label: "なし" },
  { minScore: 751, maxScore: 1000, type: "sunray", label: "光" },
  { minScore: 1001, maxScore: 1100, type: "none", label: "なし" },
  {
    minScore: 1101,
    maxScore: Number.MAX_SAFE_INTEGER,
    type: "meteor",
    label: "隕石"
  }
];

/* ============================================================
   10. テーマアセット設定
   ------------------------------------------------------------
   テーマごとの背景・足場・障害物画像パスを生成する。
   theme_00 ～ theme_04 の構成を前提としている。
   ============================================================ */
export const THEME_ASSETS = [0, 1, 2, 3, 4].map(createThemeAssets);

/**
 * 指定インデックスのテーマ画像群を生成する。
 *
 * @param {number} index テーマ番号
 * @returns {{
 *   background: string,
 *   tileStable: string,
 *   tileWarning: string,
 *   tileFalling: string,
 *   tileHighScoreMarker: string,
 *   obstacleTiles: Array<{ src: string, anchorYPercent: number }>
 * }}
 */
function createThemeAssets(index) {
  const folderName = `theme_${String(index).padStart(2, "0")}`;
  const basePath = `assets/themes/${folderName}`;

  return {
    background: `${basePath}/background.png`,
    tileStable: `${basePath}/tile.png`,
    tileWarning: `${basePath}/tile_warning.png`,
    tileFalling: `${basePath}/tile_falling.png`,
    tileHighScoreMarker: `${basePath}/tile_highscore_marker.png`,
    obstacleTiles: [
      { src: `${basePath}/tile_obstacle_01.png`, anchorYPercent: -68 },
      { src: `${basePath}/tile_obstacle_02.png`, anchorYPercent: -78 },
      { src: `${basePath}/tile_obstacle_03.png`, anchorYPercent: -68 }
    ]
  };
}

/* ============================================================
   11. 補助関数
   ------------------------------------------------------------
   スコアの正規化や、スコアに応じたテーマ・演出判定を行う。
   ============================================================ */

/**
 * スコア値を安全な数値に補正する。
 * - 数値でない場合は 0
 * - 負数の場合は 0
 *
 * @param {unknown} score
 * @returns {number}
 */
function normalizeScore(score) {
  return Math.max(0, Number(score) || 0);
}

/**
 * スコアからテーマ番号を返す。
 *
 * テーマ区分:
 * 0: 0〜100
 * 1: 101〜200
 * 2: 201〜500
 * 3: 501〜1000
 * 4: 1001〜
 *
 * @param {number} score
 * @returns {number}
 */
export function getThemeIndexByScore(score) {
  const safeScore = normalizeScore(score);
  const [theme0Max, theme1Max, theme2Max, theme3Max] =
    GAME_CONFIG.themeScoreThresholds;

  if (safeScore <= theme0Max) {
    return 0;
  }

  if (safeScore <= theme1Max) {
    return 1;
  }

  if (safeScore <= theme2Max) {
    return 2;
  }

  if (safeScore <= theme3Max) {
    return 3;
  }

  return 4;
}

/**
 * スコアに応じたステージ演出を返す。
 * 該当がない場合は「演出なし」を返す。
 *
 * @param {number} score
 * @returns {{ minScore?: number, maxScore?: number, type: string, label: string }}
 */
export function getStageEffectByScore(score) {
  const safeScore = normalizeScore(score);

  return (
    STAGE_EFFECTS.find(
      (effect) => safeScore >= effect.minScore && safeScore <= effect.maxScore
    ) ?? DEFAULT_STAGE_EFFECT
  );
}