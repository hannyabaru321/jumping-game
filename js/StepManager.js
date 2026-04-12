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
      obstacle: this.createObstacleData(isStartStep, currentScore, themeIndex),
      moveData: this.createMoveData(isStartStep, currentScore)
    };
  }

  createMoveData(isStartStep, currentScore) {
    if (isStartStep) {
      return null;
    }

    const spawnRate = this.getMovingStepSpawnRateByScore(currentScore);
    if (spawnRate <= 0) {
      return null;
    }

    if (Math.random() >= spawnRate) {
      return null;
    }

    return {
      hasTriggered: false
    };
  }

  triggerMovingStepIfNeeded(currentStepIndex, currentScore = 0) {
    const triggerDistance = this.getMovingStepTriggerDistanceByScore(currentScore);
    const triggerStepIndex = currentStepIndex + triggerDistance;
    const targetStep = this.getStep(triggerStepIndex);

    if (!targetStep?.moveData || targetStep.moveData.hasTriggered) {
      return false;
    }

    for (
      let stepIndex = triggerStepIndex;
      stepIndex < this.steps.length;
      stepIndex += 1
    ) {
      const step = this.steps[stepIndex];
      step.lane = this.reverseLane(step.lane);
    }

    targetStep.moveData.hasTriggered = true;
    return true;
  }

  getMovingStepSpawnRateByScore(score) {
    const safeScore = Math.max(0, Number(score) || 0);

    if (safeScore < this.gameConfig.movingStepEnabledScore) {
      return 0;
    }

    const scoreBand =
      Math.floor((safeScore - this.gameConfig.movingStepEnabledScore) / 100);

    const rate =
      this.gameConfig.movingStepSpawnRateBase +
      scoreBand * this.gameConfig.movingStepSpawnRateIncreasePer100Score;

    return Math.min(this.gameConfig.movingStepSpawnRateMax, rate);
  }

  getMovingStepTriggerDistanceByScore(score) {
    const safeScore = Math.max(0, Number(score) || 0);

    if (safeScore > this.gameConfig.movingStepHardModeScore) {
      return this.gameConfig.movingStepTriggerDistanceHard;
    }

    return this.gameConfig.movingStepTriggerDistanceEasy;
  }

  reverseLane(lane) {
    return lane === "left" ? "right" : "left";
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

  if (safeScore <= 100) {
    return 0; // theme_00
  }

  if (safeScore <= 200) {
    return 1; // theme_01
  }

  if (safeScore <= 500) {
    return 2; // theme_02
  }

  if (safeScore <= 1000) {
    return 3; // theme_03
  }

  return 4; // theme_04
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
