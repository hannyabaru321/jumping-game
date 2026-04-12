import {
  PLAYER_ANIMATION_CONFIG,
  RENDER_CONFIG,
  STEP_STATE,
  THEME_ASSETS
} from "./config.js";

/*
  ============================================================
  GameRenderer.js
  ------------------------------------------------------------
  描画専用クラス。
  ============================================================
*/

export class GameRenderer {
  constructor(dom) {
    this.dom = dom;
    this.renderConfig = RENDER_CONFIG;

    this.playerElement = null;
    this.tileElementsByStepId = new Map();
    this.obstacleElementsByKey = new Map();

    this.currentBackgroundThemeIndex = -1;
    this.activeBackgroundLayerKey = "A";
  }

  getRenderMetrics() {
    const boardRect = this.dom.gameBoard.getBoundingClientRect();
    const boardWidth = boardRect.width;
    const boardHeight = boardRect.height;

    return {
      baseX: boardWidth * 0.5,
      baseY: boardHeight * 0.85,
      stepOffsetX: boardWidth * 0.10,
      stepOffsetY: boardHeight * 0.07
    };
  }

  clearPlayfield() {
    this.dom.worldLayer.innerHTML = "";
    this.tileElementsByStepId.clear();
    this.obstacleElementsByKey.clear();

    if (this.playerElement) {
      this.playerElement.remove();
      this.playerElement = null;
    }
  }

  initializeBackground(themeIndex) {
    const themeAsset = this.getThemeAsset(themeIndex);

    this.dom.backgroundLayerA.style.backgroundImage = `url("${themeAsset.background}")`;
    this.dom.backgroundLayerA.classList.add("visible");
    this.dom.backgroundLayerB.classList.remove("visible");

    this.activeBackgroundLayerKey = "A";
    this.currentBackgroundThemeIndex = themeIndex;
  }

  updateBackgroundThemeByScore(score) {
    const nextThemeIndex = this.getThemeIndexByScore(score);

    if (nextThemeIndex === this.currentBackgroundThemeIndex) {
      return;
    }

    const nextThemeAsset = this.getThemeAsset(nextThemeIndex);
    const nextLayer =
      this.activeBackgroundLayerKey === "A"
        ? this.dom.backgroundLayerB
        : this.dom.backgroundLayerA;
    const prevLayer =
      this.activeBackgroundLayerKey === "A"
        ? this.dom.backgroundLayerA
        : this.dom.backgroundLayerB;

    nextLayer.style.backgroundImage = `url("${nextThemeAsset.background}")`;
    nextLayer.classList.add("visible");
    prevLayer.classList.remove("visible");

    this.activeBackgroundLayerKey =
      this.activeBackgroundLayerKey === "A" ? "B" : "A";
    this.currentBackgroundThemeIndex = nextThemeIndex;
  }

  createPlayer(playerSrc) {
    const player = document.createElement("img");
    player.className = "player player-facing-right";
    player.src = playerSrc;
    player.alt = "player";

    this.dom.playfield.appendChild(player);
    this.playerElement = player;
  }

  renderScene(stepManager, currentStepIndex, visibleStepCount, highScore) {
    const layoutInfo = this.buildVisibleLayoutInfo(
      stepManager,
      currentStepIndex,
      visibleStepCount
    );

    this.renderTiles(layoutInfo, highScore);
    this.renderObstacleTiles(layoutInfo);
  }

  buildVisibleLayoutInfo(stepManager, currentStepIndex, visibleStepCount) {
    const visibleSteps = stepManager.getVisibleSteps(
      currentStepIndex,
      visibleStepCount
    );

    const items = [];
    const occupiedGridKeys = new Set();

    let cumulativeOffsetX = 0;

    for (let index = 0; index < visibleSteps.length; index += 1) {
      const { stepIndex, step } = visibleSteps[index];
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

      occupiedGridKeys.add(this.createGridKey(cumulativeOffsetX, relativeIndex));
    }

    return {
      items,
      occupiedGridKeys
    };
  }

  renderTiles(layoutInfo, highScore) {
    const visibleStepIds = new Set(layoutInfo.items.map(({ step }) => step.id));

    for (const item of layoutInfo.items) {
      const { step, stepIndex, relativeIndex, cumulativeOffsetX } = item;

      const position = this.calculateTilePosition(
        relativeIndex,
        cumulativeOffsetX
      );

      let tileElement = this.tileElementsByStepId.get(step.id);
      const isNewTile = !tileElement;

      if (!tileElement) {
        tileElement = document.createElement("img");
        tileElement.className = "tile";
        tileElement.alt = "tile";
        tileElement.style.left = `${position.x}px`;
        tileElement.style.top = `${position.y}px`;

        this.dom.worldLayer.appendChild(tileElement);
        this.tileElementsByStepId.set(step.id, tileElement);
      }

      tileElement.src = this.getTileImagePath(step, stepIndex, highScore);
      tileElement.style.left = `${position.x}px`;
      tileElement.style.top = `${position.y}px`;
      tileElement.style.zIndex = String(1000 - relativeIndex);
      tileElement.style.transform = "";
      tileElement.style.setProperty("--drop-out-start-anchor-y", "var(--tile-anchor-y)");

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
      if (!visibleStepIds.has(stepId)) {
        this.startTileDropOut(stepId, tileElement);
      }
    }
  }

  renderObstacleTiles(layoutInfo) {
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
        obstacleElement.alt = "obstacle-tile";
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

      obstacleElement.classList.remove("tile-drop-in", "tile-falling", "tile-drop-out");
    }

    for (const [obstacleKey, obstacleElement] of this.obstacleElementsByKey.entries()) {
      if (!visibleObstacleKeys.has(obstacleKey)) {
        this.startObstacleDropOut(obstacleKey, obstacleElement);
      }
    }
  }

  findSafeObstacleCandidate(
    cumulativeOffsetX,
    relativeIndex,
    preferredPositionIndex,
    occupiedGridKeys
  ) {
    const candidates = this.renderConfig.obstaclePositionCandidates ?? [];
    if (candidates.length === 0) {
      return null;
    }

    for (let offset = 0; offset < candidates.length; offset += 1) {
      const candidateIndex = (preferredPositionIndex + offset) % candidates.length;
      const candidate = candidates[candidateIndex];

      const obstacleGridX = cumulativeOffsetX + candidate.x;
      const obstacleGridY = relativeIndex + candidate.y;
      const obstacleGridKey = this.createGridKey(obstacleGridX, obstacleGridY);

      if (!occupiedGridKeys.has(obstacleGridKey)) {
        return candidate;
      }
    }

    return null;
  }

  createGridKey(gridX, gridY) {
    return `${Number(gridX).toFixed(3)}:${Number(gridY).toFixed(3)}`;
  }

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
      () => {
        tileElement.remove();
      },
      { once: true }
    );
  }

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
      () => {
        obstacleElement.remove();
      },
      { once: true }
    );
  }

  calculateTilePosition(relativeIndex, cumulativeOffsetX) {
    const metrics = this.getRenderMetrics();

    return {
      x: metrics.baseX + cumulativeOffsetX * metrics.stepOffsetX,
      y: metrics.baseY - relativeIndex * metrics.stepOffsetY
    };
  }

  calculateObstaclePosition(relativeIndex, cumulativeOffsetX, candidate) {
    const metrics = this.getRenderMetrics();

    return {
      x:
        metrics.baseX +
        (cumulativeOffsetX + candidate.x) * metrics.stepOffsetX,
      y:
        metrics.baseY -
        (relativeIndex + candidate.y) * metrics.stepOffsetY
    };
  }

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

  getObstacleTileAsset(themeIndex, imageIndex) {
    const obstacleTiles = this.getThemeAsset(themeIndex).obstacleTiles;
    return obstacleTiles[imageIndex % obstacleTiles.length];
  }

  getThemeAsset(themeIndex) {
    const safeIndex = Math.max(0, Math.min(themeIndex, THEME_ASSETS.length - 1));
    return THEME_ASSETS[safeIndex];
  }

  getThemeIndexByScore(score) {
    const safeScore = Math.max(0, Number(score) || 0);

    if (safeScore <= 100) {
      return 0;
    }

    if (safeScore <= 200) {
      return 1;
    }

    if (safeScore <= 500) {
      return 2;
    }

    if (safeScore <= 1000) {
      return 3;
    }

    return 4;
  }

  setPlayerDirection(lane) {
    if (!this.playerElement) {
      return;
    }

    this.playerElement.classList.remove("player-facing-left", "player-facing-right");

    if (lane === "left") {
      this.playerElement.classList.add("player-facing-left");
    } else {
      this.playerElement.classList.add("player-facing-right");
    }
  }

  playPlayerHop(lane) {
    if (!this.playerElement) {
      return;
    }

    const animationClass = lane === "left" ? "player-hop-left" : "player-hop-right";
    this.playerElement.classList.remove("player-hop-left", "player-hop-right");
    void this.playerElement.offsetWidth;
    this.playerElement.classList.add(animationClass);
  }

  setPlayerFalling() {
    if (!this.playerElement) {
      return;
    }

    this.playerElement.classList.add("player-falling");
  }

  updateScore(score) {
    this.dom.scoreValue.textContent = String(score);
  }

  updateHighScore(highScore) {
    this.dom.highScoreValue.textContent = String(highScore);
  }

  setHighScoreHighlight(isHighlighted) {
    this.dom.highScoreValue.classList.toggle(
      "high-score-highlight",
      Boolean(isHighlighted)
    );
  }

  hideOverlay() {
    this.dom.overlay.classList.add("hidden");
  }

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

    this.dom.overlay.classList.remove("hidden");

    const restartButton = document.getElementById("restartButton");
    restartButton.addEventListener("click", onRestart);
    }

  escapeHtml(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
}