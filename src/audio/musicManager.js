const DEFAULT_FADE_DURATION_MS = 400;
const DEFAULT_FADE_STEP_MS = 25;
const DEFAULT_MUSIC_VOLUME = 0.35;

export function createMusicManager(options = {}) {
  const trackDefinitions = options.trackDefinitions || {};
  const audio = options.audioElement || options.audioFactory?.() || createDefaultAudioElement();
  const fadeDurationMs = normalizeDuration(options.fadeDurationMs, DEFAULT_FADE_DURATION_MS);
  const fadeStepMs = Math.max(1, normalizeDuration(options.fadeStepMs, DEFAULT_FADE_STEP_MS));
  const warn = typeof options.warn === "function"
    ? options.warn
    : (message, error) => console.warn(message, error || "");

  let currentTrackId = null;
  let requestedTrackId = null;
  let hasUserInteraction = false;
  let musicEnabled = true;
  let musicVolume = DEFAULT_MUSIC_VOLUME;
  let transitionToken = 0;
  let transitionInProgress = false;
  const warnedMissingTrackIds = new Set();
  const warnedPlaybackTrackIds = new Set();

  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0;

  function requestTrack(trackId) {
    const normalizedTrackId = normalizeTrackId(trackId);
    if (normalizedTrackId && !getTrackDefinition(normalizedTrackId)) {
      if (!warnedMissingTrackIds.has(normalizedTrackId)) {
        warnedMissingTrackIds.add(normalizedTrackId);
        warn(`找不到 BGM track definition：${normalizedTrackId}`);
      }
      return setRequestedTrack(null);
    }
    return setRequestedTrack(normalizedTrackId);
  }

  function setEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    if (nextEnabled === musicEnabled) {
      return Promise.resolve(getState());
    }

    musicEnabled = nextEnabled;
    if (!musicEnabled) {
      transitionToken += 1;
      transitionInProgress = false;
      audio.pause();
      audio.volume = 0;
      return Promise.resolve(getState());
    }

    return startTransition();
  }

  function setVolume(volume) {
    musicVolume = normalizeVolume(volume, DEFAULT_MUSIC_VOLUME);
    if (!transitionInProgress && currentTrackId) {
      audio.volume = getEffectiveVolume(currentTrackId);
    }
    return musicVolume;
  }

  function handleUserInteraction() {
    hasUserInteraction = true;
    if (!musicEnabled || !requestedTrackId) {
      return Promise.resolve(getState());
    }
    if (transitionInProgress && requestedTrackId !== currentTrackId) {
      return Promise.resolve(getState());
    }
    if (requestedTrackId === currentTrackId && !audio.paused) {
      return Promise.resolve(getState());
    }
    return startTransition();
  }

  function getState() {
    return {
      currentTrackId,
      requestedTrackId,
      hasUserInteraction,
      musicEnabled,
      musicVolume,
      transitionInProgress,
      paused: Boolean(audio.paused),
      currentTime: Number(audio.currentTime) || 0,
      volume: Number(audio.volume) || 0
    };
  }

  function setRequestedTrack(trackId) {
    if (
      trackId === requestedTrackId
      && trackId === currentTrackId
      && !transitionInProgress
      && (!musicEnabled || !hasUserInteraction || !audio.paused)
    ) {
      return Promise.resolve(getState());
    }

    requestedTrackId = trackId;
    return startTransition();
  }

  function startTransition() {
    const token = ++transitionToken;
    transitionInProgress = true;
    const transition = reconcileRequestedTrack(token);
    return Promise.resolve(transition).finally(() => {
      if (token === transitionToken) {
        transitionInProgress = false;
      }
    });
  }

  async function reconcileRequestedTrack(token) {
    if (!isLatestTransition(token)) {
      return getState();
    }

    if (requestedTrackId === currentTrackId) {
      if (!musicEnabled) {
        audio.pause();
        audio.volume = 0;
        return getState();
      }
      if (!hasUserInteraction || !requestedTrackId) {
        return getState();
      }
      if (audio.paused) {
        await playCurrentTrack(token, { fadeIn: true });
      } else {
        await fadeVolumeTo(() => getEffectiveVolume(currentTrackId), token);
      }
      return getState();
    }

    if (currentTrackId && !audio.paused && musicEnabled && hasUserInteraction) {
      const fadedOut = await fadeVolumeTo(() => 0, token);
      if (!fadedOut || !isLatestTransition(token)) {
        return getState();
      }
    }

    if (!isLatestTransition(token)) {
      return getState();
    }

    audio.pause();
    loadRequestedTrack();

    if (!isLatestTransition(token) || !requestedTrackId || !musicEnabled || !hasUserInteraction) {
      return getState();
    }

    await playCurrentTrack(token, { fadeIn: true });
    return getState();
  }

  function loadRequestedTrack() {
    if (!requestedTrackId) {
      currentTrackId = null;
      clearAudioSource(audio);
      return;
    }

    const track = getTrackDefinition(requestedTrackId);
    if (!track) {
      currentTrackId = null;
      requestedTrackId = null;
      clearAudioSource(audio);
      return;
    }

    currentTrackId = requestedTrackId;
    audio.src = track.src;
    audio.currentTime = 0;
    audio.loop = true;
    audio.volume = 0;
    audio.load?.();
  }

  async function playCurrentTrack(token, options = {}) {
    const { fadeIn = false } = options;
    if (!currentTrackId || !musicEnabled || !hasUserInteraction || !isLatestTransition(token)) {
      return false;
    }

    if (fadeIn) {
      audio.volume = 0;
    } else {
      audio.volume = getEffectiveVolume(currentTrackId);
    }

    try {
      const playResult = audio.play();
      if (playResult && typeof playResult.then === "function") {
        await playResult;
      }
    } catch (error) {
      if (isLatestTransition(token) && !warnedPlaybackTrackIds.has(currentTrackId)) {
        warnedPlaybackTrackIds.add(currentTrackId);
        warn(`BGM 無法播放：${currentTrackId}`, error);
      }
      return false;
    }

    warnedPlaybackTrackIds.delete(currentTrackId);

    if (!isLatestTransition(token)) {
      return false;
    }

    if (fadeIn) {
      return fadeVolumeTo(() => getEffectiveVolume(currentTrackId), token);
    }

    return true;
  }

  async function fadeVolumeTo(resolveTargetVolume, token) {
    if (!isLatestTransition(token)) {
      return false;
    }

    const startVolume = normalizeVolume(audio.volume, 0);
    if (fadeDurationMs <= 0) {
      audio.volume = normalizeVolume(resolveTargetVolume(), 0);
      return true;
    }

    const startedAt = Date.now();
    while (isLatestTransition(token)) {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / fadeDurationMs);
      const targetVolume = normalizeVolume(resolveTargetVolume(), 0);
      audio.volume = normalizeVolume(startVolume + (targetVolume - startVolume) * progress, 0);
      if (progress >= 1) {
        return true;
      }
      await delay(fadeStepMs);
    }

    return false;
  }

  function getTrackDefinition(trackId) {
    const track = trackDefinitions[trackId];
    if (!track || typeof track !== "object") {
      return null;
    }
    const src = String(track.src || "").trim();
    if (!src) {
      return null;
    }
    return track;
  }

  function getEffectiveVolume(trackId) {
    const track = getTrackDefinition(trackId);
    const gain = Number.isFinite(track?.gain) && track.gain >= 0 ? track.gain : 1;
    return normalizeVolume(musicVolume * gain, 0);
  }

  function isLatestTransition(token) {
    return token === transitionToken;
  }

  return {
    requestTrack,
    setEnabled,
    setVolume,
    handleUserInteraction,
    getState
  };
}

function createDefaultAudioElement() {
  if (typeof Audio !== "function") {
    throw new Error("目前環境不支援 HTMLAudioElement。請注入 audioElement 進行測試。");
  }
  return new Audio();
}

function normalizeTrackId(trackId) {
  if (trackId === null || trackId === undefined) {
    return null;
  }
  const normalized = String(trackId).trim();
  return normalized || null;
}

function normalizeVolume(value, fallback) {
  if (!Number.isFinite(value)) {
    return Math.min(1, Math.max(0, fallback));
  }
  return Math.min(1, Math.max(0, value));
}

function normalizeDuration(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function clearAudioSource(audio) {
  try {
    audio.removeAttribute?.("src");
    if (!("removeAttribute" in audio)) {
      audio.src = "";
    }
    audio.load?.();
  } catch {
    // A missing or custom media source must not break the game flow.
  }
}

function delay(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
