import assert from "node:assert/strict";
import { createMusicManager } from "../src/audio/musicManager.js";
import { createDefaultSave, migrateSave } from "../src/core/storage.js";

const TRACKS = {
  menu: { id: "menu", src: "menu.mp3", gain: 1 },
  camp: { id: "camp", src: "camp.mp3", gain: 1 },
  plains: { id: "plains", src: "plains.mp3", gain: 1 },
  forest: { id: "forest", src: "forest.mp3", gain: 0.8 }
};

class FakeAudio {
  constructor(playResults = []) {
    this._src = "";
    this.srcSetCount = 0;
    this.currentTime = 0;
    this.loop = false;
    this.preload = "";
    this.volume = 1;
    this.paused = true;
    this.playCalls = 0;
    this.pauseCalls = 0;
    this.loadCalls = 0;
    this.playResults = [...playResults];
  }

  get src() {
    return this._src;
  }

  set src(value) {
    this._src = String(value || "");
    this.srcSetCount += 1;
  }

  play() {
    this.playCalls += 1;
    const result = this.playResults.length > 0 ? this.playResults.shift() : "resolve";
    if (result === "reject") {
      this.paused = true;
      return Promise.reject(new Error("blocked"));
    }
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }

  load() {
    this.loadCalls += 1;
  }

  removeAttribute(name) {
    if (name === "src") {
      this._src = "";
    }
  }
}

function createTestManager(options = {}) {
  const warnings = [];
  const audio = options.audio || new FakeAudio(options.playResults);
  const manager = createMusicManager({
    trackDefinitions: TRACKS,
    audioElement: audio,
    fadeDurationMs: options.fadeDurationMs ?? 4,
    fadeStepMs: 1,
    warn: (message) => warnings.push(message)
  });
  return { manager, audio, warnings };
}

async function testLockedState() {
  const { manager, audio } = createTestManager();
  await manager.requestTrack("menu");
  assert.equal(audio.playCalls, 0);
  assert.equal(manager.getState().requestedTrackId, "menu");
}

async function testFirstInteractionUsesLatestTrack() {
  const { manager, audio } = createTestManager();
  await manager.requestTrack("menu");
  await manager.requestTrack("camp");
  await manager.handleUserInteraction();
  assert.equal(audio.playCalls, 1);
  assert.equal(audio.src, "camp.mp3");
  assert.equal(manager.getState().currentTrackId, "camp");
}

async function testSameTrackDoesNotRestart() {
  const { manager, audio } = createTestManager();
  await manager.requestTrack("forest");
  await manager.handleUserInteraction();
  audio.currentTime = 27;
  const srcSetCount = audio.srcSetCount;
  const playCalls = audio.playCalls;
  await manager.requestTrack("forest");
  assert.equal(audio.srcSetCount, srcSetCount);
  assert.equal(audio.currentTime, 27);
  assert.equal(audio.playCalls, playCalls);
}

async function testDifferentTrackSwitches() {
  const { manager, audio } = createTestManager();
  await manager.requestTrack("plains");
  await manager.handleUserInteraction();
  await manager.requestTrack("forest");
  assert.equal(manager.getState().currentTrackId, "forest");
  assert.equal(audio.src, "forest.mp3");
}

async function testRapidSwitchKeepsLatestRequest() {
  const { manager, audio } = createTestManager({ fadeDurationMs: 12 });
  await manager.requestTrack("menu");
  await manager.handleUserInteraction();
  const campTransition = manager.requestTrack("camp");
  const menuTransition = manager.requestTrack("menu");
  await Promise.all([campTransition, menuTransition]);
  assert.equal(manager.getState().requestedTrackId, "menu");
  assert.equal(manager.getState().currentTrackId, "menu");
  assert.equal(audio.src, "menu.mp3");
}

async function testNullTrackIsSilentAndWarningFree() {
  const { manager, audio, warnings } = createTestManager();
  await manager.requestTrack("forest");
  await manager.handleUserInteraction();
  await manager.requestTrack(null);
  assert.equal(manager.getState().requestedTrackId, null);
  assert.equal(manager.getState().currentTrackId, null);
  assert.equal(audio.paused, true);
  assert.equal(warnings.length, 0);
}

async function testTrackAfterSilencePlaysNormally() {
  const { manager, audio } = createTestManager();
  await manager.requestTrack(null);
  await manager.handleUserInteraction();
  await manager.requestTrack("camp");
  assert.equal(manager.getState().currentTrackId, "camp");
  assert.equal(audio.src, "camp.mp3");
  assert.equal(audio.paused, false);
}

async function testMissingTrackStopsMusicAndWarns() {
  const { manager, audio, warnings } = createTestManager();
  await manager.requestTrack("camp");
  await manager.handleUserInteraction();
  await manager.requestTrack("missing_track");
  await manager.requestTrack("missing_track");
  assert.equal(manager.getState().currentTrackId, null);
  assert.equal(manager.getState().requestedTrackId, null);
  assert.equal(audio.paused, true);
  assert.equal(warnings.length, 1);
}

async function testDisabledManagerTracksLatestScene() {
  const { manager, audio } = createTestManager();
  await manager.requestTrack("forest");
  await manager.handleUserInteraction();
  await manager.setEnabled(false);
  await manager.requestTrack("camp");
  assert.equal(manager.getState().requestedTrackId, "camp");
  assert.equal(audio.paused, true);
  await manager.setEnabled(true);
  assert.equal(manager.getState().currentTrackId, "camp");
  assert.equal(audio.src, "camp.mp3");
  assert.equal(audio.paused, false);
}

async function testPlayRejectionCanRetry() {
  const audio = new FakeAudio(["reject", "resolve"]);
  const { manager, warnings } = createTestManager({ audio });
  await manager.requestTrack("menu");
  await manager.handleUserInteraction();
  assert.equal(audio.paused, true);
  assert.equal(manager.getState().requestedTrackId, "menu");
  assert.equal(warnings.length, 1);
  await manager.handleUserInteraction();
  assert.equal(audio.playCalls, 2);
  assert.equal(audio.paused, false);
}

async function testVolumeAndGainAreNormalized() {
  const { manager, audio } = createTestManager({ fadeDurationMs: 0 });
  manager.setVolume(0.35);
  await manager.requestTrack("forest");
  await manager.handleUserInteraction();
  assert.ok(Math.abs(audio.volume - 0.28) < 1e-9);
  assert.equal(manager.setVolume(-1), 0);
  assert.equal(audio.volume, 0);
  assert.equal(manager.setVolume(2), 1);
  assert.equal(audio.volume, 0.8);
  assert.equal(manager.setVolume(Number.NaN), 0.35);
  assert.ok(Math.abs(audio.volume - 0.28) < 1e-9);
}

async function testMusicSettingsMigration() {
  const defaultSave = createDefaultSave();
  assert.equal(defaultSave.settings.musicEnabled, true);
  assert.equal(defaultSave.settings.musicVolume, 0.35);

  const migrated = migrateSave({
    settings: {
      musicEnabled: false,
      musicVolume: 0.2
    }
  });
  assert.equal(migrated.settings.musicEnabled, false);
  assert.equal(migrated.settings.musicVolume, 0.2);

  const normalized = migrateSave({
    settings: {
      musicEnabled: "false",
      musicVolume: 2
    }
  });
  assert.equal(normalized.settings.musicEnabled, true);
  assert.equal(normalized.settings.musicVolume, 1);

  const fallback = migrateSave({
    settings: {
      musicVolume: Number.NaN
    }
  });
  assert.equal(fallback.settings.musicVolume, 0.35);
}

const tests = [
  testLockedState,
  testFirstInteractionUsesLatestTrack,
  testSameTrackDoesNotRestart,
  testDifferentTrackSwitches,
  testRapidSwitchKeepsLatestRequest,
  testNullTrackIsSilentAndWarningFree,
  testTrackAfterSilencePlaysNormally,
  testMissingTrackStopsMusicAndWarns,
  testDisabledManagerTracksLatestScene,
  testPlayRejectionCanRetry,
  testVolumeAndGainAreNormalized,
  testMusicSettingsMigration
];

for (const test of tests) {
  await test();
}

console.log(`BGM 核心隔離驗證：${tests.length} / ${tests.length} 全部通過`);
