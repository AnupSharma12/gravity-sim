"use strict";

const canvas = document.getElementById("simCanvas");
const canvasSizeLabel = document.getElementById("canvasSizeLabel");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const stepBtn = document.getElementById("stepBtn");
const simStateLabel = document.getElementById("simStateLabel");
const gravityInput = document.getElementById("gravityInput");
const fpsValue = document.getElementById("fpsValue");
const objectCountValue = document.getElementById("objectCountValue");
const gravityValue = document.getElementById("gravityValue");
const selectedObjectValue = document.getElementById("selectedObjectValue");
const toastArea = document.getElementById("toastArea");

const appState = {
  initializedAt: new Date().toISOString(),
  canvasReady: Boolean(canvas),
  isRunning: false,
  stepCount: 0,
  objectCount: 0,
  currentGravity: 9.8,
  selectedObject: "None",
  fps: 0,
  toastTimer: null,
};

function showToast(message, variant = "info") {
  if (!toastArea) {
    return;
  }

  toastArea.innerHTML = "";

  const toast = document.createElement("div");
  toast.className = `toast toast--${variant}`;
  toast.setAttribute("role", variant === "error" ? "alert" : "status");
  toast.textContent = message;
  toastArea.appendChild(toast);

  if (appState.toastTimer) {
    window.clearTimeout(appState.toastTimer);
  }

  appState.toastTimer = window.setTimeout(() => {
    toast.remove();
    appState.toastTimer = null;
  }, 3000);
}

function updateStatusBar() {
  if (fpsValue) {
    fpsValue.textContent = String(appState.fps);
  }
  if (objectCountValue) {
    objectCountValue.textContent = String(appState.objectCount);
  }
  if (gravityValue) {
    gravityValue.textContent = String(appState.currentGravity);
  }
  if (selectedObjectValue) {
    selectedObjectValue.textContent = appState.selectedObject;
  }
}

function startFpsTracker() {
  let frameCount = 0;
  let windowStart = performance.now();

  function tick(now) {
    frameCount += 1;
    const elapsed = now - windowStart;

    if (elapsed >= 1000) {
      appState.fps = Math.round((frameCount * 1000) / elapsed);
      frameCount = 0;
      windowStart = now;
      updateStatusBar();
    }

    window.requestAnimationFrame(tick);
  }

  window.requestAnimationFrame(tick);
}

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
  appState.selectedObject = "None";
  initSimulationCanvas();
  updateToolbarButtons();
  updateToolbarStateLabel();
  updateStatusBar();
}

function handleStep() {
  appState.stepCount += 1;
  initSimulationCanvas();
  updateToolbarStateLabel();
}

function handleGravityInputChange(event) {
  const parsedValue = Number.parseFloat(event.target.value);
  if (!Number.isNaN(parsedValue)) {
    appState.currentGravity = parsedValue;
    updateStatusBar();
  } else {
    showToast("Gravity must be a valid number.", "error");
  }
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
if (gravityInput) {
  gravityInput.addEventListener("input", handleGravityInputChange);
}

window.addEventListener("resize", initSimulationCanvas);
window.addEventListener("load", initSimulationCanvas);

updateToolbarButtons();
updateToolbarStateLabel();
updateStatusBar();
startFpsTracker();
showToast("Validation messages will appear here.", "info");

console.log("Gravity Simulator scaffold ready", appState);
