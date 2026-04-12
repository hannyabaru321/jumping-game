import {
  CHARACTER_LIST,
  DEFAULT_CHARACTER_ID,
  GAME_CONFIG,
  GAME_STATUS,
  PLAYER_STORAGE_KEYS,
  RENDER_CONFIG,
  STEP_STATE
} from "./config.js";
import { StepManager } from "./StepManager.js";
import { GameRenderer } from "./GameRenderer.js";

/*
  ============================================================
  Game.js
  ------------------------------------------------------------
  ゲーム全体の進行管理クラス。
  ============================================================
*/

export class Game {
  constructor(dom) {
    this.dom = dom;
    this.gameConfig = GAME_CONFIG;
    this.renderConfig = RENDER_CONFIG;

    this.status = GAME_STATUS.ready;
    this.currentStepIndex = 0;
    this.currentLane = this.gameConfig.playerStartLane;

    this.score = 0;
    this.highScore = this.loadHighScore();

    this.collapseDeadline = 0;
    this.collapseTimerId = null;
    this.collapseStateIntervalId = null;
    this.hasLeftStartPosition = false;

    this.stepManager = new StepManager();
    this.renderer = new GameRenderer(dom);
  }

  initialize() {
    this.bindEvents();
    this.renderer.updateScore(this.score);
    this.renderer.updateHighScore(this.highScore);
    this.renderer.setHighScoreHighlight(false);
    this.renderer.initializeBackground(0);
  }

  bindEvents() {
    this.dom.startButton.addEventListener("click", () => this.startGame());
    this.dom.leftButton.addEventListener("click", () => this.handleMove("left"));
    this.dom.rightButton.addEventListener("click", () => this.handleMove("right"));

    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        this.handleMove("left");
      } else if (event.key === "ArrowRight") {
        this.handleMove("right");
      } else if (event.key === "Enter" || event.key === " ") {
        if (this.status !== GAME_STATUS.playing) {
          this.startGame();
        }
      }
    });

    this.dom.gameBoard.addEventListener("pointerdown", (event) => {
      if (this.status !== GAME_STATUS.playing) {
        return;
      }

      const rect = this.dom.gameBoard.getBoundingClientRect();
      const isLeft = event.clientX < rect.left + rect.width / 2;
      this.handleMove(isLeft ? "left" : "right");
    });
  }

  startGame() {
    this.stopAllTimers();

    this.status = GAME_STATUS.playing;
    this.currentStepIndex = 0;
    this.currentLane = this.gameConfig.playerStartLane;
    this.score = 0;
    this.collapseDeadline = 0;
    this.hasLeftStartPosition = false;

    this.stepManager.initialize(this.currentLane, this.score);

    const selectedCharacterId =
      localStorage.getItem(PLAYER_STORAGE_KEYS.characterId) ??
      DEFAULT_CHARACTER_ID;

    const selectedCharacter =
      CHARACTER_LIST.find((item) => item.id === selectedCharacterId) ??
      CHARACTER_LIST[0];

    this.renderer.clearPlayfield();
    this.renderer.initializeBackground(0);
    this.renderer.createPlayer(selectedCharacter.src);
    this.renderer.setPlayerDirection(this.currentLane);
    this.renderer.updateScore(this.score);
    this.renderer.updateHighScore(this.highScore);
    this.renderer.setHighScoreHighlight(false);
    this.renderer.renderScene(
      this.stepManager,
      this.currentStepIndex,
      this.gameConfig.visibleStepCount,
      this.highScore
    );
    this.renderer.hideOverlay();
  }

  handleMove(targetLane) {
    if (this.status !== GAME_STATUS.playing) {
      return;
    }

    const nextStepIndex = this.currentStepIndex + 1;
    const nextStep = this.stepManager.getStep(nextStepIndex);

    if (!nextStep) {
      return;
    }

    if (nextStep.lane !== targetLane) {
      this.endGame("間違った方へ進んでしまいました。");
      return;
    }

    this.currentStepIndex = nextStepIndex;
    this.currentLane = targetLane;
    this.score += 1;
    this.hasLeftStartPosition = true;

    this.stepManager.ensureFutureSteps(this.currentStepIndex, this.score);
    this.stepManager.triggerMovingStepIfNeeded(this.currentStepIndex, this.score);

    this.renderer.setPlayerDirection(targetLane);
    this.renderer.playPlayerHop(targetLane);
    this.renderer.updateScore(this.score);
    this.renderer.setHighScoreHighlight(this.score > this.highScore);
    this.renderer.updateBackgroundThemeByScore(this.score);
    this.renderer.renderScene(
      this.stepManager,
      this.currentStepIndex,
      this.gameConfig.visibleStepCount,
      this.highScore
    );

    this.startCollapseCountdown();
    this.startCollapseStateWatcher();
  }

  startCollapseCountdown() {
    if (this.status !== GAME_STATUS.playing || !this.hasLeftStartPosition) {
      return;
    }

    if (this.collapseTimerId !== null) {
      clearTimeout(this.collapseTimerId);
    }

    this.stepManager.resetStepState(this.currentStepIndex);

    const collapseDelayMs = this.getCollapseDelayMs();
    this.collapseDeadline = performance.now() + collapseDelayMs;

    this.collapseTimerId = window.setTimeout(() => {
      this.collapseCurrentStep(collapseDelayMs);
    }, collapseDelayMs);
  }

  startCollapseStateWatcher() {
    if (this.collapseStateIntervalId !== null) {
      clearInterval(this.collapseStateIntervalId);
    }

    this.collapseStateIntervalId = window.setInterval(() => {
      if (this.status !== GAME_STATUS.playing || !this.hasLeftStartPosition) {
        return;
      }

      const remainingMs = Math.max(0, this.collapseDeadline - performance.now());
      const currentStep = this.stepManager.getStep(this.currentStepIndex);

      if (!currentStep) {
        return;
      }

      const nextState =
        remainingMs <= this.gameConfig.warningTimeMs
          ? STEP_STATE.collapsing
          : STEP_STATE.stable;

      if (currentStep.state !== nextState) {
        currentStep.state = nextState;
        this.renderer.renderScene(
          this.stepManager,
          this.currentStepIndex,
          this.gameConfig.visibleStepCount,
          this.highScore
        );
      }
    }, this.renderConfig.collapseStateRefreshMs);
  }

  collapseCurrentStep(collapseDelayMs) {
    if (this.status !== GAME_STATUS.playing) {
      return;
    }

    this.stepManager.setStepState(this.currentStepIndex, STEP_STATE.falling);
    this.renderer.renderScene(
      this.stepManager,
      this.currentStepIndex,
      this.gameConfig.visibleStepCount,
      this.highScore
    );
    this.endGame(
      `今いる床が崩れました。${(collapseDelayMs / 1000).toFixed(1)}秒以内に次の床へ進んでください。`
    );
  }

  getCollapseDelayMs() {
    const safeScore = Math.max(0, Number(this.score) || 0);
    const scoreBand = Math.floor(safeScore / 100);
    const reduction =
      scoreBand * this.gameConfig.collapseDelayReductionPer100ScoreMs;

    return Math.max(
      this.gameConfig.collapseDelayMinMs,
      this.gameConfig.collapseDelayMs - reduction
    );
  }

  endGame(reasonText) {
    if (this.status !== GAME_STATUS.playing) {
      return;
    }

    this.status = GAME_STATUS.gameOver;
    this.stopAllTimers();
    this.updateHighScoreIfNeeded();

    this.renderer.setPlayerFalling();
    this.renderer.showGameOverOverlay(
      this.score,
      reasonText,
      () => this.startGame()
    );
  }

  stopAllTimers() {
    if (this.collapseTimerId !== null) {
      clearTimeout(this.collapseTimerId);
      this.collapseTimerId = null;
    }

    if (this.collapseStateIntervalId !== null) {
      clearInterval(this.collapseStateIntervalId);
      this.collapseStateIntervalId = null;
    }
  }

  updateHighScoreIfNeeded() {
    if (this.score <= this.highScore) {
      this.renderer.setHighScoreHighlight(false);
      return;
    }

    this.highScore = this.score;
    localStorage.setItem(
      this.gameConfig.localStorageHighScoreKey,
      String(this.highScore)
    );

    this.renderer.updateHighScore(this.highScore);
    this.renderer.setHighScoreHighlight(false);
  }

  loadHighScore() {
    const savedValue = localStorage.getItem(
      this.gameConfig.localStorageHighScoreKey
    );

    const parsedValue = Number(savedValue);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
  }
}