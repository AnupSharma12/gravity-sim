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

const SHAPE_TYPES = Object.freeze(["cube", "sphere"]);

/**
 * @typedef {Object} PhysicsObject
 * @property {string} id
 * @property {"cube"|"sphere"} type
 * @property {{x: number, y: number}} position
 * @property {{vx: number, vy: number}} velocity
 * @property {{ax: number, ay: number}} acceleration
 * @property {number} gravity
 * @property {number} mass
 * @property {number} weight
 * @property {number} size
 * @property {number} density
 * @property {number} volume
 * @property {string} color
 * @property {boolean} locked
 */

function generateObjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `obj-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function calculateVolume(type, size) {
  if (type === "sphere") {
    const radius = size / 2;
    return (4 / 3) * Math.PI * radius * radius * radius;
  }
  return size * size * size;
}

function calculateWeight(mass, gravity) {
  return mass * gravity;
}

function calculateDensity(mass, volume) {
  if (volume <= 0) {
    return 0;
  }
  return mass / volume;
}

/**
 * Creates a normalized physics object with required simulation fields.
 * @param {Partial<PhysicsObject>} overrides
 * @returns {PhysicsObject}
 */
function createPhysicsObject(overrides = {}) {
  const type = SHAPE_TYPES.includes(overrides.type) ? overrides.type : "cube";
  const size = Number.isFinite(overrides.size) ? Math.max(0.1, overrides.size) : 20;
  const gravity = Number.isFinite(overrides.gravity) ? overrides.gravity : 9.8;
  const mass = Number.isFinite(overrides.mass) ? Math.max(0.1, overrides.mass) : 10;
  const volume = Number.isFinite(overrides.volume) ? Math.max(0.001, overrides.volume) : calculateVolume(type, size);
  const density = Number.isFinite(overrides.density) ? Math.max(0, overrides.density) : calculateDensity(mass, volume);
  const weight = Number.isFinite(overrides.weight) ? overrides.weight : calculateWeight(mass, gravity);

  return {
    id: overrides.id || generateObjectId(),
    type,
    position: {
      x: Number.isFinite(overrides.position?.x) ? overrides.position.x : 0,
      y: Number.isFinite(overrides.position?.y) ? overrides.position.y : 0,
    },
    velocity: {
      vx: Number.isFinite(overrides.velocity?.vx) ? overrides.velocity.vx : 0,
      vy: Number.isFinite(overrides.velocity?.vy) ? overrides.velocity.vy : 0,
    },
    acceleration: {
      ax: Number.isFinite(overrides.acceleration?.ax) ? overrides.acceleration.ax : 0,
      ay: Number.isFinite(overrides.acceleration?.ay) ? overrides.acceleration.ay : 0,
    },
    gravity,
    mass,
    weight,
    size,
    density,
    volume,
    color: overrides.color || "#0f766e",
    locked: Boolean(overrides.locked),
  };
}

const appState = {
  initializedAt: new Date().toISOString(),
  canvasReady: Boolean(canvas),
  isRunning: false,
  stepCount: 0,
  objects: [],
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
  appState.objectCount = appState.objects.length;

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

// Create a ready-to-use model instance template for upcoming object workflows.
const objectModelTemplate = createPhysicsObject();
void objectModelTemplate;

console.log("Gravity Simulator scaffold ready", appState);
