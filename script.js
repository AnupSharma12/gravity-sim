"use strict";

const canvas = document.getElementById("simCanvas");
const canvasSizeLabel = document.getElementById("canvasSizeLabel");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const stepBtn = document.getElementById("stepBtn");
const simStateLabel = document.getElementById("simStateLabel");
const gravityInput = document.getElementById("gravityInput");
const gravitySliderInput = document.getElementById("gravitySliderInput");
const gravityControlValue = document.getElementById("gravityControlValue");
const timeScaleInput = document.getElementById("timeScaleInput");
const timeScaleValue = document.getElementById("timeScaleValue");
const collisionToggleInput = document.getElementById("collisionToggleInput");
const trailsToggleInput = document.getElementById("trailsToggleInput");
const sizeInput = document.getElementById("sizeInput");
const randomSpawnToggle = document.getElementById("randomSpawnToggle");
const randomSpawnPreview = document.getElementById("randomSpawnPreview");
const fpsValue = document.getElementById("fpsValue");
const objectCountValue = document.getElementById("objectCountValue");
const gravityValue = document.getElementById("gravityValue");
const selectedObjectValue = document.getElementById("selectedObjectValue");
const bulkApplyModeInput = document.getElementById("bulkApplyMode");
const bulkGravityInput = document.getElementById("bulkGravityInput");
const bulkSizeInput = document.getElementById("bulkSizeInput");
const bulkApplyBtn = document.getElementById("bulkApplyBtn");
const selectedTypeValue = document.getElementById("selectedTypeValue");
const selectedIdValue = document.getElementById("selectedIdValue");
const selectedSizeValue = document.getElementById("selectedSizeValue");
const selectedGravityValue = document.getElementById("selectedGravityValue");
const selectedObjectEditor = document.getElementById("selectedObjectEditor");
const selectedGravityInput = document.getElementById("selectedGravityInput");
const selectedSizeInput = document.getElementById("selectedSizeInput");
const selectedDuplicateBtn = document.getElementById("selectedDuplicateBtn");
const selectedDeleteBtn = document.getElementById("selectedDeleteBtn");
const toastArea = document.getElementById("toastArea");
const shapeTypeInput = document.getElementById("shapeType");
const createGravityInput = document.getElementById("createGravityInput");
const addObjectBtn = document.getElementById("addObjectBtn");

const SHAPE_TYPES = Object.freeze(["cube", "sphere"]);

const OBJECT_SOURCE_OF_TRUTH_FIELDS = Object.freeze([
  "id",
  "type",
  "position",
  "velocity",
  "acceleration",
  "gravity",
  "size",
  "color",
  "locked",
]);

const OBJECT_DERIVED_FIELDS = Object.freeze([]);
const LIVE_SELECTED_APPLY_DELAY_MS = 100;
const TRAIL_MAX_POINTS = 80;

let liveSelectedApplyTimer = null;

/**
 * @typedef {Object} PhysicsObject
 * @property {string} id
 * @property {"cube"|"sphere"} type
 * @property {{x: number, y: number}} position
 * @property {{vx: number, vy: number}} velocity
 * @property {{ax: number, ay: number}} acceleration
 * @property {number} gravity
 * @property {number} size
 * @property {string} color
 * @property {boolean} locked
 */

function generateObjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `obj-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function recalculateDependentValues(object) {
  return object;
}

/**
 * Applies only source-of-truth fields and recomputes all derived fields.
 * Direct writes to derived fields are intentionally ignored to avoid circular updates.
 * @param {PhysicsObject} object
 * @param {Partial<PhysicsObject>} patch
 * @returns {PhysicsObject}
 */
function applyObjectSourcePatch(object, patch) {
  const nextObject = { ...object };

  const sanitizedPatch = { ...patch };
  OBJECT_DERIVED_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, field)) {
      delete sanitizedPatch[field];
    }
  });

  OBJECT_SOURCE_OF_TRUTH_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(sanitizedPatch, field)) {
      nextObject[field] = sanitizedPatch[field];
    }
  });

  return recalculateDependentValues(nextObject);
}

/**
 * Creates a normalized physics object with required simulation fields.
 * @param {Partial<PhysicsObject>} overrides
 * @returns {PhysicsObject}
 */
function createPhysicsObject(overrides = {}) {
  const type = SHAPE_TYPES.includes(overrides.type) ? overrides.type : "cube";
  const size = Number.isFinite(overrides.size) ? Math.max(0.1, overrides.size) : 50;
  const gravity = Number.isFinite(overrides.gravity) ? overrides.gravity : 9.8;

  const createdObject = {
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
    size,
    color: overrides.color || "#0f766e",
    locked: Boolean(overrides.locked),
  };

  const initialSourcePatch = {};
  OBJECT_SOURCE_OF_TRUTH_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(createdObject, field)) {
      initialSourcePatch[field] = createdObject[field];
    }
  });

  return applyObjectSourcePatch(createdObject, initialSourcePatch);
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
  randomSpawnEnabled: false,
  pendingSpawnPosition: { x: 0, y: 0 },
  currentGravity: 9.8,
  timeScale: 1,
  collisionsEnabled: true,
  trailsEnabled: false,
  trailHistory: {},
  selectedObject: "None",
  selectedObjectId: null,
  draggingPointerId: null,
  draggingObjectId: null,
  dragOffset: { x: 0, y: 0 },
  dragVelocity: { vx: 0, vy: 0 },
  dragMomentumVelocity: { vx: 0, vy: 0 },
  lastDragPoint: null,
  lastDragTimestamp: 0,
  lastMomentumTimestamp: 0,
  fps: 0,
  toastTimer: null,
});

const appState = simulationStore.getState();

if (randomSpawnToggle) {
  simulationStore.update({ randomSpawnEnabled: randomSpawnToggle.checked });
}

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

  updateSelectedObjectPanel();
}

function getSelectedObject() {
  if (!appState.selectedObjectId) {
    return null;
  }

  return appState.objects.find((object) => object.id === appState.selectedObjectId) || null;
}

function formatSelectedNumber(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function setInputValueIfNotFocused(inputElement, value) {
  if (!inputElement) {
    return;
  }

  if (document.activeElement === inputElement) {
    return;
  }

  inputElement.value = value;
}

function hasValueChanged(nextValue, currentValue) {
  if (!Number.isFinite(nextValue) || !Number.isFinite(currentValue)) {
    return false;
  }

  return Math.abs(nextValue - currentValue) > 0.000001;
}

function parseSelectedInputNumber(inputElement, label) {
  if (!inputElement) {
    return { ok: false, message: `${label} input not found.` };
  }

  const value = Number.parseFloat(inputElement.value);
  if (!Number.isFinite(value)) {
    return { ok: false, message: `${label} must be a valid number.` };
  }

  return { ok: true, value };
}

function parseBulkInputNumber(inputElement, label) {
  if (!inputElement) {
    return { ok: true, value: null };
  }

  const rawValue = inputElement.value.trim();
  if (rawValue === "") {
    return { ok: true, value: null };
  }

  const parsedValue = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return { ok: false, message: `${label} must be a valid number.` };
  }

  return { ok: true, value: parsedValue };
}

function applyModeToValue(currentValue, inputValue, mode) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(inputValue)) {
    return currentValue;
  }

  if (mode === "add") {
    return currentValue + inputValue;
  }
  if (mode === "multiply") {
    return currentValue * inputValue;
  }
  return inputValue;
}

function createTrailHistorySnapshot(objects, previousTrailHistory) {
  const nextTrailHistory = {};

  objects.forEach((object) => {
    const previousPath = Array.isArray(previousTrailHistory[object.id]) ? previousTrailHistory[object.id] : [];
    const lastPoint = previousPath[previousPath.length - 1];
    const currentPoint = {
      x: object.position.x,
      y: object.position.y,
    };

    if (!lastPoint) {
      nextTrailHistory[object.id] = [currentPoint];
      return;
    }

    const distance = Math.hypot(currentPoint.x - lastPoint.x, currentPoint.y - lastPoint.y);
    const nextPath = distance >= 0.5 ? [...previousPath, currentPoint] : [...previousPath];

    if (nextPath.length > TRAIL_MAX_POINTS) {
      nextPath.splice(0, nextPath.length - TRAIL_MAX_POINTS);
    }

    nextTrailHistory[object.id] = nextPath;
  });

  return nextTrailHistory;
}

function ensureTrailHistoryForObjects(objects) {
  const nextTrailHistory = createTrailHistorySnapshot(objects, appState.trailHistory);
  simulationStore.update({ trailHistory: nextTrailHistory });
}

function buildBulkUpdateConfirmation(count, mode) {
  const modeLabel = mode === "add" ? "add the entered deltas to" : mode === "multiply" ? "multiply the current values on" : "replace values on";
  return `Apply bulk changes to ${count} objects and ${modeLabel} the matching fields?`;
}

function applyBulkObjectChanges() {
  const objectCount = appState.objects.length;
  if (objectCount === 0) {
    showToast("Add at least one object before using bulk controls.", "error");
    return;
  }

  const mode = bulkApplyModeInput?.value === "add" ? "add" : bulkApplyModeInput?.value === "multiply" ? "multiply" : "replace";
  const gravityResult = parseBulkInputNumber(bulkGravityInput, "Gravity for all");
  const sizeResult = parseBulkInputNumber(bulkSizeInput, "Size scale");

  const parseResults = [gravityResult, sizeResult];
  const parseError = parseResults.find((result) => !result.ok);
  if (parseError) {
    showToast(parseError.message, "error");
    return;
  }

  const hasAnyInput = [gravityResult, sizeResult].some((result) => result.value !== null);
  if (!hasAnyInput) {
    showToast("Enter at least one bulk value before applying changes.", "error");
    return;
  }

  if (!window.confirm(buildBulkUpdateConfirmation(objectCount, mode))) {
    return;
  }

  const updatedObjects = appState.objects.map((object) => {
    let nextObject = { ...object };

    if (gravityResult.value !== null) {
      nextObject = applyObjectSourcePatch(nextObject, {
        gravity: applyModeToValue(nextObject.gravity, gravityResult.value, mode),
      });
    }

    if (sizeResult.value !== null) {
      nextObject = applyObjectSourcePatch(nextObject, {
        size: Math.max(0.1, applyModeToValue(nextObject.size, sizeResult.value, mode)),
      });
    }

    return recalculateDependentValues(nextObject);
  });

  simulationStore.update({ objects: updatedObjects });
  updateStatusBar();
  drawCurrentCanvasFrame();
  showToast(`Updated ${objectCount} objects.`, "success");
}

function applySelectedObjectChanges(options = {}) {
  const { showErrors = true, showSuccess = true, showNoChange = true } = options;

  const selectedObject = getSelectedObject();
  if (!selectedObject) {
    if (showErrors) {
      showToast("Select an object before applying edits.", "error");
    }
    return false;
  }

  const sizeResult = parseSelectedInputNumber(selectedSizeInput, "Size");

  const parseResults = [sizeResult];
  const parseError = parseResults.find((result) => !result.ok);
  if (parseError) {
    if (showErrors) {
      showToast(parseError.message, "error");
    }
    return false;
  }

  const sizeValue = sizeResult.value;

  if (sizeValue <= 0) {
    if (showErrors) {
      showToast("Size must be greater than zero.", "error");
    }
    return false;
  }

  const sizeChanged = hasValueChanged(sizeValue, selectedObject.size);

  if (!sizeChanged) {
    if (showNoChange) {
      showToast("No selected-object values changed.", "info");
    }
    return false;
  }

  let nextObject = selectedObject;

  if (sizeChanged) {
    nextObject = applyObjectSourcePatch(nextObject, { size: sizeValue });
  }

  const objectIndex = appState.objects.findIndex((object) => object.id === nextObject.id);
  if (objectIndex < 0) {
    if (showErrors) {
      showToast("Selected object no longer exists.", "error");
    }
    return false;
  }

  const updatedObjects = [...appState.objects];
  updatedObjects[objectIndex] = nextObject;
  simulationStore.update({ objects: updatedObjects });
  updateStatusBar();
  drawCurrentCanvasFrame();
  if (showSuccess) {
    showToast("Selected object updated.", "success");
  }

  return true;
}

function scheduleLiveSelectedObjectApply() {
  if (liveSelectedApplyTimer !== null) {
    window.clearTimeout(liveSelectedApplyTimer);
  }

  liveSelectedApplyTimer = window.setTimeout(() => {
    liveSelectedApplyTimer = null;
    applySelectedObjectChanges({
      showErrors: false,
      showSuccess: false,
      showNoChange: false,
    });
  }, LIVE_SELECTED_APPLY_DELAY_MS);
}

function openSelectedObjectEditor() {
  if (!selectedObjectEditor) {
    return;
  }

  selectedObjectEditor.hidden = false;
}

function closeSelectedObjectEditor() {
  if (!selectedObjectEditor) {
    return;
  }

  selectedObjectEditor.hidden = true;
}

function clearSelectedObjectState() {
  simulationStore.update({
    selectedObjectId: null,
    selectedObject: "None",
    draggingPointerId: null,
    draggingObjectId: null,
    dragVelocity: { vx: 0, vy: 0 },
    dragMomentumVelocity: { vx: 0, vy: 0 },
    lastDragPoint: null,
    lastDragTimestamp: 0,
    lastMomentumTimestamp: 0,
  });
  closeSelectedObjectEditor();
}

function handleDeleteSelectedObject() {
  const selectedObject = getSelectedObject();
  if (!selectedObject) {
    showToast("Select an object before deleting it.", "error");
    return;
  }

  const remainingObjects = appState.objects.filter((object) => object.id !== selectedObject.id);
  simulationStore.update({
    objects: remainingObjects,
    trailHistory: createTrailHistorySnapshot(remainingObjects, appState.trailHistory),
  });
  clearSelectedObjectState();
  updateStatusBar();
  drawCurrentCanvasFrame();
  showToast("Selected object deleted.", "success");
}

function handleDuplicateSelectedObject() {
  const selectedObject = getSelectedObject();
  if (!selectedObject) {
    showToast("Select an object before duplicating it.", "error");
    return;
  }

  const radius = getObjectCollisionRadius(selectedObject);
  const worldWidth = Math.max(1, appState.worldWidth || canvas?.clientWidth || 1);
  const worldHeight = Math.max(1, appState.worldHeight || canvas?.clientHeight || 1);
  const offset = Math.max(12, radius * 0.85);

  const duplicateObject = createPhysicsObject({
    ...selectedObject,
    id: generateObjectId(),
    position: {
      x: clamp(selectedObject.position.x + offset, radius, Math.max(radius, worldWidth - radius)),
      y: clamp(selectedObject.position.y + offset, radius, Math.max(radius, worldHeight - radius)),
    },
  });

  simulationStore.update({
    objects: [...appState.objects, duplicateObject],
    trailHistory: createTrailHistorySnapshot([...appState.objects, duplicateObject], appState.trailHistory),
    selectedObjectId: duplicateObject.id,
    selectedObject: `${duplicateObject.type} (${duplicateObject.id.slice(0, 8)})`,
  });
  openSelectedObjectEditor();
  updateStatusBar();
  drawCurrentCanvasFrame();
  showToast("Selected object duplicated.", "success");
}

function updateSelectedObjectPanel() {
  const selectedObject = getSelectedObject();
  const hasSelection = Boolean(selectedObject);

  if (selectedTypeValue) {
    selectedTypeValue.textContent = hasSelection ? selectedObject.type : "None";
  }
  if (selectedIdValue) {
    selectedIdValue.textContent = hasSelection ? selectedObject.id.slice(0, 8) : "None";
  }
  if (selectedSizeValue) {
    selectedSizeValue.textContent = hasSelection ? formatSelectedNumber(selectedObject.size) : "-";
  }
  if (selectedGravityValue) {
    selectedGravityValue.textContent = hasSelection ? formatSelectedNumber(selectedObject.gravity) : "-";
  }

  if (selectedDuplicateBtn) {
    selectedDuplicateBtn.disabled = !hasSelection;
  }
  if (selectedDeleteBtn) {
    selectedDeleteBtn.disabled = !hasSelection;
  }

  setInputValueIfNotFocused(selectedSizeInput, hasSelection ? String(selectedObject.size) : "");
}

function getCanvasRelativePoint(event) {
  if (!canvas) {
    return null;
  }

  const bounds = canvas.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
}

function findObjectAtPoint(pointX, pointY) {
  for (let index = appState.objects.length - 1; index >= 0; index -= 1) {
    const object = appState.objects[index];
    const radius = getObjectCollisionRadius(object);
    const dx = pointX - object.position.x;
    const dy = pointY - object.position.y;

    if (object.type === "cube") {
      if (Math.abs(dx) <= radius && Math.abs(dy) <= radius) {
        return object;
      }
      continue;
    }

    if (dx * dx + dy * dy <= radius * radius) {
      return object;
    }
  }

  return null;
}

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function handleCanvasPointerDown(event) {
  const point = getCanvasRelativePoint(event);
  if (!point) {
    return;
  }

  const selectedObject = findObjectAtPoint(point.x, point.y);
  if (!selectedObject) {
    simulationStore.update({
      selectedObjectId: null,
      selectedObject: "None",
      draggingPointerId: null,
      draggingObjectId: null,
      dragVelocity: { vx: 0, vy: 0 },
      dragMomentumVelocity: { vx: 0, vy: 0 },
      lastDragPoint: null,
      lastDragTimestamp: 0,
      lastMomentumTimestamp: 0,
    });
    closeSelectedObjectEditor();
    updateStatusBar();
    return;
  }

  event.preventDefault();
  if (canvas && typeof canvas.setPointerCapture === "function") {
    canvas.setPointerCapture(event.pointerId);
  }

  simulationStore.update({
    selectedObjectId: selectedObject.id,
    selectedObject: `${selectedObject.type} (${selectedObject.id.slice(0, 8)})`,
    draggingPointerId: event.pointerId,
    draggingObjectId: selectedObject.id,
    dragOffset: {
      x: point.x - selectedObject.position.x,
      y: point.y - selectedObject.position.y,
    },
    dragVelocity: { vx: 0, vy: 0 },
    dragMomentumVelocity: { vx: 0, vy: 0 },
    lastDragPoint: point,
    lastDragTimestamp: event.timeStamp,
    lastMomentumTimestamp: event.timeStamp,
  });
  openSelectedObjectEditor();
  drawCurrentCanvasFrame();
  updateStatusBar();
}

function handleCanvasPointerMove(event) {
  if (appState.draggingPointerId !== event.pointerId || !appState.draggingObjectId) {
    return;
  }

  const point = getCanvasRelativePoint(event);
  if (!point) {
    return;
  }

  event.preventDefault();

  const objectIndex = appState.objects.findIndex((object) => object.id === appState.draggingObjectId);
  if (objectIndex < 0) {
    simulationStore.update({
      draggingPointerId: null,
      draggingObjectId: null,
    });
    return;
  }

  const objectToMove = appState.objects[objectIndex];
  const radius = getObjectCollisionRadius(objectToMove);
  const worldWidth = Math.max(1, appState.worldWidth || canvas?.clientWidth || 1);
  const worldHeight = Math.max(1, appState.worldHeight || canvas?.clientHeight || 1);

  const nextX = clamp(point.x - appState.dragOffset.x, radius, Math.max(radius, worldWidth - radius));
  const nextY = clamp(point.y - appState.dragOffset.y, radius, Math.max(radius, worldHeight - radius));

  const previousPoint = appState.lastDragPoint;
  const previousTimestamp = appState.lastDragTimestamp;
  let estimatedVelocity = appState.dragVelocity;
  let nextMomentumVelocity = appState.dragMomentumVelocity;
  const minMomentumSpeed = 20;

  if (previousPoint && Number.isFinite(previousTimestamp)) {
    const deltaMs = event.timeStamp - previousTimestamp;
    if (deltaMs > 0) {
      const rawVx = ((point.x - previousPoint.x) / deltaMs) * 1000;
      const rawVy = ((point.y - previousPoint.y) / deltaMs) * 1000;
      const maxVelocity = 1800;
      const smoothing = 0.25;
      const targetVelocity = {
        vx: clamp(rawVx, -maxVelocity, maxVelocity),
        vy: clamp(rawVy, -maxVelocity, maxVelocity),
      };
      estimatedVelocity = {
        vx: appState.dragVelocity.vx + (targetVelocity.vx - appState.dragVelocity.vx) * smoothing,
        vy: appState.dragVelocity.vy + (targetVelocity.vy - appState.dragVelocity.vy) * smoothing,
      };

      const speed = Math.hypot(estimatedVelocity.vx, estimatedVelocity.vy);
      if (speed >= minMomentumSpeed) {
        nextMomentumVelocity = estimatedVelocity;
      }
    }
  }

  const movedObject = applyObjectSourcePatch(objectToMove, {
    position: { x: nextX, y: nextY },
    velocity: estimatedVelocity,
    acceleration: { ax: 0, ay: 0 },
  });

  const updatedObjects = [...appState.objects];
  updatedObjects[objectIndex] = movedObject;

  simulationStore.update({
    objects: updatedObjects,
    trailHistory: appState.trailsEnabled ? createTrailHistorySnapshot(updatedObjects, appState.trailHistory) : appState.trailHistory,
    dragVelocity: estimatedVelocity,
    dragMomentumVelocity: nextMomentumVelocity,
    lastDragPoint: point,
    lastDragTimestamp: event.timeStamp,
    lastMomentumTimestamp:
      Math.hypot(nextMomentumVelocity.vx, nextMomentumVelocity.vy) >= minMomentumSpeed
        ? event.timeStamp
        : appState.lastMomentumTimestamp,
  });
  drawCurrentCanvasFrame();
  updateStatusBar();
}

function handleCanvasPointerRelease(event) {
  if (appState.draggingPointerId !== event.pointerId) {
    return;
  }

  if (canvas && typeof canvas.releasePointerCapture === "function" && canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  const releaseVelocity = appState.dragVelocity;
  const releaseMomentumVelocity = appState.dragMomentumVelocity;
  const objectIndex = appState.objects.findIndex((object) => object.id === appState.draggingObjectId);

  if (objectIndex >= 0) {
    const objectToRelease = appState.objects[objectIndex];
    const releasedObject = applyObjectSourcePatch(objectToRelease, {
      velocity: {
        vx: Number.isFinite(releaseMomentumVelocity.vx) ? releaseMomentumVelocity.vx : Number.isFinite(releaseVelocity.vx) ? releaseVelocity.vx : 0,
        vy: Number.isFinite(releaseMomentumVelocity.vy) ? releaseMomentumVelocity.vy : Number.isFinite(releaseVelocity.vy) ? releaseVelocity.vy : 0,
      },
    });

    const updatedObjects = [...appState.objects];
    updatedObjects[objectIndex] = releasedObject;
    simulationStore.update({ objects: updatedObjects });
  }

  simulationStore.update({
    draggingPointerId: null,
    draggingObjectId: null,
    dragVelocity: { vx: 0, vy: 0 },
    dragMomentumVelocity: { vx: 0, vy: 0 },
    lastDragPoint: null,
    lastDragTimestamp: 0,
    lastMomentumTimestamp: 0,
  });
  drawCurrentCanvasFrame();
}

function parseOptionalNumber(inputElement) {
  if (!inputElement) {
    return null;
  }
  const rawValue = inputElement.value.trim();
  if (rawValue === "") {
    return null;
  }
  const parsedValue = Number.parseFloat(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
}

function getRandomSpawnPositionForSize(size) {
  const worldWidth = Math.max(1, appState.worldWidth || canvas?.clientWidth || 1);
  const worldHeight = Math.max(1, appState.worldHeight || canvas?.clientHeight || 1);
  const radius = Math.max(2, size / 2);

  const minX = radius;
  const maxX = Math.max(minX, worldWidth - radius);
  const minY = radius;
  const maxY = Math.max(minY, worldHeight - radius);

  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY),
  };
}

function getCenterSpawnPosition() {
  const worldWidth = Math.max(1, appState.worldWidth || canvas?.clientWidth || 1);
  const worldHeight = Math.max(1, appState.worldHeight || canvas?.clientHeight || 1);
  return {
    x: worldWidth / 2,
    y: worldHeight / 2,
  };
}

function updateRandomSpawnPreview() {
  if (!randomSpawnPreview) {
    return;
  }

  if (!appState.randomSpawnEnabled) {
    const center = getCenterSpawnPosition();
    randomSpawnPreview.textContent = `Spawn preview: center (${center.x.toFixed(0)}, ${center.y.toFixed(0)})`;
    return;
  }

  const sizeValue = parseOptionalNumber(sizeInput);
  const effectiveSize = Number.isFinite(sizeValue) && sizeValue > 0 ? sizeValue : 50;
  const previewPosition = getRandomSpawnPositionForSize(effectiveSize);
  simulationStore.update({ pendingSpawnPosition: previewPosition });
  randomSpawnPreview.textContent = `Spawn preview: random (${previewPosition.x.toFixed(0)}, ${previewPosition.y.toFixed(0)})`;
}

function handleRandomSpawnToggle(event) {
  simulationStore.update({ randomSpawnEnabled: event.target.checked });
  updateRandomSpawnPreview();
}

function validateCreateObjectForm() {
  const parsedSize = parseOptionalNumber(sizeInput);
  const gravity = parseOptionalNumber(createGravityInput);

  const size = parsedSize === null ? 50 : parsedSize;

  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, message: "Size must be a positive number." };
  }
  if (gravity !== null && !Number.isFinite(gravity)) {
    return { ok: false, message: "Gravity must be a valid number." };
  }

  return {
    ok: true,
    values: {
      size,
      gravity: gravity ?? appState.currentGravity,
    },
  };
}

function drawSimulationObjects(ctx, objects) {
  objects.forEach((object) => {
    const radius = getObjectCollisionRadius(object);
    const isSelected = object.id === appState.selectedObjectId;
    ctx.fillStyle = object.color || "#0f766e";
    ctx.strokeStyle = "#0b4f4a";
    ctx.lineWidth = 1.25;
    const side = radius * 2;

    if (object.type === "sphere") {
      ctx.beginPath();
      ctx.arc(object.position.x, object.position.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.rect(object.position.x - radius, object.position.y - radius, side, side);
      ctx.fill();
      ctx.stroke();
    }

    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -((performance.now() / 24) % 12);

      if (object.type === "sphere") {
        ctx.beginPath();
        ctx.arc(object.position.x, object.position.y, radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const highlightSide = side + 12;
        ctx.beginPath();
        ctx.rect(object.position.x - radius - 6, object.position.y - radius - 6, highlightSide, highlightSide);
        ctx.stroke();
      }

      ctx.restore();
    }
  });
}

function drawObjectTrails(ctx, objects) {
  objects.forEach((object) => {
    const path = appState.trailHistory[object.id];
    if (!Array.isArray(path) || path.length < 2) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = "rgba(15, 118, 110, 0.32)";
    ctx.lineWidth = object.id === appState.selectedObjectId ? 2 : 1.35;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let index = 1; index < path.length; index += 1) {
      ctx.lineTo(path[index].x, path[index].y);
    }
    ctx.stroke();
    ctx.restore();
  });
}

function handleAddObject() {
  const validation = validateCreateObjectForm();
  if (!validation.ok) {
    showToast(validation.message, "error");
    return;
  }

  const selectedType = SHAPE_TYPES.includes(shapeTypeInput?.value) ? shapeTypeInput.value : "cube";
  const effectiveSize = validation.values.size;

  const spawnPosition = appState.randomSpawnEnabled
    ? getRandomSpawnPositionForSize(effectiveSize)
    : getCenterSpawnPosition();

  const newObject = createPhysicsObject({
    type: selectedType,
    size: effectiveSize,
    gravity: validation.values.gravity,
    position: spawnPosition,
    color: selectedType === "sphere" ? "#0f766e" : "#0b6b5d",
  });

  const nextObjects = [...appState.objects, newObject];
  simulationStore.update({
    objects: nextObjects,
    trailHistory: createTrailHistorySnapshot(nextObjects, appState.trailHistory),
  });
  updateStatusBar();
  initSimulationCanvas();
  updateRandomSpawnPreview();
  showToast("Object added to simulation.", "success");
}

function getRandomSpawnPosition() {
  const worldWidth = Math.max(1, appState.worldWidth || canvas?.clientWidth || 1);
  const worldHeight = Math.max(1, appState.worldHeight || canvas?.clientHeight || 1);
  const sizeValue = Number.parseFloat(sizeInput?.value);
  const radius = Math.max(8, Number.isFinite(sizeValue) ? sizeValue / 2 : 10);

  const minX = radius;
  const maxX = Math.max(minX, worldWidth - radius);
  const minY = radius;
  const maxY = Math.max(minY, worldHeight - radius);

  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY),
  };
}

function updateRandomSpawnPreview() {
  if (!randomSpawnPreview) {
    return;
  }

  if (!appState.randomSpawnEnabled) {
    randomSpawnPreview.textContent = "Spawn preview: center";
    return;
  }

  const spawn = getRandomSpawnPosition();
  simulationStore.update({ pendingSpawnPosition: spawn });
  randomSpawnPreview.textContent = `Spawn preview: (${spawn.x.toFixed(0)}, ${spawn.y.toFixed(0)})`;
}

function handleRandomSpawnToggle(event) {
  simulationStore.update({ randomSpawnEnabled: event.target.checked });
  updateRandomSpawnPreview();
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
  simStateLabel.textContent = `State: ${stateText} | Steps: ${appState.stepCount} | Speed: ${appState.timeScale.toFixed(2)}x`;
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
  const scaledDeltaSeconds = rawDeltaSeconds * appState.timeScale;
  const deltaSeconds = Math.max(0, Math.min(scaledDeltaSeconds, 0.05));

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
    selectedObjectId: null,
    draggingPointerId: null,
    draggingObjectId: null,
    dragVelocity: { vx: 0, vy: 0 },
    dragMomentumVelocity: { vx: 0, vy: 0 },
    lastDragPoint: null,
    lastDragTimestamp: 0,
    lastMomentumTimestamp: 0,
    trailHistory: {},
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

function handleCollisionToggleChange(event) {
  simulationStore.update({ collisionsEnabled: event.target.checked });
}

function handleTrailsToggleChange(event) {
  const enabled = event.target.checked;
  simulationStore.update({ trailsEnabled: enabled });

  if (!enabled) {
    simulationStore.update({ trailHistory: {} });
    drawCurrentCanvasFrame();
    return;
  }

  ensureTrailHistoryForObjects(appState.objects);
  drawCurrentCanvasFrame();
}

function getObjectCollisionRadius(object) {
  if (object.type === "sphere") {
    return Math.max(0.1, object.size / 2);
  }
  return Math.max(0.1, object.size / 2);
}

function getCollisionInertiaProxy(object) {
  return Math.max(0.1, object.size * object.size);
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

      const inverseInertiaA = objectA.locked ? 0 : 1 / getCollisionInertiaProxy(objectA);
      const inverseInertiaB = objectB.locked ? 0 : 1 / getCollisionInertiaProxy(objectB);
      const inverseInertiaTotal = inverseInertiaA + inverseInertiaB;

      if (inverseInertiaTotal <= 0) {
        continue;
      }

      const correctionA = (overlap * inverseInertiaA) / inverseInertiaTotal;
      const correctionB = (overlap * inverseInertiaB) / inverseInertiaTotal;

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

      const impulseScalar = (-(1 + restitution) * velocityAlongNormal) / inverseInertiaTotal;
      const impulseX = impulseScalar * normalX;
      const impulseY = impulseScalar * normalY;

      if (!objectA.locked) {
        objectA.velocity.vx -= impulseX * inverseInertiaA;
        objectA.velocity.vy -= impulseY * inverseInertiaA;
      }
      if (!objectB.locked) {
        objectB.velocity.vx += impulseX * inverseInertiaB;
        objectB.velocity.vy += impulseY * inverseInertiaB;
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
    const normalizedObject = recalculateDependentValues(object);

    if (appState.draggingObjectId && normalizedObject.id === appState.draggingObjectId) {
      return {
        ...normalizedObject,
        position: { ...normalizedObject.position },
        velocity: { ...normalizedObject.velocity },
      };
    }

    if (normalizedObject.locked) {
      return {
        ...normalizedObject,
        position: { ...normalizedObject.position },
        velocity: { ...normalizedObject.velocity },
      };
    }

    const ax = Number.isFinite(normalizedObject.acceleration.ax) ? normalizedObject.acceleration.ax : 0;
    const baseAy = Number.isFinite(normalizedObject.acceleration.ay) ? normalizedObject.acceleration.ay : 0;
    const gravityAcceleration = Number.isFinite(normalizedObject.gravity) ? normalizedObject.gravity : 0;
    const ay = baseAy + gravityAcceleration;

    const nextVx = normalizedObject.velocity.vx + ax * deltaSeconds;
    const nextVy = normalizedObject.velocity.vy + ay * deltaSeconds;

    const integratedObject = {
      ...normalizedObject,
      acceleration: {
        ax,
        ay,
      },
      velocity: {
        vx: nextVx,
        vy: nextVy,
      },
      position: {
        x: normalizedObject.position.x + nextVx * deltaSeconds,
        y: normalizedObject.position.y + nextVy * deltaSeconds,
      },
    };

    return applyWorldBoundsAndFloorCollision(integratedObject, worldWidth, worldHeight);
  });

  const updatedObjects = appState.collisionsEnabled ? resolveObjectCollisions(boundedObjects) : boundedObjects;
  const nextTrailHistory = appState.trailsEnabled
    ? createTrailHistorySnapshot(updatedObjects, appState.trailHistory)
    : appState.trailHistory;

  simulationStore.update({
    objects: updatedObjects,
    trailHistory: nextTrailHistory,
  });
  updateStatusBar();
}

function handleGravityInputChange(event) {
  const parsedValue = Number.parseFloat(event.target.value);
  if (Number.isNaN(parsedValue)) {
    showToast("Gravity must be a valid number.", "error");
    return;
  }

  const clampedValue = Math.min(30, Math.max(0, parsedValue));
  if (gravityInput) {
    gravityInput.value = String(clampedValue);
  }
  if (gravitySliderInput) {
    gravitySliderInput.value = String(clampedValue);
  }
  if (gravityControlValue) {
    gravityControlValue.textContent = `Global gravity: ${clampedValue.toFixed(2)} m/s²`;
  }

  const updatedObjects = appState.objects.map((object) => applyObjectSourcePatch(object, { gravity: clampedValue }));

  simulationStore.update({
    currentGravity: clampedValue,
    objects: updatedObjects,
  });
  updateStatusBar();
}

function handleTimeScaleInputChange(event) {
  const parsedValue = Number.parseFloat(event.target.value);
  if (!Number.isFinite(parsedValue)) {
    showToast("Time scale must be a valid number.", "error");
    return;
  }

  const clampedValue = Math.min(3, Math.max(0.25, parsedValue));
  if (timeScaleInput) {
    timeScaleInput.value = String(clampedValue);
  }
  simulationStore.update({ timeScale: clampedValue });

  if (timeScaleValue) {
    timeScaleValue.textContent = `Simulation speed: ${clampedValue.toFixed(2)}x`;
  }

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

  if (appState.trailsEnabled) {
    drawObjectTrails(ctx, appState.objects);
  }

  drawSimulationObjects(ctx, appState.objects);
}

function drawCurrentCanvasFrame() {
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const width = Math.max(1, appState.worldWidth || canvas.clientWidth || 1);
  const height = Math.max(1, appState.worldHeight || canvas.clientHeight || 1);
  drawCanvasPlaceholder(ctx, width, height);
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
if (gravitySliderInput) {
  gravitySliderInput.addEventListener("input", handleGravityInputChange);
  gravitySliderInput.addEventListener("change", handleGravityInputChange);
}
if (timeScaleInput) {
  timeScaleInput.addEventListener("input", handleTimeScaleInputChange);
  timeScaleInput.addEventListener("change", handleTimeScaleInputChange);
}
if (collisionToggleInput) {
  collisionToggleInput.addEventListener("change", handleCollisionToggleChange);
}
if (trailsToggleInput) {
  trailsToggleInput.addEventListener("change", handleTrailsToggleChange);
}
if (randomSpawnToggle) {
  randomSpawnToggle.addEventListener("change", handleRandomSpawnToggle);
}
if (sizeInput) {
  sizeInput.addEventListener("input", updateRandomSpawnPreview);
}
if (addObjectBtn) {
  addObjectBtn.addEventListener("click", handleAddObject);
}
if (bulkApplyBtn) {
  bulkApplyBtn.addEventListener("click", applyBulkObjectChanges);
}
if (selectedDuplicateBtn) {
  selectedDuplicateBtn.addEventListener("click", handleDuplicateSelectedObject);
}
if (selectedDeleteBtn) {
  selectedDeleteBtn.addEventListener("click", handleDeleteSelectedObject);
}

if (selectedSizeInput) {
  selectedSizeInput.addEventListener("input", scheduleLiveSelectedObjectApply);
}

if (canvas) {
  canvas.addEventListener("pointerdown", handleCanvasPointerDown);
  canvas.addEventListener("pointermove", handleCanvasPointerMove);
  canvas.addEventListener("pointerup", handleCanvasPointerRelease);
  canvas.addEventListener("pointercancel", handleCanvasPointerRelease);
}

window.addEventListener("resize", initSimulationCanvas);
window.addEventListener("load", initSimulationCanvas);

updateToolbarButtons();
updateToolbarStateLabel();
updateStatusBar();
if (gravityInput) {
  gravityInput.value = String(appState.currentGravity);
}
if (gravitySliderInput) {
  gravitySliderInput.value = String(appState.currentGravity);
}
if (gravityControlValue) {
  gravityControlValue.textContent = `Global gravity: ${appState.currentGravity.toFixed(2)} m/s²`;
}
if (timeScaleValue) {
  timeScaleValue.textContent = `Simulation speed: ${appState.timeScale.toFixed(2)}x`;
}
if (collisionToggleInput) {
  collisionToggleInput.checked = appState.collisionsEnabled;
}
if (trailsToggleInput) {
  trailsToggleInput.checked = appState.trailsEnabled;
}
updateRandomSpawnPreview();
startFpsTracker();
showToast("Validation messages will appear here.", "info");

// Create a ready-to-use model instance template for upcoming object workflows.
const objectModelTemplate = createPhysicsObject();
void objectModelTemplate;

console.log("Gravity Simulator scaffold ready", appState);
