import {
  GAME_CONFIG,
  LANE,
  RENDER_CONFIG,
  STEP_STATE,
  THEME_ASSETS,
  getThemeIndexByScore
} from "./config.js";

/*
============================================================
StepManager.js
------------------------------------------------------------
床データのみを管理するクラス。

【役割】
- 床データの生成
- 先の床の補充
- 障害物データの生成
- 動く床の発動判定
- 床状態の更新

【持たないもの】
- DOM操作
- 描画
- UI制御

見た目ではなく、「床データをどう持つか」に専念する。
============================================================
*/

export class StepManager {
  constructor() {
    /**
     * 床データ配列
     * 各要素は createStep() で生成した床情報を持つ
     */
    this.steps = [];

    /**
     * 床ID採番用
     * 新しい床を作るたびにインクリメントする
     */
    this.nextStepId = 0;
  }

  /* =========================================================
     初期化 / 補充
     ========================================================= */

  /**
   * ゲーム開始時の床データを初期化する。
   *
   * @param {"left"|"right"} startLane 開始位置のレーン
   * @param {number} currentScore 現在スコア
   */
  initialize(startLane, currentScore = 0) {
    this.steps = [];
    this.nextStepId = 0;

    const totalStepCount = this.getInitialStepCount();

    /*
      最初の床だけは開始地点用として生成する。
      開始床には障害物や移動床を出さない。
    */
    this.steps.push(this.createStep(startLane, true, currentScore));

    for (let index = 1; index < totalStepCount; index += 1) {
      this.steps.push(
        this.createStep(this.getRandomLane(), false, currentScore)
      );
    }
  }

  /**
   * 現在地点より先に必要な床数を満たすよう、足りない分を補充する。
   *
   * @param {number} currentStepIndex 現在いる床のindex
   * @param {number} currentScore 現在スコア
   */
  ensureFutureSteps(currentStepIndex, currentScore = 0) {
    const requiredLastIndex = this.getRequiredLastStepIndex(currentStepIndex);

    while (this.steps.length - 1 < requiredLastIndex) {
      this.steps.push(
        this.createStep(this.getRandomLane(), false, currentScore)
      );
    }
  }

  /**
   * 初期生成時に必要な床数を返す。
   */
  getInitialStepCount() {
    return GAME_CONFIG.visibleStepCount + GAME_CONFIG.reserveStepCount;
  }

  /**
   * 現在地点から見て、最低限必要になる最後の床indexを返す。
   */
  getRequiredLastStepIndex(currentStepIndex) {
    return (
      currentStepIndex +
      GAME_CONFIG.visibleStepCount +
      GAME_CONFIG.reserveStepCount -
      1
    );
  }

  /* =========================================================
     床データ生成
     ========================================================= */

  /**
   * 床データを1件生成する。
   *
   * @param {"left"|"right"} lane 床のレーン
   * @param {boolean} isStartStep 開始床かどうか
   * @param {number} currentScore 現在スコア
   * @returns {object} 床データ
   */
  createStep(lane, isStartStep = false, currentScore = 0) {
    const themeIndex = getThemeIndexByScore(currentScore);

    return {
      id: this.nextStepId++,
      lane,
      state: STEP_STATE.stable,
      themeIndex,
      obstacle: this.createObstacleData(isStartStep, currentScore, themeIndex),
      moveData: this.createMoveData(isStartStep, currentScore)
    };
  }

  /**
   * 移動床用の追加データを生成する。
   * 開始床には移動床情報を持たせない。
   *
   * @returns {{hasTriggered:boolean}|null}
   */
  createMoveData(isStartStep, currentScore) {
    if (isStartStep) {
      return null;
    }

    const spawnRate = this.getMovingStepSpawnRateByScore(currentScore);

    if (spawnRate <= 0 || Math.random() >= spawnRate) {
      return null;
    }

    return {
      hasTriggered: false
    };
  }

  /**
   * 障害物データを生成する。
   * 開始床には障害物を出さない。
   *
   * @returns {{imageIndex:number, positionIndex:number}|null}
   */
  createObstacleData(isStartStep, currentScore, themeIndex) {
    if (isStartStep) {
      return null;
    }

    const spawnRate = this.getObstacleSpawnRateByScore(currentScore);

    if (Math.random() >= spawnRate) {
      return null;
    }

    const obstacleTiles = this.getThemeAsset(themeIndex).obstacleTiles;

    return {
      imageIndex: Math.floor(Math.random() * obstacleTiles.length),
      positionIndex: Math.floor(
        Math.random() * RENDER_CONFIG.obstaclePositionCandidates.length
      )
    };
  }

  /* =========================================================
     移動床制御
     ========================================================= */

  /**
   * 条件を満たした場合、対象床以降のレーンを左右反転する。
   *
   * 【動き】
   * - 現在地点から一定距離先の床を対象にする
   * - その床が moveData を持っていて、まだ未発動なら発動する
   * - 対象床以降の lane をすべて左右反転する
   *
   * @returns {boolean} 発動したら true
   */
  triggerMovingStepIfNeeded(currentStepIndex, currentScore = 0) {
    const triggerDistance =
      this.getMovingStepTriggerDistanceByScore(currentScore);
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
      this.steps[stepIndex].lane = this.reverseLane(this.steps[stepIndex].lane);
    }

    targetStep.moveData.hasTriggered = true;
    return true;
  }

  /**
   * スコアに応じた移動床出現率を返す。
   */
  getMovingStepSpawnRateByScore(score) {
    const safeScore = this.toSafeScore(score);

    if (safeScore < GAME_CONFIG.movingStepEnabledScore) {
      return 0;
    }

    const scoreBand = Math.floor(
      (safeScore - GAME_CONFIG.movingStepEnabledScore) / 100
    );

    const rate =
      GAME_CONFIG.movingStepSpawnRateBase +
      scoreBand * GAME_CONFIG.movingStepSpawnRateIncreasePer100Score;

    return Math.min(GAME_CONFIG.movingStepSpawnRateMax, rate);
  }

  /**
   * スコアに応じた移動床発動距離を返す。
   */
  getMovingStepTriggerDistanceByScore(score) {
    const safeScore = this.toSafeScore(score);

    return safeScore > GAME_CONFIG.movingStepHardModeScore
      ? GAME_CONFIG.movingStepTriggerDistanceHard
      : GAME_CONFIG.movingStepTriggerDistanceEasy;
  }

  /* =========================================================
     障害物出現率
     ========================================================= */

  /**
   * スコアに応じた障害物出現率を返す。
   */
  getObstacleSpawnRateByScore(score) {
    const safeScore = this.toSafeScore(score);

    if (safeScore >= GAME_CONFIG.obstacleSpawnRateMaxScore) {
      return 1;
    }

    const scoreBand = Math.floor(safeScore / 100);
    const rate =
      GAME_CONFIG.obstacleSpawnRateBase +
      scoreBand * GAME_CONFIG.obstacleSpawnRateIncreasePer100Score;

    return Math.min(1, rate);
  }

  /* =========================================================
     レーン / テーマ補助
     ========================================================= */

  /**
   * left / right を反転する。
   */
  reverseLane(lane) {
    return lane === LANE.left ? LANE.right : LANE.left;
  }

  /**
   * ランダムにレーンを返す。
   */
  getRandomLane() {
    return Math.random() < 0.5 ? LANE.left : LANE.right;
  }

  /**
   * スコアを安全な数値へ補正する。
   */
  toSafeScore(score) {
    return Math.max(0, Number(score) || 0);
  }

  /**
   * テーマ番号から安全にテーマ情報を取得する。
   */
  getThemeAsset(themeIndex) {
    const safeIndex = Math.max(
      0,
      Math.min(themeIndex, THEME_ASSETS.length - 1)
    );

    return THEME_ASSETS[safeIndex];
  }

  /* =========================================================
     参照
     ========================================================= */

  /**
   * 指定indexの床を返す。
   * 存在しない場合は null を返す。
   */
  getStep(stepIndex) {
    return this.steps[stepIndex] ?? null;
  }

  /**
   * 現在地点から見えている範囲の床一覧を返す。
   *
   * @returns {Array<{stepIndex:number, step:object}>}
   */
  getVisibleSteps(currentStepIndex, visibleStepCount) {
    const items = [];

    for (
      let stepIndex = currentStepIndex;
      stepIndex <= currentStepIndex + visibleStepCount;
      stepIndex += 1
    ) {
      const step = this.getStep(stepIndex);

      if (!step) {
        continue;
      }

      items.push({ stepIndex, step });
    }

    return items;
  }

  /* =========================================================
     状態変更
     ========================================================= */

  /**
   * 指定床の状態を更新する。
   */
  setStepState(stepIndex, state) {
    const step = this.getStep(stepIndex);

    if (step) {
      step.state = state;
    }
  }

  /**
   * 指定床の状態を stable に戻す。
   */
  resetStepState(stepIndex) {
    this.setStepState(stepIndex, STEP_STATE.stable);
  }
}