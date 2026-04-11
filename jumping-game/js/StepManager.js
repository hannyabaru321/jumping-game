import {
  GAME_CONFIG,
  RENDER_CONFIG,
  STEP_STATE,
  THEME_ASSETS
} from "./config.js";

/*
  ============================================================
  StepManager.js
  ------------------------------------------------------------
  段データだけを管理するクラス。
  ============================================================
*/

export class StepManager {
  constructor() {
    this.gameConfig = GAME_CONFIG;
    this.renderConfig = RENDER_CONFIG;

    this.steps = [];
    this.nextStepId = 0;
  }

  initialize(startLane, currentScore = 0) {
    this.steps = [];
    this.nextStepId = 0;

    const totalStepCount =
      this.gameConfig.visibleStepCount + this.gameConfig.reserveStepCount;

    this.steps.push(this.createStep(startLane, true, currentScore));

    for (let index = 1; index < totalStepCount; index += 1) {
      this.steps.push(this.createStep(this.getRandomLane(), false, currentScore));
    }
  }

  ensureFutureSteps(currentStepIndex, currentScore = 0) {
    const requiredLastIndex =
      currentStepIndex +
      this.gameConfig.visibleStepCount +
      this.gameConfig.reserveStepCount -
      1;

    while (this.steps.length - 1 < requiredLastIndex) {
      this.steps.push(this.createStep(this.getRandomLane(), false, currentScore));
    }
  }

  createStep(lane, isStartStep = false, currentScore = 0) {
    const themeIndex = this.getThemeIndexByScore(currentScore);

    return {
      id: this.nextStepId++,
      lane,
      state: STEP_STATE.stable,
      themeIndex,
      obstacle: this.createObstacleData(isStartStep, currentScore, themeIndex)
    };
  }

  createObstacleData(isStartStep, currentScore, themeIndex) {
    if (isStartStep) {
      return null;
    }

    const spawnRate = this.getObstacleSpawnRateByScore(currentScore);
    if (Math.random() >= spawnRate) {
      return null;
    }

    const obstacleTiles = this.getThemeAsset(themeIndex).obstacleTiles;
    const obstacleImageIndex = Math.floor(Math.random() * obstacleTiles.length);
    const obstaclePositionIndex = Math.floor(
      Math.random() * this.renderConfig.obstaclePositionCandidates.length
    );

    return {
      imageIndex: obstacleImageIndex,
      positionIndex: obstaclePositionIndex
    };
  }

  getObstacleSpawnRateByScore(score) {
    const safeScore = Math.max(0, Number(score) || 0);

    if (safeScore >= this.gameConfig.obstacleSpawnRateMaxScore) {
      return 1;
    }

    const scoreBand = Math.floor(safeScore / 100);
    const rate =
      this.gameConfig.obstacleSpawnRateBase +
      scoreBand * this.gameConfig.obstacleSpawnRateIncreasePer100Score;

    return Math.min(1, rate);
  }

  getThemeIndexByScore(score) {
    const safeScore = Math.max(0, Number(score) || 0);
    const themeIndex = Math.floor(safeScore / this.renderConfig.scorePerTheme);
    return Math.min(themeIndex, THEME_ASSETS.length - 1);
  }

  getThemeAsset(themeIndex) {
    const safeIndex = Math.max(0, Math.min(themeIndex, THEME_ASSETS.length - 1));
    return THEME_ASSETS[safeIndex];
  }

  getRandomLane() {
    return Math.random() < 0.5 ? "left" : "right";
  }

  getStep(stepIndex) {
    return this.steps[stepIndex] ?? null;
  }

  getVisibleSteps(currentStepIndex, visibleStepCount) {
    const visibleSteps = [];

    for (
      let stepIndex = currentStepIndex;
      stepIndex <= currentStepIndex + visibleStepCount;
      stepIndex += 1
    ) {
      const step = this.getStep(stepIndex);
      if (!step) {
        continue;
      }

      visibleSteps.push({ stepIndex, step });
    }

    return visibleSteps;
  }

  setStepState(stepIndex, state) {
    const step = this.getStep(stepIndex);
    if (!step) {
      return;
    }

    step.state = state;
  }

  resetStepState(stepIndex) {
    const step = this.getStep(stepIndex);
    if (!step) {
      return;
    }

    step.state = STEP_STATE.stable;
  }
}
