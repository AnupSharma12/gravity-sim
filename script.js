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

function createSimulationStateStore(initialState) {
  const state = { ...initialState };
  const listeners = new Set();

  return {
    getState() {
      return state;
    },
    update(patch) {
      Object.assign(state, patch);
      listeners.forEach((listener) => listener(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const simulationStore = createSimulationStateStore({
  initializedAt: new Date().toISOString(),
  canvasReady: Boolean(canvas),
  isRunning: false,
  stepCount: 0,
  simulationFrameId: null,
  lastSimulationTimestamp: null,
  worldWidth: 0,
  worldHeight: 0,
  objects: [],
  objectCount: 0,
  currentGravity: 9.8,
  selectedObject: "None",
  fps: 0,
  toastTimer: null,
});

const appState = simulationStore.getState();

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

  simulationStore.update({
    toastTimer: window.setTimeout(() => {
      toast.remove();
      simulationStore.update({ toastTimer: null });
    }, 3000),
  });
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
      simulationStore.update({ fps: Math.round((frameCount * 1000) / elapsed) });
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

function simulationTick(timestamp) {
  if (!appState.isRunning) {
    return;
  }

  const previousTimestamp = appState.lastSimulationTimestamp ?? timestamp;
  const rawDeltaSeconds = (timestamp - previousTimestamp) / 1000;
  const deltaSeconds = Math.max(0, Math.min(rawDeltaSeconds, 0.05));

  simulationStore.update({
    lastSimulationTimestamp: timestamp,
    stepCount: appState.stepCount + 1,
  });

  advanceSimulationByDelta(deltaSeconds);
  initSimulationCanvas();
  updateToolbarStateLabel();

  simulationStore.update({
    simulationFrameId: window.requestAnimationFrame(simulationTick),
  });
}

function startSimulationLoop() {
  if (appState.simulationFrameId !== null) {
    return;
  }

  simulationStore.update({
    lastSimulationTimestamp: null,
    simulationFrameId: window.requestAnimationFrame(simulationTick),
  });
}

function stopSimulationLoop() {
  if (appState.simulationFrameId !== null) {
    window.cancelAnimationFrame(appState.simulationFrameId);
  }

  simulationStore.update({
    simulationFrameId: null,
    lastSimulationTimestamp: null,
  });
}

function handleStart() {
  simulationStore.update({ isRunning: true });
  startSimulationLoop();
  updateToolbarButtons();
  updateToolbarStateLabel();
}

function handlePause() {
  simulationStore.update({ isRunning: false });
  stopSimulationLoop();
  updateToolbarButtons();
  updateToolbarStateLabel();
}

function handleReset() {
  simulationStore.update({
    isRunning: false,
    stepCount: 0,
    selectedObject: "None",
  });
  stopSimulationLoop();
  initSimulationCanvas();
  updateToolbarButtons();
  updateToolbarStateLabel();
  updateStatusBar();
}

function handleStep() {
  advanceSimulationByDelta(1 / 60);
  simulationStore.update({ stepCount: appState.stepCount + 1 });
  initSimulationCanvas();
  updateToolbarStateLabel();
}

function getObjectCollisionRadius(object) {
  if (object.type === "sphere") {
    return Math.max(0.1, object.size / 2);
  }
  return Math.max(0.1, object.size / 2);
}

function applyWorldBoundsAndFloorCollision(object, worldWidth, worldHeight) {
  const radius = getObjectCollisionRadius(object);
  const restitution = 0.6;
  const floorFriction = 0.985;

  const bounded = {
    ...object,
    position: { ...object.position },
    velocity: { ...object.velocity },
  };

  if (bounded.position.x - radius < 0) {
    bounded.position.x = radius;
    bounded.velocity.vx = Math.abs(bounded.velocity.vx) * restitution;
  } else if (bounded.position.x + radius > worldWidth) {
    bounded.position.x = worldWidth - radius;
    bounded.velocity.vx = -Math.abs(bounded.velocity.vx) * restitution;
  }

  if (bounded.position.y - radius < 0) {
    bounded.position.y = radius;
    bounded.velocity.vy = Math.abs(bounded.velocity.vy) * restitution;
  }

  // Floor collision at worldHeight with bounce damping.
  if (bounded.position.y + radius > worldHeight) {
    bounded.position.y = worldHeight - radius;
    bounded.velocity.vy = -Math.abs(bounded.velocity.vy) * restitution;
    bounded.velocity.vx *= floorFriction;
  }

  return bounded;
}

function resolveObjectCollisions(objects) {
  const resolvedObjects = objects.map((object) => ({
    ...object,
    position: { ...object.position },
    velocity: { ...object.velocity },
  }));

  const restitution = 0.5;

  for (let i = 0; i < resolvedObjects.length; i += 1) {
    for (let j = i + 1; j < resolvedObjects.length; j += 1) {
      const objectA = resolvedObjects[i];
      const objectB = resolvedObjects[j];

      const dx = objectB.position.x - objectA.position.x;
      const dy = objectB.position.y - objectA.position.y;
      const distanceSquared = dx * dx + dy * dy;

      const radiusA = getObjectCollisionRadius(objectA);
      const radiusB = getObjectCollisionRadius(objectB);
      const minDistance = radiusA + radiusB;

      if (distanceSquared >= minDistance * minDistance) {
        continue;
      }

      const distance = Math.sqrt(Math.max(distanceSquared, 1e-8));
      const normalX = dx / distance;
      const normalY = dy / distance;
      const overlap = minDistance - distance;

      const invMassA = objectA.locked ? 0 : 1 / Math.max(objectA.mass, 0.0001);
      const invMassB = objectB.locked ? 0 : 1 / Math.max(objectB.mass, 0.0001);
      const invMassTotal = invMassA + invMassB;

      if (invMassTotal <= 0) {
        continue;
      }

      const correctionA = (overlap * invMassA) / invMassTotal;
      const correctionB = (overlap * invMassB) / invMassTotal;

      if (!objectA.locked) {
        objectA.position.x -= normalX * correctionA;
        objectA.position.y -= normalY * correctionA;
      }
      if (!objectB.locked) {
        objectB.position.x += normalX * correctionB;
        objectB.position.y += normalY * correctionB;
      }

      const relativeVelocityX = objectB.velocity.vx - objectA.velocity.vx;
      const relativeVelocityY = objectB.velocity.vy - objectA.velocity.vy;
      const velocityAlongNormal = relativeVelocityX * normalX + relativeVelocityY * normalY;

      if (velocityAlongNormal > 0) {
        continue;
      }

      const impulseScalar = (-(1 + restitution) * velocityAlongNormal) / invMassTotal;
      const impulseX = impulseScalar * normalX;
      const impulseY = impulseScalar * normalY;

      if (!objectA.locked) {
        objectA.velocity.vx -= impulseX * invMassA;
        objectA.velocity.vy -= impulseY * invMassA;
      }
      if (!objectB.locked) {
        objectB.velocity.vx += impulseX * invMassB;
        objectB.velocity.vy += impulseY * invMassB;
      }
    }
  }

  return resolvedObjects;
}

/**
 * Applies a delta-time integration step to all unlocked objects.
 * @param {number} deltaSeconds
 */
function advanceSimulationByDelta(deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return;
  }

  const worldWidth = Math.max(1, appState.worldWidth || canvas?.clientWidth || 1);
  const worldHeight = Math.max(1, appState.worldHeight || canvas?.clientHeight || 1);

  const boundedObjects = appState.objects.map((object) => {
    if (object.locked) {
      return {
        ...object,
        position: { ...object.position },
        velocity: { ...object.velocity },
      };
    }

    const ax = Number.isFinite(object.acceleration.ax) ? object.acceleration.ax : 0;
    const ay = (Number.isFinite(object.acceleration.ay) ? object.acceleration.ay : 0) + object.gravity;

    const nextVx = object.velocity.vx + ax * deltaSeconds;
    const nextVy = object.velocity.vy + ay * deltaSeconds;

    const integratedObject = {
      ...object,
      velocity: {
        vx: nextVx,
        vy: nextVy,
      },
      position: {
        x: object.position.x + nextVx * deltaSeconds,
        y: object.position.y + nextVy * deltaSeconds,
      },
    };

    return applyWorldBoundsAndFloorCollision(integratedObject, worldWidth, worldHeight);
  });

  const updatedObjects = resolveObjectCollisions(boundedObjects);

  simulationStore.update({ objects: updatedObjects });
  updateStatusBar();
}

function handleGravityInputChange(event) {
  const parsedValue = Number.parseFloat(event.target.value);
  if (!Number.isNaN(parsedValue)) {
    simulationStore.update({ currentGravity: parsedValue });
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

  if (resized.cssWidth !== appState.worldWidth || resized.cssHeight !== appState.worldHeight) {
    simulationStore.update({
      worldWidth: resized.cssWidth,
      worldHeight: resized.cssHeight,
    });
  }

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
