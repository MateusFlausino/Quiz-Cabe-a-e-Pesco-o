const SLIDE_COUNT = 13;
const STORAGE_KEY = "cabeca-pescoco-quiz-v1";
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

const slides = Array.from({ length: SLIDE_COUNT }, (_, index) => ({
  title: `Lâmina ${index + 1}`,
  src: `assets/slides/slide-${String(index + 1).padStart(2, "0")}.png`,
}));

const els = {
  slideSelect: document.querySelector("#slideSelect"),
  prevSlide: document.querySelector("#prevSlide"),
  nextSlide: document.querySelector("#nextSlide"),
  slideImage: document.querySelector("#slideImage"),
  overlay: document.querySelector("#overlay"),
  imageStage: document.querySelector("#imageStage"),
  stageFrame: document.querySelector(".stage-frame"),
  zoomOut: document.querySelector("#zoomOut"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomRange: document.querySelector("#zoomRange"),
  resetZoom: document.querySelector("#resetZoom"),
  tabs: document.querySelectorAll(".tab"),
  quizPanel: document.querySelector("#quizPanel"),
  editPanel: document.querySelector("#editPanel"),
  studyPanel: document.querySelector("#studyPanel"),
  quizTitle: document.querySelector("#quizTitle"),
  progressText: document.querySelector("#progressText"),
  scoreText: document.querySelector("#scoreText"),
  answerInput: document.querySelector("#answerInput"),
  checkAnswer: document.querySelector("#checkAnswer"),
  nextQuestion: document.querySelector("#nextQuestion"),
  revealAnswer: document.querySelector("#revealAnswer"),
  feedback: document.querySelector("#feedback"),
  toolButtons: document.querySelectorAll("[data-tool]"),
  pinLabel: document.querySelector("#pinLabel"),
  pinAliases: document.querySelector("#pinAliases"),
  savePin: document.querySelector("#savePin"),
  deleteSelected: document.querySelector("#deleteSelected"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  pinList: document.querySelector("#pinList"),
  studyList: document.querySelector("#studyList"),
};

const state = {
  mode: "quiz",
  tool: "pin",
  slideIndex: 0,
  selectedId: null,
  quizIndex: 0,
  checkedPins: new Map(),
  draftMask: null,
  dragPinId: null,
  zoom: 1,
};

let data = loadData();

function emptySlideData() {
  return { pins: [], masks: [] };
}

function loadData() {
  const fallback = {
    version: 1,
    slides: slides.map(() => emptySlideData()),
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved?.slides) return fallback;
    return {
      ...fallback,
      ...saved,
      slides: slides.map((_, index) => ({
        ...emptySlideData(),
        ...(saved.slides[index] || {}),
        pins: saved.slides[index]?.pins || [],
        masks: saved.slides[index]?.masks || [],
      })),
    };
  } catch {
    return fallback;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function currentSlideData() {
  return data.slides[state.slideIndex];
}

function selectedPin() {
  return currentSlideData().pins.find((pin) => pin.id === state.selectedId) || null;
}

function selectedMask() {
  return currentSlideData().masks.find((mask) => mask.id === state.selectedId) || null;
}

function activeQuizPin() {
  const pins = currentSlideData().pins;
  return pins[state.quizIndex] || null;
}

function normalizeAnswer(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularizeToken(token) {
  if (token.length > 4 && token.endsWith("ais")) return `${token.slice(0, -3)}al`;
  if (token.length > 4 && token.endsWith("eis")) return `${token.slice(0, -3)}el`;
  if (token.length > 4 && token.endsWith("oes")) return `${token.slice(0, -3)}ao`;
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function answerForms(value) {
  const base = normalizeAnswer(value);
  const forms = new Set();
  if (!base) return forms;

  const optionalWords = new Set(["a", "as", "o", "os", "de", "da", "das", "do", "dos", "osso", "ossos"]);
  const tokens = base.split(" ").filter(Boolean);
  const compactTokens = tokens.filter((token) => !optionalWords.has(token));
  const singularTokens = tokens.map(singularizeToken);
  const compactSingularTokens = compactTokens.map(singularizeToken);

  forms.add(base);
  forms.add(singularTokens.join(" "));
  if (compactTokens.length) forms.add(compactTokens.join(" "));
  if (compactSingularTokens.length) forms.add(compactSingularTokens.join(" "));

  return forms;
}

function acceptedAnswers(pin) {
  return [pin.label, ...(pin.aliases || [])].reduce((forms, value) => {
    answerForms(value).forEach((form) => forms.add(form));
    return forms;
  }, new Set());
}

function isAnswerCorrect(answer, pin) {
  const answerOptions = answerForms(answer);
  const accepted = acceptedAnswers(pin);
  return [...answerOptions].some((option) => accepted.has(option));
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function setMode(mode) {
  state.mode = mode;
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.mode === mode));
  els.quizPanel.classList.toggle("is-hidden", mode !== "quiz");
  els.editPanel.classList.toggle("is-hidden", mode !== "edit");
  els.studyPanel.classList.toggle("is-hidden", mode !== "study");
  state.selectedId = mode === "quiz" ? activeQuizPin()?.id || null : state.selectedId;
  render();
}

function setSlide(index) {
  state.slideIndex = Math.max(0, Math.min(slides.length - 1, index));
  state.quizIndex = 0;
  state.checkedPins.clear();
  state.selectedId = state.mode === "quiz" ? activeQuizPin()?.id || null : null;
  els.slideSelect.value = String(state.slideIndex);
  els.slideImage.src = slides[state.slideIndex].src;
  els.answerInput.value = "";
  setFeedback("");
  render();
}

function setTool(tool) {
  state.tool = tool;
  els.toolButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.tool === tool));
}

function setZoom(value) {
  const roundedValue = Math.round(Number(value) * 10) / 10;
  state.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, roundedValue));
  applyZoom();
}

function applyZoom() {
  const zoom = state.zoom;
  const pinSize = Math.max(12, Math.round(22 / Math.sqrt(zoom)));
  const pinFontSize = Math.max(7, Math.round(pinSize * 0.46));
  els.imageStage.style.width = `min(${Math.round(1050 * zoom)}px, ${Math.round(100 * zoom)}%)`;
  els.imageStage.style.setProperty("--pin-size", `${pinSize}px`);
  els.imageStage.style.setProperty("--pin-font-size", `${pinFontSize}px`);
  els.zoomRange.value = String(zoom);
  els.resetZoom.textContent = `${Math.round(zoom * 100)}%`;
}

function zoomFromWheel(event) {
  event.preventDefault();

  const oldWidth = els.imageStage.offsetWidth || 1;
  const oldHeight = els.imageStage.offsetHeight || 1;
  const frameRect = els.stageFrame.getBoundingClientRect();
  const pointerX = event.clientX - frameRect.left;
  const pointerY = event.clientY - frameRect.top;
  const ratioX = (els.stageFrame.scrollLeft + pointerX) / oldWidth;
  const ratioY = (els.stageFrame.scrollTop + pointerY) / oldHeight;
  const direction = event.deltaY < 0 ? 1 : -1;

  setZoom(state.zoom + direction * ZOOM_STEP);

  const newWidth = els.imageStage.offsetWidth || oldWidth;
  const newHeight = els.imageStage.offsetHeight || oldHeight;
  els.stageFrame.scrollLeft = ratioX * newWidth - pointerX;
  els.stageFrame.scrollTop = ratioY * newHeight - pointerY;
}

function pointFromEvent(event) {
  const rect = els.overlay.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  };
}

function render() {
  renderOverlay();
  renderPanels();
}

function renderOverlay() {
  const slideData = currentSlideData();
  const activePin = activeQuizPin();
  els.overlay.innerHTML = "";

  slideData.masks.forEach((mask) => {
    const node = document.createElement("button");
    node.type = "button";
    node.className = `mask ${mask.id === state.selectedId ? "is-selected" : ""}`;
    node.style.left = `${mask.x * 100}%`;
    node.style.top = `${mask.y * 100}%`;
    node.style.width = `${mask.w * 100}%`;
    node.style.height = `${mask.h * 100}%`;
    node.title = "Máscara";
    node.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.mode === "edit") {
        state.selectedId = mask.id;
        render();
      }
    });
    els.overlay.appendChild(node);
  });

  if (state.draftMask) {
    const node = document.createElement("div");
    node.className = "mask is-selected";
    node.style.left = `${state.draftMask.x * 100}%`;
    node.style.top = `${state.draftMask.y * 100}%`;
    node.style.width = `${state.draftMask.w * 100}%`;
    node.style.height = `${state.draftMask.h * 100}%`;
    els.overlay.appendChild(node);
  }

  slideData.pins.forEach((pin, index) => {
    const button = document.createElement("button");
    const isActive = state.mode === "quiz" ? activePin?.id === pin.id : state.selectedId === pin.id;
    button.type = "button";
    button.className = `pin ${isActive ? "is-active" : ""} ${state.mode === "quiz" && !isActive ? "is-dim" : ""}`;
    button.style.left = `${pin.x * 100}%`;
    button.style.top = `${pin.y * 100}%`;
    button.textContent = String(index + 1);
    button.title = pin.label || `Pino ${index + 1}`;

    button.addEventListener("pointerdown", (event) => {
      if (state.mode !== "edit") return;
      event.stopPropagation();
      state.dragPinId = pin.id;
      state.selectedId = pin.id;
      button.setPointerCapture(event.pointerId);
      fillPinForm(pin);
      renderPanels();
    });

    button.addEventListener("pointermove", (event) => {
      if (state.dragPinId !== pin.id) return;
      const point = pointFromEvent(event);
      pin.x = point.x;
      pin.y = point.y;
      button.style.left = `${pin.x * 100}%`;
      button.style.top = `${pin.y * 100}%`;
      saveData();
    });

    button.addEventListener("pointerup", () => {
      state.dragPinId = null;
    });

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.mode === "quiz") {
        state.quizIndex = index;
        state.selectedId = pin.id;
        els.answerInput.value = "";
        setFeedback("");
      } else {
        state.selectedId = pin.id;
        fillPinForm(pin);
      }
      render();
    });

    els.overlay.appendChild(button);

    if (state.mode === "study" && pin.label) {
      const label = document.createElement("div");
      label.className = "pin-label";
      label.style.left = `${pin.x * 100}%`;
      label.style.top = `${pin.y * 100}%`;
      label.textContent = pin.label;
      els.overlay.appendChild(label);
    }
  });
}

function renderPanels() {
  renderQuizPanel();
  renderEditPanel();
  renderStudyPanel();
}

function renderQuizPanel() {
  const pins = currentSlideData().pins;
  const pin = activeQuizPin();
  const correct = pins.filter((pinItem) => state.checkedPins.get(pinItem.id)).length;
  els.progressText.textContent = pins.length ? `${Math.min(state.quizIndex + 1, pins.length)}/${pins.length}` : "0/0";
  els.scoreText.textContent = `${correct} acertos`;
  els.quizTitle.textContent = pin ? `Pino ${state.quizIndex + 1}` : "Sem pinos";
  els.answerInput.disabled = !pin;
  els.checkAnswer.disabled = !pin;
  els.nextQuestion.disabled = !pin;
  els.revealAnswer.disabled = !pin;

  if (!pin) {
    els.answerInput.value = "";
    setFeedback("");
  }
}

function renderEditPanel() {
  const slideData = currentSlideData();
  const pin = selectedPin();
  const mask = selectedMask();
  els.deleteSelected.disabled = !pin && !mask;

  if (!pin && !mask) {
    els.pinLabel.value = "";
    els.pinAliases.value = "";
  }

  els.pinLabel.disabled = !pin;
  els.pinAliases.disabled = !pin;
  els.savePin.disabled = !pin;

  els.pinList.innerHTML = "";
  if (!slideData.pins.length && !slideData.masks.length) {
    els.pinList.innerHTML = `<div class="pin-row"><span class="pin-badge">+</span><strong>Clique na imagem para criar</strong></div>`;
    return;
  }

  slideData.pins.forEach((pinItem, index) => {
    els.pinList.appendChild(listRow({
      badge: String(index + 1),
      title: pinItem.label || "Sem nome",
      sub: "Pino",
      active: pinItem.id === state.selectedId,
      onClick: () => {
        state.selectedId = pinItem.id;
        fillPinForm(pinItem);
        render();
      },
    }));
  });

  slideData.masks.forEach((maskItem, index) => {
    els.pinList.appendChild(listRow({
      badge: "M",
      title: `Máscara ${index + 1}`,
      sub: "Cobre respostas na imagem",
      active: maskItem.id === state.selectedId,
      onClick: () => {
        state.selectedId = maskItem.id;
        render();
      },
    }));
  });
}

function renderStudyPanel() {
  const pins = currentSlideData().pins;
  els.studyList.innerHTML = "";
  if (!pins.length) {
    els.studyList.innerHTML = `<div class="pin-row"><span class="pin-badge">0</span><strong>Nenhum pino cadastrado</strong></div>`;
    return;
  }

  pins.forEach((pin, index) => {
    els.studyList.appendChild(listRow({
      badge: String(index + 1),
      title: pin.label || "Sem nome",
      sub: (pin.aliases || []).join(", "),
      active: false,
      onClick: () => {
        state.selectedId = pin.id;
        render();
      },
    }));
  });
}

function listRow({ badge, title, sub, active, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `pin-row ${active ? "is-active" : ""}`;
  button.innerHTML = `
    <span class="pin-badge">${badge}</span>
    <span>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(sub || "")}</span>
    </span>
  `;
  button.addEventListener("click", onClick);
  return button;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function fillPinForm(pin) {
  els.pinLabel.value = pin?.label || "";
  els.pinAliases.value = (pin?.aliases || []).join(", ");
}

function setFeedback(message, type = "") {
  els.feedback.textContent = message;
  els.feedback.className = `feedback ${type}`.trim();
}

function addPin(point) {
  const slideData = currentSlideData();
  const pin = {
    id: uid("pin"),
    x: point.x,
    y: point.y,
    label: "",
    aliases: [],
  };
  slideData.pins.push(pin);
  state.selectedId = pin.id;
  fillPinForm(pin);
  saveData();
  render();
  els.pinLabel.focus();
}

function beginMask(point) {
  state.draftMask = { x: point.x, y: point.y, w: 0, h: 0, originX: point.x, originY: point.y };
}

function updateMask(point) {
  if (!state.draftMask) return;
  const originX = state.draftMask.originX;
  const originY = state.draftMask.originY;
  state.draftMask.x = Math.min(originX, point.x);
  state.draftMask.y = Math.min(originY, point.y);
  state.draftMask.w = Math.abs(point.x - originX);
  state.draftMask.h = Math.abs(point.y - originY);
  renderOverlay();
}

function commitMask() {
  if (!state.draftMask) return;
  const { x, y, w, h } = state.draftMask;
  state.draftMask = null;
  if (w < 0.01 || h < 0.01) {
    renderOverlay();
    return;
  }
  const mask = { id: uid("mask"), x, y, w, h };
  currentSlideData().masks.push(mask);
  state.selectedId = mask.id;
  saveData();
  render();
}

function checkAnswer() {
  const pin = activeQuizPin();
  if (!pin) return;
  const isCorrect = isAnswerCorrect(els.answerInput.value, pin);
  state.checkedPins.set(pin.id, isCorrect);

  if (isCorrect) {
    setFeedback("Correto.", "ok");
  } else {
    setFeedback("Ainda não. Revise a estrutura e tente novamente.", "bad");
  }

  renderQuizPanel();
}

function nextQuestion() {
  const pins = currentSlideData().pins;
  if (!pins.length) return;
  state.quizIndex = (state.quizIndex + 1) % pins.length;
  state.selectedId = activeQuizPin()?.id || null;
  els.answerInput.value = "";
  setFeedback("");
  render();
  els.answerInput.focus();
}

function revealAnswer() {
  const pin = activeQuizPin();
  if (!pin) return;
  setFeedback(pin.label || "Pino sem resposta cadastrada.");
}

function deleteSelected() {
  const slideData = currentSlideData();
  const pinIndex = slideData.pins.findIndex((pin) => pin.id === state.selectedId);
  if (pinIndex >= 0) {
    state.checkedPins.delete(slideData.pins[pinIndex].id);
    slideData.pins.splice(pinIndex, 1);
    state.quizIndex = Math.min(state.quizIndex, Math.max(0, slideData.pins.length - 1));
  } else {
    const maskIndex = slideData.masks.findIndex((mask) => mask.id === state.selectedId);
    if (maskIndex >= 0) slideData.masks.splice(maskIndex, 1);
  }
  state.selectedId = null;
  saveData();
  render();
}

function saveSelectedPin() {
  const pin = selectedPin();
  if (!pin) return;
  pin.label = els.pinLabel.value.trim();
  pin.aliases = els.pinAliases.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  saveData();
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "quiz-cabeca-pescoco.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!imported?.slides) throw new Error("JSON inválido");
    data = {
      version: 1,
      slides: slides.map((_, index) => ({
        ...emptySlideData(),
        ...(imported.slides[index] || {}),
      })),
    };
    saveData();
    state.selectedId = null;
    state.quizIndex = 0;
    render();
  } catch (error) {
    window.alert("Não foi possível importar esse arquivo JSON.");
  } finally {
    event.target.value = "";
  }
}

function init() {
  slides.forEach((slide, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = slide.title;
    els.slideSelect.appendChild(option);
  });

  els.tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
  els.toolButtons.forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
  els.slideSelect.addEventListener("change", () => setSlide(Number(els.slideSelect.value)));
  els.prevSlide.addEventListener("click", () => setSlide(state.slideIndex - 1));
  els.nextSlide.addEventListener("click", () => setSlide(state.slideIndex + 1));
  els.zoomOut.addEventListener("click", () => setZoom(state.zoom - ZOOM_STEP));
  els.zoomIn.addEventListener("click", () => setZoom(state.zoom + ZOOM_STEP));
  els.zoomRange.addEventListener("input", () => setZoom(els.zoomRange.value));
  els.resetZoom.addEventListener("click", () => setZoom(1));
  els.stageFrame.addEventListener("wheel", zoomFromWheel, { passive: false });
  els.checkAnswer.addEventListener("click", checkAnswer);
  els.nextQuestion.addEventListener("click", nextQuestion);
  els.revealAnswer.addEventListener("click", revealAnswer);
  els.savePin.addEventListener("click", saveSelectedPin);
  els.deleteSelected.addEventListener("click", deleteSelected);
  els.exportData.addEventListener("click", exportData);
  els.importData.addEventListener("change", importData);
  els.answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") checkAnswer();
  });

  els.imageStage.addEventListener("pointerdown", (event) => {
    if (state.mode !== "edit" || event.target.closest(".pin, .mask")) return;
    const point = pointFromEvent(event);
    if (state.tool === "pin") {
      addPin(point);
    } else {
      els.imageStage.setPointerCapture(event.pointerId);
      beginMask(point);
    }
  });

  els.imageStage.addEventListener("pointermove", (event) => {
    if (state.mode === "edit" && state.draftMask) updateMask(pointFromEvent(event));
  });

  els.imageStage.addEventListener("pointerup", () => {
    if (state.mode === "edit" && state.draftMask) commitMask();
  });

  els.slideImage.addEventListener("load", render);
  applyZoom();
  setSlide(0);
}

init();
