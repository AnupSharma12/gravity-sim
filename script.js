"use strict";

const canvas = document.getElementById("simCanvas");
const canvasSizeLabel = document.getElementById("canvasSizeLabel");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const stepBtn = document.getElementById("stepBtn");
const simStateLabel = document.getElementById("simStateLabel");

const appState = {
  initializedAt: new Date().toISOString(),
  canvasReady: Boolean(canvas),
  isRunning: false,
  stepCount: 0,
};

function updateToolbarStateLabel() {
  if (!simStateLabel) {
    return;
  }

  const stateText = appState.isRunning ? "Running" : "Paused";
  simStateLabel.textContent = `State: ${stateText} | Steps: ${appState.stepCount}`;
}

function updateToolbarButtons() {
  if (startBtn) {
    startBtn.classList.toggle("is-active", appState.isRunning);
    startBtn.disabled = appState.isRunning;
  }
  if (pauseBtn) {
    pauseBtn.disabled = !appState.isRunning;
  }
}

function handleStart() {
  appState.isRunning = true;
  updateToolbarButtons();
  updateToolbarStateLabel();
}

function handlePause() {
  appState.isRunning = false;
  updateToolbarButtons();
  updateToolbarStateLabel();
}

function handleReset() {
  appState.isRunning = false;
  appState.stepCount = 0;
  initSimulationCanvas();
  updateToolbarButtons();
  updateToolbarStateLabel();
}

function handleStep() {
  appState.stepCount += 1;
  initSimulationCanvas();
  updateToolbarStateLabel();
}

function resizeCanvasToContainer(targetCanvas) {
  const ratio = window.devicePixelRatio || 1;
  const cssWidth = Math.max(1, Math.floor(targetCanvas.clientWidth));
  const cssHeight = Math.max(1, Math.floor(targetCanvas.clientHeight));

  targetCanvas.width = Math.floor(cssWidth * ratio);
  targetCanvas.height = Math.floor(cssHeight * ratio);

  const ctx = targetCanvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, cssWidth, cssHeight };
}

function drawCanvasPlaceholder(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  const step = 24;
  for (let x = 0; x <= width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#52606d";
  ctx.font = "600 16px Segoe UI, Tahoma, Geneva, Verdana, sans-serif";
  ctx.fillText("Simulation Canvas Ready", 20, 32);
}

function initSimulationCanvas() {
  if (!canvas) {
    console.warn("Simulation canvas element not found.");
    return;
  }

  const resized = resizeCanvasToContainer(canvas);
  if (!resized) {
    return;
  }

  drawCanvasPlaceholder(resized.ctx, resized.cssWidth, resized.cssHeight);

  if (canvasSizeLabel) {
    canvasSizeLabel.textContent = `${resized.cssWidth} x ${resized.cssHeight} px`;
  }
}

if (startBtn) {
  startBtn.addEventListener("click", handleStart);
}
if (pauseBtn) {
  pauseBtn.addEventListener("click", handlePause);
}
if (resetBtn) {
  resetBtn.addEventListener("click", handleReset);
}
if (stepBtn) {
  stepBtn.addEventListener("click", handleStep);
}

window.addEventListener("resize", initSimulationCanvas);
window.addEventListener("load", initSimulationCanvas);

updateToolbarButtons();
updateToolbarStateLabel();

console.log("Gravity Simulator scaffold ready", appState);
