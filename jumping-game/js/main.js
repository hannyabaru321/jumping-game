import { Game } from "./Game.js";

/*
  ============================================================
  main.js
  ------------------------------------------------------------
  起動専用ファイル。
  ============================================================
*/

const dom = {
  gameBoard: document.getElementById("gameBoard"),
  playfield: document.getElementById("playfield"),
  backgroundLayerA: document.getElementById("backgroundLayerA"),
  backgroundLayerB: document.getElementById("backgroundLayerB"),
  worldLayer: document.getElementById("worldLayer"),
  overlay: document.getElementById("overlay"),
  startButton: document.getElementById("startButton"),
  scoreValue: document.getElementById("scoreValue"),
  highScoreValue: document.getElementById("highScoreValue"),
  leftButton: document.getElementById("leftButton"),
  rightButton: document.getElementById("rightButton")
};

const game = new Game(dom);
game.initialize();
