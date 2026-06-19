const $ = (id) => document.getElementById(id);

const pages = document.querySelectorAll(".page");
const pageButtons = document.querySelectorAll("[data-page]");
const requireResultButtons = document.querySelectorAll("[data-requires-result]");

const video = $("video");
const frameCanvas = $("frameCanvas");
const resultCanvas = $("resultCanvas");
const baseCanvas = $("baseCanvas");
const drawCanvas = $("drawCanvas");

const startCameraBtn = $("startCameraBtn");
const stopCameraBtn = $("stopCameraBtn");
const captureBtn = $("captureBtn");
const resetBtn = $("resetBtn");

const durationSelect = $("durationSelect");
const thresholdRange = $("thresholdRange");
const thresholdValue = $("thresholdValue");

const statusText = $("statusText");
const progressBar = $("progressBar");

const downloadOriginalBtn = $("downloadOriginalBtn");
const downloadEditedBtn = $("downloadEditedBtn");

const penColor = $("penColor");
const penSize = $("penSize");
const penSizeValue = $("penSizeValue");

const penBtn = $("penBtn");
const eraserBtn = $("eraserBtn");
const clearDrawingBtn = $("clearDrawingBtn");

const originalPreviewCanvas = $("originalPreviewCanvas");
const editedPreviewCanvas = $("editedPreviewCanvas");

const downloadOriginalFinalBtn = $("downloadOriginalFinalBtn");
const downloadEditedFinalBtn = $("downloadEditedFinalBtn");

let stream = null;
let isCapturing = false;
let originalDataUrl = null;

let drawing = false;
let currentTool = "pen";
let lastPoint = null;

const MAX_CAPTURE_SIDE = 900;

function showPage(pageId) {
  pages.forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelectorAll(".step-dot").forEach((dot) => {
    dot.classList.toggle("active", dot.dataset.page === pageId);
  });

  if (pageId === "page-final") {
    renderFinalPreview();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function setStatus(message) {
  statusText.textContent = message;
}

function setProgress(percent) {
  progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function setButtons() {
  const hasCamera = !!stream;
  const hasResult = !!originalDataUrl;

  startCameraBtn.disabled = hasCamera;
  stopCameraBtn.disabled = !hasCamera;
  captureBtn.disabled = !hasCamera || isCapturing;
  resetBtn.disabled = isCapturing;

  downloadOriginalBtn.disabled = !hasResult;
  downloadEditedBtn.disabled = !hasResult;

  requireResultButtons.forEach((button) => {
    button.disabled = !hasResult;
  });
}

function getCanvasSizeFromVideo() {
  const videoWidth = video.videoWidth || 1280;
  const videoHeight = video.videoHeight || 720;

  const maxSide = Math.max(videoWidth, videoHeight);
  const scale = maxSide > MAX_CAPTURE_SIDE ? MAX_CAPTURE_SIDE / maxSide : 1;

  return {
    width: Math.round(videoWidth * scale),
    height: Math.round(videoHeight * scale),
  };
}

function resizeCanvases() {
  const { width, height } = getCanvasSizeFromVideo();

  frameCanvas.width = width;
  frameCanvas.height = height;

  resultCanvas.width = width;
  resultCanvas.height = height;

  baseCanvas.width = width;
  baseCanvas.height = height;

  drawCanvas.width = width;
  drawCanvas.height = height;

  const resultCtx = resultCanvas.getContext("2d");
  resultCtx.fillStyle = "#000";
  resultCtx.fillRect(0, 0, width, height);

  const baseCtx = baseCanvas.getContext("2d");
  baseCtx.fillStyle = "#000";
  baseCtx.fillRect(0, 0, width, height);

  const drawCtx = drawCanvas.getContext("2d");
  drawCtx.clearRect(0, 0, width, height);
}

async function startCamera() {
  try {
    setStatus("카메라 권한을 요청하는 중입니다.");

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();

    setTimeout(() => {
      resizeCanvases();
    }, 300);

    setStatus("카메라가 시작되었습니다. 촬영할 준비가 되면 버튼을 누르세요.");
  } catch (error) {
    console.error(error);
    stream = null;
    setStatus("카메라를 시작할 수 없습니다. 카메라 권한 또는 HTTPS 접속을 확인하세요.");
  }

  setButtons();
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  stream = null;
  video.srcObject = null;

  setStatus("카메라가 종료되었습니다.");
  setButtons();
}

function createBlackImageData(ctx, width, height) {
  const imageData = ctx.createImageData(width, height);

  for (let i = 3; i < imageData.data.length; i += 4) {
    imageData.data[i] = 255;
  }

  return imageData;
}

function loadOriginalToEditCanvas(dataUrl) {
  const img = new Image();

  img.onload = () => {
    const baseCtx = baseCanvas.getContext("2d");
    const drawCtx = drawCanvas.getContext("2d");

    baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    baseCtx.drawImage(img, 0, 0, baseCanvas.width, baseCanvas.height);
  };

  img.src = dataUrl;
}

function captureLightPainting() {
  if (!stream || isCapturing) return;

  resizeCanvases();

  const durationMs = Number(durationSelect.value) * 1000;
  const threshold = Number(thresholdRange.value);

  const frameCtx = frameCanvas.getContext("2d", { willReadFrequently: true });
  const resultCtx = resultCanvas.getContext("2d");

  const width = resultCanvas.width;
  const height = resultCanvas.height;

  const accumulated = createBlackImageData(resultCtx, width, height);
  const acc = accumulated.data;

  const startTime = performance.now();
  const gain = 0.45;

  isCapturing = true;
  originalDataUrl = null;

  setButtons();
  setProgress(0);
  setStatus(`${durationSelect.value}초 동안 RGB 빛을 움직이세요.`);

  function step(now) {
    const elapsed = now - startTime;
    const progress = elapsed / durationMs;

    frameCtx.drawImage(video, 0, 0, width, height);

    const frame = frameCtx.getImageData(0, 0, width, height);
    const data = frame.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const brightness = Math.max(r, g, b);

      if (brightness >= threshold) {
        acc[i] = Math.min(255, acc[i] + r * gain);
        acc[i + 1] = Math.min(255, acc[i + 1] + g * gain);
        acc[i + 2] = Math.min(255, acc[i + 2] + b * gain);
        acc[i + 3] = 255;
      }
    }

    resultCtx.putImageData(accumulated, 0, 0);
    setProgress(progress * 100);

    if (elapsed < durationMs) {
      requestAnimationFrame(step);
    } else {
      resultCtx.putImageData(accumulated, 0, 0);
      originalDataUrl = resultCanvas.toDataURL("image/png");

      loadOriginalToEditCanvas(originalDataUrl);

      isCapturing = false;
      setProgress(100);
      setStatus("촬영이 완료되었습니다. 결과 페이지로 이동합니다.");
      setButtons();

      setTimeout(() => {
        showPage("page-result");
      }, 400);
    }
  }

  requestAnimationFrame(step);
}

function resetAll() {
  originalDataUrl = null;
  setProgress(0);

  const canvases = [resultCanvas, baseCanvas, drawCanvas];

  canvases.forEach((canvas) => {
    const ctx = canvas.getContext("2d");

    if (canvas === drawCanvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  });

  setStatus("초기화되었습니다.");
  setButtons();
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadOriginal() {
  if (!originalDataUrl) return;

  downloadDataUrl(originalDataUrl, "rgb-light-painting-original.png");
}

function createEditedDataUrl() {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = baseCanvas.width;
  tempCanvas.height = baseCanvas.height;

  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(baseCanvas, 0, 0);
  tempCtx.drawImage(drawCanvas, 0, 0);

  return tempCanvas.toDataURL("image/png");
}

function downloadEdited() {
  if (!originalDataUrl) return;

  const editedDataUrl = createEditedDataUrl();
  downloadDataUrl(editedDataUrl, "rgb-light-painting-edited.png");
}

function renderFinalPreview() {
  if (!originalDataUrl) return;

  const width = baseCanvas.width;
  const height = baseCanvas.height;

  originalPreviewCanvas.width = width;
  originalPreviewCanvas.height = height;
  editedPreviewCanvas.width = width;
  editedPreviewCanvas.height = height;

  const originalCtx = originalPreviewCanvas.getContext("2d");
  const editedCtx = editedPreviewCanvas.getContext("2d");

  const originalImg = new Image();
  originalImg.onload = () => {
    originalCtx.clearRect(0, 0, width, height);
    originalCtx.drawImage(originalImg, 0, 0, width, height);
  };
  originalImg.src = originalDataUrl;

  editedCtx.clearRect(0, 0, width, height);
  editedCtx.drawImage(baseCanvas, 0, 0);
  editedCtx.drawImage(drawCanvas, 0, 0);
}

function getPointerPoint(event) {
  const rect = drawCanvas.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) * (drawCanvas.width / rect.width),
    y: (event.clientY - rect.top) * (drawCanvas.height / rect.height),
  };
}

function startDrawing(event) {
  if (!originalDataUrl) return;

  event.preventDefault();

  drawing = true;
  lastPoint = getPointerPoint(event);
}

function draw(event) {
  if (!drawing || !lastPoint) return;

  event.preventDefault();

  const point = getPointerPoint(event);
  const ctx = drawCanvas.getContext("2d");

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Number(penSize.value);

  if (currentTool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = penColor.value;
  }

  ctx.beginPath();
  ctx.moveTo(lastPoint.x, lastPoint.y);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();

  lastPoint = point;
}

function stopDrawing() {
  drawing = false;
  lastPoint = null;
}

function setTool(tool) {
  currentTool = tool;

  if (tool === "pen") {
    penBtn.classList.add("active-tool");
    eraserBtn.classList.remove("active-tool");
  } else {
    eraserBtn.classList.add("active-tool");
    penBtn.classList.remove("active-tool");
  }
}

function clearDrawing() {
  const ctx = drawCanvas.getContext("2d");
  ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}

pageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) return;

    const pageId = button.dataset.page;
    showPage(pageId);
  });
});

thresholdRange.addEventListener("input", () => {
  thresholdValue.textContent = thresholdRange.value;
});

penSize.addEventListener("input", () => {
  penSizeValue.textContent = penSize.value;
});

startCameraBtn.addEventListener("click", startCamera);
stopCameraBtn.addEventListener("click", stopCamera);
captureBtn.addEventListener("click", captureLightPainting);
resetBtn.addEventListener("click", resetAll);

downloadOriginalBtn.addEventListener("click", downloadOriginal);
downloadEditedBtn.addEventListener("click", downloadEdited);
downloadOriginalFinalBtn.addEventListener("click", downloadOriginal);
downloadEditedFinalBtn.addEventListener("click", downloadEdited);

penBtn.addEventListener("click", () => setTool("pen"));
eraserBtn.addEventListener("click", () => setTool("eraser"));
clearDrawingBtn.addEventListener("click", clearDrawing);

drawCanvas.addEventListener("pointerdown", startDrawing);
drawCanvas.addEventListener("pointermove", draw);
drawCanvas.addEventListener("pointerup", stopDrawing);
drawCanvas.addEventListener("pointercancel", stopDrawing);
drawCanvas.addEventListener("pointerleave", stopDrawing);

window.addEventListener("resize", () => {
  if (stream && !originalDataUrl) {
    resizeCanvases();
  }
});

setButtons();
