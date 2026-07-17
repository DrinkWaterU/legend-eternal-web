export function createDebugPanelElement(documentRef = document) {
  const panel = documentRef.createElement("aside");
  panel.className = "debug-panel";
  panel.innerHTML = `
    <button class="debug-toggle" type="button" aria-expanded="false">調試</button>
    <div class="debug-body" hidden>
      <div class="debug-header">
        <strong>調試模式</strong>
        <small>?debug=1</small>
      </div>

      <section class="debug-section" aria-labelledby="debugSaveToolsTitle">
        <div class="debug-section-heading">
          <strong id="debugSaveToolsTitle">角色與存檔</strong>
          <small>會修改正式存檔</small>
        </div>
        <div class="debug-input-pair">
          <label>
            等級
            <input class="debug-level" type="number" min="1" max="30" value="1" />
          </label>
          <label>
            EXP
            <input class="debug-exp" type="number" min="0" value="0" />
          </label>
        </div>
        <div class="debug-grid">
          <button type="button" data-action="set-level">設定等級</button>
          <button type="button" data-action="set-exp">設定 EXP</button>
          <button type="button" data-action="heal">補滿 HP</button>
          <button type="button" data-action="unlock-phoenix">解鎖加護</button>
          <button type="button" data-action="remove-phoenix">移除加護</button>
          <button type="button" data-action="clear-inventory">清空資源</button>
          <button type="button" data-action="give-blacksmith-resources">給予鍛造資源</button>
          <button type="button" data-action="give-all-weapons">取得全部武器</button>
          <button type="button" data-action="clear-all-weapons">清空全部武器</button>
        </div>
        <div class="debug-material-row">
          <label>
            素材來源
            <select class="debug-material-group"></select>
          </label>
          <button class="debug-material-give" type="button">給予素材</button>
        </div>
        <div class="debug-grid">
          <button type="button" data-action="camp">回營地</button>
          <button type="button" data-action="delete-save">刪除存檔</button>
        </div>
      </section>

      <section class="debug-section" aria-labelledby="debugSafeAreaTitle">
        <div class="debug-section-heading">
          <strong id="debugSafeAreaTitle">安全區測試</strong>
          <small>會修改正式存檔</small>
        </div>
        <label>
          目標據點
          <select class="debug-safe-area-select"></select>
        </label>
        <small class="debug-safe-area-note"></small>
        <div class="debug-grid">
          <button type="button" data-action="prepare-safe-area">解鎖未造訪</button>
          <button type="button" data-action="visit-safe-area">標記並前往</button>
          <button type="button" data-action="travel-safe-area">直接前往</button>
          <button type="button" data-action="open-safe-area-travel">開啟移動頁</button>
          <button type="button" data-action="reset-safe-area">重設據點</button>
          <button type="button" data-action="play-anping-arrival">播放安平鎮抵達</button>
        </div>
      </section>

      <section class="debug-section" aria-labelledby="debugQuestTitle">
        <div class="debug-section-heading">
          <strong id="debugQuestTitle">公會委託測試</strong>
          <small>會修改正式存檔</small>
        </div>
        <label>
          測試委託
          <select class="debug-quest-select"></select>
        </label>
        <small class="debug-quest-note"></small>
        <div class="debug-grid">
          <button type="button" data-action="replay-guild-quest-intro">重播首次導覽</button>
          <button type="button" data-action="open-guild-quests">開啟委託欄</button>
          <button type="button" data-action="prepare-selected-quest">建立選定委託</button>
          <button type="button" data-action="set-selected-quest-half">設為半程</button>
          <button type="button" data-action="set-selected-quest-ready">設為可回報</button>
          <button type="button" data-action="clear-active-quest">清除目前委託</button>
          <button type="button" data-action="reset-quest-data">重設委託資料</button>
        </div>
      </section>

      <section class="debug-section debug-scenario-section" aria-labelledby="debugScenarioTitle">
        <div class="debug-section-heading">
          <strong id="debugScenarioTitle">冒險場景測試</strong>
          <small>Sandbox，不寫正式進度</small>
        </div>
        <div class="debug-input-pair">
          <label>
            場景
            <select class="debug-scenario-select"></select>
          </label>
          <label>
            測試角色
            <select class="debug-character-select"></select>
          </label>
        </div>
        <small class="debug-scenario-note"></small>

        <div class="debug-scenario-options">
          <label class="debug-route-entry-row" hidden>
            Route 進入
            <select class="debug-route-entry"></select>
          </label>
          <label class="debug-mid-choice-row" hidden>
            中段選擇
            <select class="debug-mid-choice"></select>
          </label>
          <label class="debug-hp-row">
            測試場景進場 HP（%）
            <input class="debug-scenario-hp" type="number" min="1" max="100" value="75" />
          </label>
        </div>

        <section class="debug-build-section" aria-labelledby="debugBuildTitle">
          <div class="debug-build-heading">
            <strong id="debugBuildTitle">場景 Build 時序</strong>
            <small class="debug-build-count">0 / 0</small>
          </div>
          <small class="debug-build-note">場景測試固定使用目前角色的滿等能力；Blessing 依正式取得位置與限場效果時序套用。</small>
          <div class="debug-build-profiles" aria-label="快速 Build"></div>
          <div class="debug-build-list" role="list"></div>
          <label>
            貼上祝福列表
            <textarea class="debug-build-paste" rows="4" placeholder="孢子調息、樹皮加固、劣質狂藥、趁亂下手"></textarea>
          </label>
          <button class="debug-build-parse" type="button">解析 Blessing 列表</button>
        </section>

        <button class="debug-scenario-start" type="button">開始場景測試</button>
      </section>

      <p class="debug-status" role="status">待命中。</p>
    </div>
  `;
  return panel;
}
