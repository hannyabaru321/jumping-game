import {
  CHARACTER_LIST,
  DEFAULT_CHARACTER_ID,
  GAME_CONFIG,
  GAME_STATUS,
  STORAGE_KEYS,
  STEP_STATE
} from "./config.js";
import { StepManager } from "./StepManager.js";
import { GameRenderer } from "./GameRenderer.js";

/*
============================================================
Game.js
------------------------------------------------------------
ゲーム全体の制御クラス

【役割】
・入力受付
・スコア管理
・床崩落管理
・描画クラスへの指示
============================================================
*/

export class Game {
  constructor(dom) {
    this.dom = dom;

    // ===== 管理クラス =====
    this.stepManager = new StepManager();
    this.renderer = new GameRenderer(dom);

    // ===== 状態 =====
    this.status = GAME_STATUS.ready;
    this.currentStepIndex = 0;
    this.currentLane = GAME_CONFIG.playerStartLane;

    // ===== スコア =====
    this.score = 0;
    this.highScore = this.loadHighScore();

    // ===== 崩落制御 =====
    this.collapseDeadline = 0;
    this.collapseTimerId = null;
    this.collapseStateIntervalId = null;

    // ===== フラグ =====
    this.hasLeftStartPosition = false;
  }

  /*
  ============================================================
  初期化
  ============================================================
  */
  initialize() {
    this.bindEvents();
    this.refreshHud();

    // 初期背景
    this.renderer.initializeBackground(0);
  }

  /*
  ============================================================
  イベント登録
  ============================================================
  */
  bindEvents() {
    // ボタン操作
    this.dom.startButton.addEventListener("click", () => this.startGame());
    this.dom.leftButton.addEventListener("click", () => this.handleMove("left"));
    this.dom.rightButton.addEventListener("click", () => this.handleMove("right"));

    // キーボード操作
    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") return this.handleMove("left");
      if (event.key === "ArrowRight") return this.handleMove("right");

      // Enter / Spaceでゲーム開始
      if ((event.key === "Enter" || event.key === " ") &&
          this.status !== GAME_STATUS.playing) {
        this.startGame();
      }
    });

    // 画面タップ（左右判定）
    this.dom.gameBoard.addEventListener("pointerdown", (event) => {
      if (this.status !== GAME_STATUS.playing) return;

      const rect = this.dom.gameBoard.getBoundingClientRect();
      const isLeft = event.clientX < rect.left + rect.width / 2;

      this.handleMove(isLeft ? "left" : "right");
    });
  }

  /*
  ============================================================
  ゲーム開始
  ============================================================
  */
  startGame() {
    this.stopAllTimers();

    // 状態初期化
    this.status = GAME_STATUS.playing;
    this.currentStepIndex = 0;
    this.currentLane = GAME_CONFIG.playerStartLane;
    this.score = 0;
    this.collapseDeadline = 0;
    this.hasLeftStartPosition = false;

    // ステップ初期化
    this.stepManager.initialize(this.currentLane, this.score);

    // キャラ取得
    const selectedCharacter = this.getSelectedCharacter();

    // 描画初期化
    this.renderer.clearPlayfield();
    this.renderer.initializeBackground(0);
    this.renderer.createPlayer(selectedCharacter.src);
    this.renderer.setPlayerDirection(this.currentLane);

    this.render();

    this.renderer.hideOverlay();
    this.refreshHud();
  }

  /*
  ============================================================
  キャラクター取得
  ============================================================
  */
  getSelectedCharacter() {
    const id = localStorage.getItem(STORAGE_KEYS.characterId) ?? DEFAULT_CHARACTER_ID;

    return (
      CHARACTER_LIST.find(c => c.id === id) ||
      CHARACTER_LIST[0]
    );
  }

  /*
  ============================================================
  移動処理
  ============================================================
  */
  handleMove(targetLane) {
    if (this.status !== GAME_STATUS.playing) return;

    const nextIndex = this.currentStepIndex + 1;
    const nextStep = this.stepManager.getStep(nextIndex);

    if (!nextStep) return;

    // ミス判定
    if (nextStep.lane !== targetLane) {
      return this.endGame("間違った方へ進んでしまいました。");
    }

    // ===== 状態更新 =====
    this.currentStepIndex = nextIndex;
    this.currentLane = targetLane;
    this.score++;
    this.hasLeftStartPosition = true;

    // ===== ステップ管理 =====
    this.stepManager.ensureFutureSteps(this.currentStepIndex, this.score);
    this.stepManager.triggerMovingStepIfNeeded(this.currentStepIndex, this.score);

    // ===== 描画更新 =====
    this.renderer.setPlayerDirection(targetLane);
    this.renderer.playPlayerHop(targetLane);
    this.renderer.updateBackgroundThemeByScore(this.score);

    this.render();

    this.renderer.updateScore(this.score);
    this.renderer.setHighScoreHighlight(this.score > this.highScore);

    // 崩落開始
    this.startCollapseCountdown();
    this.startCollapseStateWatcher();
  }

  /*
  ============================================================
  共通描画処理
  ============================================================
  */
  render() {
    this.renderer.renderScene(
      this.stepManager,
      this.currentStepIndex,
      GAME_CONFIG.visibleStepCount,
      this.highScore
    );
  }

  /*
  ============================================================
  崩落カウントダウン開始
  ============================================================
  */
  startCollapseCountdown() {
    if (this.status !== GAME_STATUS.playing || !this.hasLeftStartPosition) return;

    // 既存タイマー停止
    if (this.collapseTimerId) {
      clearTimeout(this.collapseTimerId);
    }

    this.stepManager.resetStepState(this.currentStepIndex);

    const delay = this.getCollapseDelayMs();
    this.collapseDeadline = performance.now() + delay;

    this.collapseTimerId = setTimeout(() => {
      this.collapseCurrentStep(delay);
    }, delay);
  }

  /*
  ============================================================
  崩落状態監視（警告演出）
  ============================================================
  */
  startCollapseStateWatcher() {
    if (this.collapseStateIntervalId) {
      clearInterval(this.collapseStateIntervalId);
    }

    this.collapseStateIntervalId = setInterval(() => {
      if (this.status !== GAME_STATUS.playing || !this.hasLeftStartPosition) return;

      const step = this.stepManager.getStep(this.currentStepIndex);
      if (!step) return;

      const remaining = Math.max(0, this.collapseDeadline - performance.now());

      const nextState =
        remaining <= GAME_CONFIG.warningTimeMs
          ? STEP_STATE.collapsing
          : STEP_STATE.stable;

      if (step.state === nextState) return;

      step.state = nextState;
      this.render();

    }, 50);
  }

  /*
  ============================================================
  崩落実行
  ============================================================
  */
  collapseCurrentStep(delay) {
    if (this.status !== GAME_STATUS.playing) return;

    this.stepManager.setStepState(this.currentStepIndex, STEP_STATE.falling);

    this.render();

    this.endGame(
      `今いる床が崩れました。${(delay / 1000).toFixed(1)}秒以内に次の床へ進んでください。`
    );
  }

  /*
  ============================================================
  ゲーム終了
  ============================================================
  */
  endGame(reason) {
    if (this.status !== GAME_STATUS.playing) return;

    this.status = GAME_STATUS.gameOver;

    this.stopAllTimers();
    this.updateHighScoreIfNeeded();

    this.renderer.setPlayerFalling();
    this.renderer.showGameOverOverlay(
      this.score,
      reason,
      () => this.startGame()
    );
  }

  /*
  ============================================================
  崩落時間計算（スコア依存）
  ============================================================
  */
  getCollapseDelayMs() {
    const score = Math.max(0, Number(this.score) || 0);

    const band = Math.floor(score / 100);
    const reduction = band * GAME_CONFIG.collapseDelayReductionPer100ScoreMs;

    return Math.max(
      GAME_CONFIG.collapseDelayMinMs,
      GAME_CONFIG.collapseDelayMs - reduction
    );
  }

  /*
  ============================================================
  タイマー停止
  ============================================================
  */
  stopAllTimers() {
    if (this.collapseTimerId) {
      clearTimeout(this.collapseTimerId);
      this.collapseTimerId = null;
    }

    if (this.collapseStateIntervalId) {
      clearInterval(this.collapseStateIntervalId);
      this.collapseStateIntervalId = null;
    }
  }

  /*
  ============================================================
  ハイスコア更新
  ============================================================
  */
  updateHighScoreIfNeeded() {
    if (this.score <= this.highScore) {
      this.renderer.setHighScoreHighlight(false);
      return;
    }

    this.highScore = this.score;

    localStorage.setItem(
      STORAGE_KEYS.highScore,
      String(this.highScore)
    );

    this.renderer.updateHighScore(this.highScore);
    this.renderer.setHighScoreHighlight(false);
  }

  /*
  ============================================================
  ハイスコア取得
  ============================================================
  */
  loadHighScore() {
    const value = Number(localStorage.getItem(STORAGE_KEYS.highScore));

    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  /*
  ============================================================
  HUD更新
  ============================================================
  */
  refreshHud() {
    this.renderer.updateScore(this.score);
    this.renderer.updateHighScore(this.highScore);
    this.renderer.setHighScoreHighlight(false);
  }

  getScore() {
    return this.score;
  }
}