/* Ihsan Academy — ماسح QR حقيقي عبر كاميرا الجهاز.
   يستخدم BarcodeDetector عند توفره (أندرويد/كروم)، وإلا يسقط إلى jsQR متعدد المنصات.
   لا يخزّن الصور، ولا يرسل أي شيء خارج الجهاز؛ الفك يتم محليًا فقط. */
(function () {
  "use strict";

  const state = {
    stream: null,
    video: null,
    rafId: 0,
    intervalId: 0,
    detector: null,
    canvas: null,
    ctx: null,
    onCode: null,
    onError: null,
    active: false,
    busy: false,
    lastCode: "",
    lastAt: 0
  };

  function emitError(code, message) {
    if (typeof state.onError === "function") state.onError({ code, message });
  }

  function cameraErrorMessage(err) {
    const name = (err && err.name) || "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
      return "لم تُمنح صلاحية الكاميرا. اسمح للمتصفح باستخدام الكاميرا من إعدادات الموقع ثم حاول مجددًا.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
      return "لم يُعثر على كاميرا متاحة على هذا الجهاز.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "الكاميرا مستخدمة من تطبيق آخر. أغلق التطبيقات التي تستخدم الكاميرا ثم حاول مجددًا.";
    }
    if (name === "AbortError") {
      return "انقطع تشغيل الكاميرا قبل اكتماله. حاول مرة أخرى.";
    }
    return "تعذّر تشغيل الكاميرا (" + (name || "خطأ غير معروف") + "). تحقق من الصلاحية ومن أن الموقع يعمل عبر HTTPS.";
  }

  async function openStream() {
    const attempts = [
      { video: { facingMode: { ideal: "environment" } }, audio: false },
      { video: true, audio: false }
    ];
    let lastError = null;
    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
        const name = (error && error.name) || "";
        // لا فائدة من إعادة المحاولة عند رفض الصلاحية أو غياب الكاميرا.
        if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError" || name === "NotFoundError" || name === "DevicesNotFoundError") throw error;
      }
    }
    throw lastError || new Error("getUserMedia failed");
  }

  async function makeDetector() {
    if (!("BarcodeDetector" in window)) return null;
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      if (Array.isArray(supported) && supported.includes("qr_code")) {
        return new window.BarcodeDetector({ formats: ["qr_code"] });
      }
    } catch {}
    return null;
  }

  function decodeWithJsQR() {
    if (!state.video || state.video.readyState < 2) return "";
    const video = state.video;
    const width = video.videoWidth, height = video.videoHeight;
    if (!width || !height) return "";
    if (!state.canvas) {
      state.canvas = document.createElement("canvas");
      state.ctx = state.canvas.getContext("2d", { willReadFrequently: true });
    }
    // فك على نطاق أصغر لتسريع المعالجة على الهواتف الضعيفة.
    const scale = Math.min(1, 720 / Math.max(width, height));
    state.canvas.width = Math.round(width * scale);
    state.canvas.height = Math.round(height * scale);
    state.ctx.drawImage(video, 0, 0, state.canvas.width, state.canvas.height);
    let imageData = null;
    try { imageData = state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height); } catch { return ""; }
    if (typeof window.jsQR !== "function") return "";
    const result = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
    return result && result.data ? String(result.data) : "";
  }

  async function tickBarcodeDetector() {
    if (!state.active || !state.detector || !state.video) return;
    if (state.busy || state.video.readyState < 2) return;
    state.busy = true;
    try {
      const codes = await state.detector.detect(state.video);
      const value = codes && codes.length ? String(codes[0].rawValue || "") : "";
      if (value) handleCode(value);
    } catch {
      /* إطار غير قابل للفك؛ نتجاهله ونكمل */
    } finally {
      state.busy = false;
    }
  }

  function tickJsQR() {
    if (!state.active) return;
    if (state.busy) return;
    state.busy = true;
    try {
      const value = decodeWithJsQR();
      if (value) handleCode(value);
    } finally {
      state.busy = false;
    }
  }

  function handleCode(value) {
    const now = Date.now();
    // تجاهل التكرار الفوري لنفس الرمز خلال ثانيتين.
    if (value === state.lastCode && now - state.lastAt < 2000) return;
    state.lastCode = value;
    state.lastAt = now;
    stopLoops();
    if (typeof state.onCode === "function") state.onCode(value);
  }

  function stopLoops() {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    if (state.intervalId) clearInterval(state.intervalId);
    state.rafId = 0;
    state.intervalId = 0;
  }

  async function start(videoEl, onCode, onError) {
    stop();
    state.video = videoEl;
    state.onCode = onCode;
    state.onError = onError;
    state.lastCode = "";
    state.lastAt = 0;

    if (!window.isSecureContext) {
      emitError("insecure_context", "يتطلب الماسح اتصالاً آمنًا (HTTPS) أو localhost. افتح الموقع عبر https.");
      return false;
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      emitError("unsupported", "هذا المتصفح لا يدعم الوصول إلى الكاميرا. استخدم Chrome أو Edge أو Safari حديثًا.");
      return false;
    }
    try {
      state.stream = await openStream();
    } catch (error) {
      emitError((error && error.name) || "camera_error", cameraErrorMessage(error));
      return false;
    }
    state.active = true;
    videoEl.setAttribute("playsinline", "");
    videoEl.muted = true;
    videoEl.srcObject = state.stream;
    try {
      await videoEl.play();
    } catch (error) {
      emitError("play_failed", "تعذّر عرض بث الكاميرا. حاول مرة أخرى.");
      stop();
      return false;
    }
    state.detector = await makeDetector();
    if (state.detector) {
      const loop = () => { tickBarcodeDetector().finally(() => { if (state.active) state.rafId = requestAnimationFrame(loop); }); };
      state.rafId = requestAnimationFrame(loop);
    } else if (typeof window.jsQR === "function") {
      state.intervalId = setInterval(tickJsQR, 300);
    } else {
      emitError("no_decoder", "تعذر تجهيز مفكك الرموز على هذا المتصفح. حدّث المتصفح أو استخدم Chrome.");
      stop();
      return false;
    }
    return true;
  }

  function stop() {
    stopLoops();
    state.active = false;
    state.busy = false;
    if (state.stream) {
      for (const track of state.stream.getTracks()) { try { track.stop(); } catch {} }
    }
    state.stream = null;
    if (state.video) {
      try { state.video.pause(); } catch {}
      try { state.video.srcObject = null; } catch {}
    }
    state.video = null;
    state.detector = null;
  }

  window.IhsanScanner = { start, stop };
})();
