export function createAudioSettingsController({
  saveStore,
  musicManager,
  ambientManager,
  els,
  saveGameSafe
}) {
  function syncMusicSettingsFromSave() {
    const volume = musicManager.setVolume(saveStore.current.settings.musicVolume);
    ambientManager.setVolume(saveStore.current.settings.musicVolume);
    void musicManager.setEnabled(saveStore.current.settings.musicEnabled);
    void ambientManager.setEnabled(saveStore.current.settings.musicEnabled);
    renderMusicControls(saveStore.current.settings.musicEnabled, volume);
  }

  function renderMusicControls(
    enabled = saveStore.current.settings.musicEnabled,
    volume = saveStore.current.settings.musicVolume
  ) {
    els.musicToggleButton.textContent = enabled ? "BGM：開" : "BGM：關";
    els.musicToggleButton.setAttribute("aria-pressed", String(enabled));
    els.musicVolumeInput.value = String(volume);
    els.musicVolumeValue.textContent = `${Math.round(volume * 100)}%`;
  }

  function toggleMusicEnabled() {
    saveStore.current.settings.musicEnabled = !saveStore.current.settings.musicEnabled;
    void musicManager.setEnabled(saveStore.current.settings.musicEnabled);
    void ambientManager.setEnabled(saveStore.current.settings.musicEnabled);
    renderMusicControls();
    saveGameSafe();
  }

  function previewMusicVolume() {
    const volume = musicManager.setVolume(Number(els.musicVolumeInput.value));
    ambientManager.setVolume(volume);
    saveStore.current.settings.musicVolume = volume;
    els.musicVolumeValue.textContent = `${Math.round(volume * 100)}%`;
  }

  function commitMusicVolume() {
    previewMusicVolume();
    renderMusicControls();
    saveGameSafe();
  }

  function handleUserInteraction() {
    void musicManager.handleUserInteraction();
    void ambientManager.handleUserInteraction();
  }

  return Object.freeze({
    syncMusicSettingsFromSave,
    renderMusicControls,
    toggleMusicEnabled,
    previewMusicVolume,
    commitMusicVolume,
    handleUserInteraction
  });
}
