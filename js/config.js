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
  obstacleSpawnRateMaxScore: 1000
};

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
  ],

  scorePerTheme: 100
};

export const PLAYER_ANIMATION_CONFIG = {
  hopDurationMs: 220,
  hopHeightPx: 20,
  hopShiftPx: 6
};

export const ASSET_PATHS = {
  player: "assets/player.png"
};

/*
  テーマ画像設定
  0〜99 点は theme_00
  100〜199 点は theme_01
  ...
  1000 点以上は最後の theme_10 を使う
*/
export const THEME_ASSETS = [
  createThemeAssets(0),
  createThemeAssets(1),
  createThemeAssets(2),
  createThemeAssets(3),
  createThemeAssets(4),
  createThemeAssets(5),
  createThemeAssets(6),
  createThemeAssets(7),
  createThemeAssets(8),
  createThemeAssets(9),
  createThemeAssets(10)
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
