/*
  ============================================================
  config.js
  ------------------------------------------------------------
  ゲーム全体の設定値をまとめるファイル。
  ============================================================
*/

export const GAME_CONFIG = {
  visibleStepCount: 8,
  reserveStepCount: 12,

  collapseDelayMs: 1000,
  collapseDelayReductionPer100ScoreMs: 100,
  collapseDelayMinMs: 500,

  warningTimeMs: 300,
  playerStartLane: "left",
  localStorageHighScoreKey: "jumping-game-high-score",

  /*
    障害床の出現率
    - 0点時: 30%
    - 100点ごとに上昇
    - 1000点以上: 100%
  */
  obstacleSpawnRateBase: 0.30,
  obstacleSpawnRateIncreasePer100Score: 0.07,
  obstacleSpawnRateMaxScore: 1000,

  /*
    移動床
    - 200点以上で出現開始
    - 200〜299: 10%
    - 300〜399: 20%
    - 400〜499: 30%
    - 500〜599: 40%
    - 600以上: 50%
    - 500点までは3段手前
    - 500点超で2段手前
  */
  movingStepEnabledScore: 200,
  movingStepSpawnRateBase: 0.10,
  movingStepSpawnRateIncreasePer100Score: 0.10,
  movingStepSpawnRateMax: 0.50,
  movingStepTriggerDistanceEasy: 3,
  movingStepTriggerDistanceHard: 2,
  movingStepHardModeScore: 500
};

export const PLAYER_STORAGE_KEYS = {
  name: "jumping-game-player-name",
  characterId: "jumping-game-character-id",
  playerId: "jumping-game-player-id"
};

export const CHARACTER_LIST = [
  { id: "bear_01", name: "くま1", src: "assets/chara/bear_01.png" },
  { id: "bear_02", name: "くま2", src: "assets/chara/bear_02.png" },
  { id: "bear_03", name: "くま3", src: "assets/chara/bear_03.png" },
  { id: "bear_04", name: "くま4", src: "assets/chara/bear_04.png" },
  { id: "bear_05", name: "くま5", src: "assets/chara/bear_05.png" },
  { id: "bear_06", name: "くま6", src: "assets/chara/bear_06.png" }
];

export const DEFAULT_CHARACTER_ID = "bear_01";

export const RENDER_CONFIG = {
  desktop: {
    baseX: 280,
    baseY: 685,
    stepOffsetX: 45,
    stepOffsetY: 50
  },

  mobile: {
    baseX: 180,
    baseY: 600,
    stepOffsetX: 40,
    stepOffsetY: 44
  },

  collapseStateRefreshMs: 50,
  tileMoveDurationMs: 220,
  tileDropDurationMs: 400,
  backgroundFadeDurationMs: 900,

  obstaclePositionCandidates: [
    { x: -1.0, y: 1.0 },
    { x: 1.0, y: 1.0 },
    { x: -3.0, y: 1.0 },
    { x: 3.0, y: 1.0 }
  ]
};

export const PLAYER_ANIMATION_CONFIG = {
  hopDurationMs: 220,
  hopHeightPx: 20,
  hopShiftPx: 6
};

/*
  テーマ画像設定
  0〜100    点は theme_00
  101〜200  点は theme_01
  201〜500  点は theme_02
  501〜1000 点は theme_03
  1001点〜  は theme_04
*/
export const THEME_ASSETS = [
  createThemeAssets(0),
  createThemeAssets(1),
  createThemeAssets(2),
  createThemeAssets(3),
  createThemeAssets(4)
];

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

export const GAME_STATUS = {
  ready: "ready",
  playing: "playing",
  gameOver: "gameOver"
};

export const STEP_STATE = {
  stable: "stable",
  collapsing: "collapsing",
  falling: "falling"
};