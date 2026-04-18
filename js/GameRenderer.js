import {
  RENDER_CONFIG,
  STEP_STATE,
  THEME_ASSETS,
  getThemeIndexByScore,
  getStageEffectByScore,
  DEBUG_CONFIG
} from "./config.js";

/*
============================================================
GameRenderer.js
------------------------------------------------------------
描画専用クラス。

【役割】
- DOM 操作
- 背景の切り替え
- ステージ演出の生成 / 切り替え
- 床 / 障害物 / プレイヤーの見た目更新
- HUD / オーバーレイ表示

【補足】
ゲーム進行そのものは持たず、
「今の状態をどう見せるか」に専念するクラス。
============================================================
*/

export class GameRenderer {
  constructor(dom) {
    this.dom = dom;

    /* -------------------------------------------------------
       描画中の要素管理
       ------------------------------------------------------- */
    this.tileElementsByStepId = new Map();
    this.obstacleElementsByKey = new Map();
    this.playerElement = null;

    /* -------------------------------------------------------
       背景・演出の現在状態
       ------------------------------------------------------- */
    this.currentBackgroundThemeIndex = -1;
    this.activeBackgroundLayerKey = "A";
    this.currentEffectType = "";

    /* -------------------------------------------------------
       デバッグ用プレビュー機能
       -------------------------------------------------------
       enablePreview = false の場合はUIも無効化する。
       previewScoreOverride に数値が入っている間は、
       実スコアではなくその値を見た目用スコアとして使う。
       ------------------------------------------------------- */
    this.previewEnabled = DEBUG_CONFIG.enablePreview;
    this.previewScoreOverride = null;

    this.previewDom = {
      panel: document.getElementById("previewPanel"),
      range: document.getElementById("previewScoreRange"),
      input: document.getElementById("previewScoreInput"),
      applyButton: document.getElementById("previewApplyButton"),
      clearButton: document.getElementById("previewClearButton"),
      actualScore: document.getElementById("previewActualScore"),
      visualScore: document.getElementById("previewVisualScore"),
      effectName: document.getElementById("previewEffectName")
    };

    this.initializePreviewUi();
  }

  /* =========================================================
     プレビューUI
     ========================================================= */

  /**
   * プレビューUIを初期化する。
   * プレビュー無効時はパネルを隠し、イベント登録もしない。
   */
  initializePreviewUi() {
    if (!this.previewEnabled) {
      this.hidePreviewPanel();
      return;
    }

    this.bindPreviewEvents();
  }

  /**
   * プレビューパネルを非表示にする。
   */
  hidePreviewPanel() {
    if (this.previewDom.panel) {
      this.previewDom.panel.style.display = "none";
    }
  }

  /**
   * プレビューUIのイベントを登録する。
   * - range と input を同期
   * - 適用時は previewScoreOverride を更新
   * - 解除時は上書きをやめる
   */
  bindPreviewEvents() {
    const { range, input, applyButton, clearButton } = this.previewDom;

    if (!range || !input || !applyButton || !clearButton) {
      return;
    }

    range.addEventListener("input", () => {
      input.value = range.value;
    });

    input.addEventListener("input", () => {
      const safeValue = this.normalizePreviewScore(input.value);
      input.value = String(safeValue);
      range.value = String(safeValue);
    });

    applyButton.addEventListener("click", () => {
      const score = this.normalizePreviewScore(input.value);

      this.previewScoreOverride = score;
      input.value = String(score);
      range.value = String(score);

      this.refreshVisualPreview(0);
    });

    clearButton.addEventListener("click", () => {
      this.previewScoreOverride = null;
      input.value = "0";
      range.value = "0";

      this.refreshVisualPreview(0);
    });
  }

  /**
   * プレビュー用スコアを安全な整数範囲に補正する。
   *
   * ※ 0 ～ 1400 は config.js に移してもよい候補。
   */
  normalizePreviewScore(value) {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? parsed : 0;

    return Math.max(0, Math.min(1400, Math.round(safeValue)));
  }

  /**
   * 表示用に使うスコアを返す。
   * プレビューが有効かつ上書き値がある場合はそちらを優先する。
   */
  getEffectiveVisualScore(actualScore) {
    if (!this.previewEnabled) {
      return actualScore;
    }

    return this.previewScoreOverride ?? actualScore;
  }

  /* =========================================================
     座標計算
     ========================================================= */

  /**
   * 画面サイズから描画基準値を計算する。
   * 床や障害物の座標計算の基準になる。
   */
  getRenderMetrics() {
    const boardRect = this.dom.gameBoard.getBoundingClientRect();

    return {
      baseX: boardRect.width * 0.5,
      baseY: boardRect.height * RENDER_CONFIG.boardBaseYRatio,
      stepOffsetX: boardRect.width * RENDER_CONFIG.stepOffsetXRatio,
      stepOffsetY: boardRect.height * RENDER_CONFIG.stepOffsetYRatio
    };
  }

  /**
   * 床の表示座標を計算する。
   *
   * @param {number} relativeIndex 現在地点から見た相対段数
   * @param {number} cumulativeOffsetX 左右累積オフセット
   * @returns {{x:number, y:number}}
   */
  calculateTilePosition(relativeIndex, cumulativeOffsetX) {
    const metrics = this.getRenderMetrics();

    return {
      x: metrics.baseX + cumulativeOffsetX * metrics.stepOffsetX,
      y: metrics.baseY - relativeIndex * metrics.stepOffsetY
    };
  }

  /**
   * 障害物の表示座標を計算する。
   *
   * candidate.x / candidate.y は
   * 床基準の相対配置オフセットを表す。
   */
  calculateObstaclePosition(relativeIndex, cumulativeOffsetX, candidate) {
    const metrics = this.getRenderMetrics();

    return {
      x: metrics.baseX + (cumulativeOffsetX + candidate.x) * metrics.stepOffsetX,
      y: metrics.baseY - (relativeIndex + candidate.y) * metrics.stepOffsetY
    };
  }

  /**
   * グリッド占有判定用のキーを作る。
   * 浮動小数のズレを抑えるため、小数3桁に丸めている。
   */
  createGridKey(gridX, gridY) {
    return `${Number(gridX).toFixed(3)}:${Number(gridY).toFixed(3)}`;
  }

  /* =========================================================
     背景・演出
     ========================================================= */

  /**
   * 背景を初期状態にする。
   */
  initializeBackground(initialScore = 0) {
    this.currentBackgroundThemeIndex = -1;
    this.refreshVisualPreview(initialScore);
  }

  /**
   * 見た目全体を更新する。
   * 背景 / 演出 / プレビュー情報をまとめて更新する。
   */
  refreshVisualPreview(actualScore = 0) {
    const visualScore = this.getEffectiveVisualScore(actualScore);

    this.updateBackgroundByVisualScore(visualScore);
    this.updateStageEffectByScore(visualScore);
    this.updatePreviewInfo(actualScore, visualScore);
  }

  /**
   * スコア変化時に、背景・演出・プレビュー表示を更新する。
   */
  updateBackgroundThemeByScore(score) {
    const visualScore = this.getEffectiveVisualScore(score);

    this.updateBackgroundByVisualScore(visualScore);
    this.updateStageEffectByScore(visualScore);
    this.updatePreviewInfo(score, visualScore);
  }

  /**
   * 表示用スコアに応じて背景テーマを切り替える。
   * 背景レイヤーA/Bを交互に使い、切り替えを自然にする。
   */
  updateBackgroundByVisualScore(score) {
    const nextThemeIndex = getThemeIndexByScore(score);

    if (nextThemeIndex === this.currentBackgroundThemeIndex) {
      return;
    }

    const nextLayer = this.getInactiveBackgroundLayer();
    const prevLayer = this.getActiveBackgroundLayer();
    const nextThemeAsset = this.getThemeAsset(nextThemeIndex);

    nextLayer.style.backgroundImage = `url("${nextThemeAsset.background}")`;
    nextLayer.classList.add("visible");
    prevLayer.classList.remove("visible");

    this.toggleActiveBackgroundLayerKey();
    this.currentBackgroundThemeIndex = nextThemeIndex;
  }

  /**
   * 現在表示中の背景レイヤーを返す。
   */
  getActiveBackgroundLayer() {
    return this.activeBackgroundLayerKey === "A"
      ? this.dom.backgroundLayerA
      : this.dom.backgroundLayerB;
  }

  /**
   * 現在非表示側の背景レイヤーを返す。
   */
  getInactiveBackgroundLayer() {
    return this.activeBackgroundLayerKey === "A"
      ? this.dom.backgroundLayerB
      : this.dom.backgroundLayerA;
  }

  /**
   * 背景レイヤーのアクティブキーを切り替える。
   */
  toggleActiveBackgroundLayerKey() {
    this.activeBackgroundLayerKey =
      this.activeBackgroundLayerKey === "A" ? "B" : "A";
  }

  /**
   * プレビュー欄の表示内容を更新する。
   */
  updatePreviewInfo(actualScore, visualScore) {
    if (this.previewDom.actualScore) {
      this.previewDom.actualScore.textContent = String(actualScore);
    }

    if (this.previewDom.visualScore) {
      this.previewDom.visualScore.textContent = String(visualScore);
    }

    if (this.previewDom.effectName) {
      this.previewDom.effectName.textContent =
        getStageEffectByScore(visualScore).label;
    }
  }

  /**
   * 演出レイヤーを初期化する。
   * 中身を空にし、effectクラスも初期状態へ戻す。
   */
  clearEffectLayer() {
    if (!this.dom.effectLayer) {
      return;
    }

    this.dom.effectLayer.innerHTML = "";
    this.dom.effectLayer.className = "effect-layer";
    this.currentEffectType = "";
  }

  /**
   * スコアに応じて演出レイヤーを更新する。
   * 現在の演出タイプと同じなら再生成しない。
   */
  updateStageEffectByScore(score) {
    if (!this.dom.effectLayer) {
      return;
    }

    const effect = getStageEffectByScore(score);

    if (effect.type === this.currentEffectType) {
      return;
    }

    this.clearEffectLayer();
    this.currentEffectType = effect.type;

    if (effect.type === "none") {
      return;
    }

    this.dom.effectLayer.classList.add(`effect-${effect.type}`);
    this.createEffectByType(effect.type);
  }

  /**
   * 演出タイプごとに生成処理を振り分ける。
   */
  createEffectByType(effectType) {
    switch (effectType) {
      case "leaves":
        this.createLeavesEffect();
        break;
      case "sand":
        this.createSandEffect();
        break;
      case "snow":
        this.createSnowEffect();
        break;
      case "sunray":
        this.createSunrayEffect();
        break;
      case "meteor":
        this.createMeteorEffect();
        break;
      default:
        break;
    }
  }

  /**
   * 演出用要素を生成して effectLayer に追加する共通メソッド。
   */
  createEffectItem(className, inlineStyle = "") {
    const element = document.createElement("span");
    element.className = className;

    if (inlineStyle) {
      element.style.cssText = inlineStyle;
    }

    this.dom.effectLayer.appendChild(element);
    return element;
  }

  /**
   * 葉っぱ演出を生成する。
   *
   * ※ count や各乱数範囲は config.js に切り出し可能。
   */
  createLeavesEffect() {
    const count = 16;

    for (let index = 0; index < count; index += 1) {
      const size = 10 + Math.random() * 18;
      const top = Math.random() * 100;
      const delay = Math.random() * 5;
      const duration = 6 + Math.random() * 4;
      const drift = -20 + Math.random() * 40;
      const hue = 70 + Math.random() * 60;

      this.createEffectItem(
        "effect-item effect-leaf",
        `
          top: ${top}%;
          left: -10%;
          width: ${size}px;
          height: ${size * 0.6}px;
          animation-delay: -${delay}s;
          animation-duration: ${duration}s;
          --leaf-drift: ${drift}px;
          --leaf-hue: ${hue}deg;
        `
      );
    }
  }

  /**
   * 砂嵐演出を生成する。
   */
  createSandEffect() {
    const count = 14;

    for (let index = 0; index < count; index += 1) {
      const top = Math.random() * 100;
      const height = 8 + Math.random() * 20;
      const delay = Math.random() * 3;
      const duration = 1.8 + Math.random() * 1.8;
      const opacity = 0.08 + Math.random() * 0.8;

      this.createEffectItem(
        "effect-item effect-sand-streak",
        `
          top: ${top}%;
          left: -30%;
          height: ${height}px;
          opacity: ${opacity};
          animation-delay: -${delay}s;
          animation-duration: ${duration}s;
        `
      );
    }
  }

  /**
   * 雪演出を生成する。
   */
  createSnowEffect() {
    const count = 24;

    for (let index = 0; index < count; index += 1) {
      const size = 4 + Math.random() * 8;
      const left = Math.random() * 100;
      const delay = Math.random() * 8;
      const duration = 5 + Math.random() * 5;
      const drift = -20 + Math.random() * 40;

      this.createEffectItem(
        "effect-item effect-snow",
        `
          top: -10%;
          left: ${left}%;
          width: ${size}px;
          height: ${size}px;
          animation-delay: -${delay}s;
          animation-duration: ${duration}s;
          --snow-drift: ${drift}px;
        `
      );
    }
  }

  /**
   * 光演出を生成する。
   */
  createSunrayEffect() {
    const beamCount = 5;

    for (let index = 0; index < beamCount; index += 1) {
      const left = 5 + index * 18 + Math.random() * 8;
      const width = 80 + Math.random() * 90;
      const delay = Math.random() * 4;
      const duration = 4 + Math.random() * 3;
      const rotation = -26 + Math.random() * 14;

      this.createEffectItem(
        "effect-item effect-sunray-beam",
        `
          left: ${left}%;
          width: ${width}px;
          animation-delay: -${delay}s;
          animation-duration: ${duration}s;
          transform: translateX(-50%) rotate(${rotation}deg);
        `
      );
    }

    this.createEffectItem("effect-item effect-sunray-glow");
  }

  /**
   * 隕石演出を生成する。
   */
  createMeteorEffect() {
    const count = 5;

    for (let index = 0; index < count; index += 1) {
      const top = Math.random() * 60;
      const delay = Math.random() * 8;
      const duration = 8 + Math.random() * 4;
      const size = 70 + Math.random() * 80;
      const rotationDuration = 10 + Math.random() * 8;

      const meteor = this.createEffectItem(
        "effect-item effect-meteor-rock",
        `
          top: ${top}%;
          left: ${85 + Math.random() * 20}%;
          width: ${size}px;
          height: ${size}px;
          animation-delay: -${delay}s;
          animation-duration: ${duration}s;
        `
      );

      const core = document.createElement("span");
      core.className = "effect-meteor-rock-core";
      core.style.setProperty("--meteor-rotate-duration", `${rotationDuration}s`);

      meteor.appendChild(core);
    }
  }

  /* =========================================================
     プレイヤー
     ========================================================= */

  /**
   * プレイヤー画像を生成する。
   */
  createPlayer(playerSrc) {
    const player = document.createElement("img");
    player.className = "player player-facing-right";
    player.src = playerSrc;
    player.alt = "player";

    this.dom.playfield.appendChild(player);
    this.playerElement = player;
  }

  /**
   * プレイヤーの向きを変更する。
   */
  setPlayerDirection(lane) {
    if (!this.playerElement) {
      return;
    }

    this.playerElement.classList.remove(
      "player-facing-left",
      "player-facing-right"
    );

    this.playerElement.classList.add(
      lane === "left" ? "player-facing-left" : "player-facing-right"
    );
  }

  /**
   * プレイヤーのジャンプ演出を再生する。
   * 同じアニメーションを再実行できるよう、classを付け直す。
   */
  playPlayerHop(lane) {
    if (!this.playerElement) {
      return;
    }

    const animationClass =
      lane === "left" ? "player-hop-left" : "player-hop-right";

    this.playerElement.classList.remove("player-hop-left", "player-hop-right");

    // reflow を発生させてアニメーション再始動
    void this.playerElement.offsetWidth;

    this.playerElement.classList.add(animationClass);
  }

  /**
   * プレイヤー落下演出を開始する。
   */
  setPlayerFalling() {
    this.playerElement?.classList.add("player-falling");
  }

  /* =========================================================
     シーン描画
     ========================================================= */

  /**
   * 現在見えている範囲の床 / 障害物を描画する。
   */
  renderScene(stepManager, currentStepIndex, visibleStepCount, highScore) {
    const layoutInfo = this.buildVisibleLayoutInfo(
      stepManager,
      currentStepIndex,
      visibleStepCount
    );

    this.renderTiles(layoutInfo, highScore);
    this.renderObstacles(layoutInfo);
  }

  /**
   * 現在画面に表示する床配置の情報を組み立てる。
   * あわせて、障害物配置で使う占有グリッド情報も作る。
   */
  buildVisibleLayoutInfo(stepManager, currentStepIndex, visibleStepCount) {
    const visibleSteps = stepManager.getVisibleSteps(
      currentStepIndex,
      visibleStepCount
    );

    const items = [];
    const occupiedGridKeys = new Set();
    let cumulativeOffsetX = 0;

    for (const { stepIndex, step } of visibleSteps) {
      const relativeIndex = stepIndex - currentStepIndex;

      if (relativeIndex === 0) {
        cumulativeOffsetX = 0;
      } else {
        cumulativeOffsetX += step.lane === "left" ? -1 : 1;
      }

      items.push({
        stepIndex,
        step,
        relativeIndex,
        cumulativeOffsetX
      });

      occupiedGridKeys.add(
        this.createGridKey(cumulativeOffsetX, relativeIndex)
      );
    }

    return { items, occupiedGridKeys };
  }

  /**
   * 床画像を更新する。
   * - 既存要素は再利用
   * - 画面外へ出たものは drop-out 演出後に削除
   */
  renderTiles(layoutInfo, highScore) {
    const visibleStepIds = new Set(
      layoutInfo.items.map(({ step }) => String(step.id))
    );

    for (const item of layoutInfo.items) {
      const { step, stepIndex, relativeIndex, cumulativeOffsetX } = item;
      const position = this.calculateTilePosition(relativeIndex, cumulativeOffsetX);

      let tileElement = this.tileElementsByStepId.get(step.id);
      const isNewTile = !tileElement;

      if (!tileElement) {
        tileElement = document.createElement("img");
        tileElement.className = "tile";
        tileElement.alt = "tile";

        this.dom.worldLayer.appendChild(tileElement);
        this.tileElementsByStepId.set(step.id, tileElement);
      }

      tileElement.src = this.getTileImagePath(step, stepIndex, highScore);
      tileElement.style.left = `${position.x}px`;
      tileElement.style.top = `${position.y}px`;
      tileElement.style.zIndex = String(1000 - relativeIndex);
      tileElement.style.transform = "";
      tileElement.style.setProperty(
        "--drop-out-start-anchor-y",
        "var(--tile-anchor-y)"
      );

      tileElement.classList.remove("tile-falling", "tile-drop-out");

      if (step.state === STEP_STATE.falling) {
        tileElement.classList.add("tile-falling");
      }

      if (isNewTile && relativeIndex > 0) {
        tileElement.classList.remove("tile-drop-in");
        void tileElement.offsetWidth;
        tileElement.classList.add("tile-drop-in");
      }
    }

    for (const [stepId, tileElement] of this.tileElementsByStepId.entries()) {
      if (!visibleStepIds.has(String(stepId))) {
        this.startTileDropOut(stepId, tileElement);
      }
    }
  }

  /**
   * 障害物を更新する。
   * 床と重ならない安全な位置候補を探し、その位置へ描画する。
   */
  renderObstacles(layoutInfo) {
    const visibleObstacleKeys = new Set();

    for (const item of layoutInfo.items) {
      const { step, relativeIndex, cumulativeOffsetX } = item;

      if (!step.obstacle) {
        continue;
      }

      const safeCandidate = this.findSafeObstacleCandidate(
        cumulativeOffsetX,
        relativeIndex,
        step.obstacle.positionIndex,
        layoutInfo.occupiedGridKeys
      );

      if (!safeCandidate) {
        continue;
      }

      const obstaclePosition = this.calculateObstaclePosition(
        relativeIndex,
        cumulativeOffsetX,
        safeCandidate
      );

      const obstacleAsset = this.getObstacleTileAsset(
        step.themeIndex,
        step.obstacle.imageIndex
      );

      const obstacleKey = `obstacle-${step.id}`;
      visibleObstacleKeys.add(obstacleKey);

      let obstacleElement = this.obstacleElementsByKey.get(obstacleKey);

      if (!obstacleElement) {
        obstacleElement = document.createElement("img");
        obstacleElement.className = "tile obstacle-tile";
        obstacleElement.alt = "obstacle";

        this.dom.worldLayer.appendChild(obstacleElement);
        this.obstacleElementsByKey.set(obstacleKey, obstacleElement);
      }

      obstacleElement.src = obstacleAsset.src;
      obstacleElement.style.left = `${obstaclePosition.x}px`;
      obstacleElement.style.top = `${obstaclePosition.y}px`;
      obstacleElement.style.zIndex = String(1400 - relativeIndex);
      obstacleElement.style.transform =
        `translate(var(--tile-anchor-x), ${obstacleAsset.anchorYPercent}%)`;
      obstacleElement.style.setProperty(
        "--drop-out-start-anchor-y",
        `${obstacleAsset.anchorYPercent}%`
      );

      obstacleElement.classList.remove(
        "tile-drop-in",
        "tile-falling",
        "tile-drop-out"
      );
    }

    for (const [obstacleKey, obstacleElement] of this.obstacleElementsByKey.entries()) {
      if (!visibleObstacleKeys.has(obstacleKey)) {
        this.startObstacleDropOut(obstacleKey, obstacleElement);
      }
    }
  }

  /**
   * 床と重ならない障害物位置候補を探す。
   * preferredPositionIndex を優先しつつ、順に候補を試す。
   */
  findSafeObstacleCandidate(
    cumulativeOffsetX,
    relativeIndex,
    preferredPositionIndex,
    occupiedGridKeys
  ) {
    const candidates = RENDER_CONFIG.obstaclePositionCandidates;

    for (let offset = 0; offset < candidates.length; offset += 1) {
      const candidateIndex =
        (preferredPositionIndex + offset) % candidates.length;
      const candidate = candidates[candidateIndex];

      const obstacleGridKey = this.createGridKey(
        cumulativeOffsetX + candidate.x,
        relativeIndex + candidate.y
      );

      if (!occupiedGridKeys.has(obstacleGridKey)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * 画面外へ出た床を、drop-out 演出つきで削除する。
   */
  startTileDropOut(stepId, tileElement) {
    if (tileElement.dataset.isDroppingOut === "1") {
      return;
    }

    tileElement.dataset.isDroppingOut = "1";
    this.tileElementsByStepId.delete(stepId);

    tileElement.classList.remove("tile-drop-in", "tile-falling");
    void tileElement.offsetWidth;
    tileElement.classList.add("tile-drop-out");

    tileElement.addEventListener(
      "animationend",
      () => tileElement.remove(),
      { once: true }
    );
  }

  /**
   * 画面外へ出た障害物を、drop-out 演出つきで削除する。
   */
  startObstacleDropOut(obstacleKey, obstacleElement) {
    if (obstacleElement.dataset.isDroppingOut === "1") {
      return;
    }

    obstacleElement.dataset.isDroppingOut = "1";
    this.obstacleElementsByKey.delete(obstacleKey);

    obstacleElement.classList.remove("tile-drop-in", "tile-falling");
    void obstacleElement.offsetWidth;
    obstacleElement.classList.add("tile-drop-out");

    obstacleElement.addEventListener(
      "animationend",
      () => obstacleElement.remove(),
      { once: true }
    );
  }

  /* =========================================================
     画像・表示補助
     ========================================================= */

  /**
   * 床の状態に応じて使用する画像パスを返す。
   */
  getTileImagePath(step, stepIndex, highScore) {
    const themeAsset = this.getThemeAsset(step.themeIndex);

    if (step.state === STEP_STATE.collapsing) {
      return themeAsset.tileWarning;
    }

    if (step.state === STEP_STATE.falling) {
      return themeAsset.tileFalling;
    }

    if (highScore > 0 && stepIndex === highScore) {
      return themeAsset.tileHighScoreMarker;
    }

    return themeAsset.tileStable;
  }

  /**
   * 障害物画像情報を返す。
   */
  getObstacleTileAsset(themeIndex, imageIndex) {
    const obstacleTiles = this.getThemeAsset(themeIndex).obstacleTiles;
    return obstacleTiles[imageIndex % obstacleTiles.length];
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
     HUD / オーバーレイ
     ========================================================= */

  /**
   * 現在スコア表示を更新する。
   */
  updateScore(score) {
    this.dom.scoreValue.textContent = String(score);
    this.updatePreviewInfo(score, this.getEffectiveVisualScore(score));
  }

  /**
   * ハイスコア表示を更新する。
   */
  updateHighScore(highScore) {
    this.dom.highScoreValue.textContent = String(highScore);
  }

  /**
   * ハイスコア表示の強調状態を切り替える。
   */
  setHighScoreHighlight(isHighlighted) {
    this.dom.highScoreValue.classList.toggle(
      "high-score-highlight",
      Boolean(isHighlighted)
    );
  }

  /**
   * オーバーレイを隠す。
   */
  hideOverlay() {
    this.dom.overlay.classList.add("hidden");
  }

  /**
   * オーバーレイを表示する。
   */
  showStartOverlay() {
    this.dom.overlay.classList.remove("hidden");
  }

  /**
   * ゲームオーバー画面を表示する。
   */
  showGameOverOverlay(score, reasonText, onRestart) {
    this.dom.overlay.innerHTML = `
      <div class="overlay-card">
        <h2 class="overlay-title">Game Over</h2>
        <p class="overlay-text">${this.escapeHtml(reasonText)}</p>
        <p class="overlay-text">今回のスコア: <strong>${score}</strong></p>

        <button id="submitScoreButton" class="primary-button" type="button">
          スコア送信
        </button>

        <button id="restartButton" class="primary-button" type="button">
          もう一度遊ぶ
        </button>

        <div class="menu-row">
          <button id="btnSettingsGameOver" class="primary-button sub-button" type="button">
            設定
          </button>
          <button id="btnRankingGameOver" class="primary-button sub-button" type="button">
            ランキング
          </button>
        </div>
      </div>
    `;

    this.showStartOverlay();

    document
      .getElementById("restartButton")
      ?.addEventListener("click", onRestart);
  }

  /**
   * HTML文字列をエスケープする。
   */
  escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  /* =========================================================
     後始末
     ========================================================= */

  /**
   * プレイ領域を初期化する。
   * 床・障害物・演出・プレイヤー要素をすべて消す。
   */
  clearPlayfield() {
    this.dom.worldLayer.innerHTML = "";
    this.tileElementsByStepId.clear();
    this.obstacleElementsByKey.clear();

    this.clearEffectLayer();

    if (this.playerElement) {
      this.playerElement.remove();
      this.playerElement = null;
    }
  }
}