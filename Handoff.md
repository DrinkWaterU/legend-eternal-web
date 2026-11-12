# 《傳說永恆》開發交接

- **盤點日期**　2026-11-12（台灣時間）
- **交接版本**　`v0.2.11.0-alpha`，本機 `dev` 工作樹
- **接手重點**　保全本機版本。先修正裂陣的驗證工具，再判定 100% 波及傷害是否保留。

## 1. 接手時先做

1. 向交付者取得本機工作樹副本。用副本做驗證。
2. 從專案根目錄執行 `git status --short --branch`。
3. 核對 `VERSION`、`tools/VERSION` 和 `src/config.js`。三處的遊戲版本應為 `v0.2.11.0-alpha`。
4. 確認副本內有三個研修模組、`tools/tests/`、本機素材和第五輪審查資料。交付清單見下方。
5. 讀取 [專案審查準則](AGENTS.md) 和 [第五輪審查評論](企劃/v0.2.11.0_第五輪審查評論與問題.md)。

| 盤點位置 | 本次看到的版本 | Git 基準 |
| --- | --- | --- |
| 本機 `dev` 工作樹 | `v0.2.11.0-alpha`，存檔 Schema 14 | `9cdd873` 加未提交變更 |
| 已提交的 `dev` 與本機 `origin/dev` 參照 | `v0.2.9.4-alpha` | `9cdd873` |
| `master` 與本機 `origin/master` 參照 | `v0.2.7.3-alpha` | `f49668e` |

Git 暫存區在盤點時為空。遠端即時狀態與正式站部署狀態待核對。從 `dev` 重新 clone 只能取得已提交的版本。

## 2. 現況與程式入口

遊戲是單人靜態網頁 roguelite。玩家在安全據點整備，進入平原、森林、海岸或斷風高地。可用角色為冒險者、弓箭手與凱哥。角色成長與武器持有會保存。祝福與戰鬥狀態屬於單輪旅程。

| 區域 | 目前工作樹 | 從這裡找 |
| --- | --- | --- |
| 啟動與接線 | `game.js` 啟動 Application。`src/app/` 組裝功能與狀態。 | [啟動入口](game.js)、[Application](src/app/createApplication.js)、[戰鬥接線](src/app/createBattleFeatures.js)、[世界接線](src/app/createWorldFeatures.js) |
| 守隘劍研修 | 在森林、海岸與高地各完成守勢接反攻。到鐵匠鋪解鎖冒險反攻，再從角色裝備頁切換模式。 | [劍研修規則](src/core/weaponTraining.js)、[裝備介面](src/ui/characterEquipmentView.js) |
| 岩鎚研修 | 裝備鎮隘岩鎚。在高地開場至少兩名敵人的戰鬥中累積三層衝擊。用破勢命中，再於破綻消失前主攻命中同一目標。完成後到鐵匠鋪解鎖震岩裂陣。 | [岩鎚研修規則](src/core/hammerTraining.js)、[研修介面](src/ui/weaponTrainingView.js)、[武器戰鬥規則](src/core/weaponTechniques.js) |
| 高地戰術 | 風場、地形與敵人預告共同影響站位。戰術確認區顯示當前生命與護盾。 | [風場規則](src/core/highlandBattle.js)、[戰術預覽](src/core/highlandPreview.js)、[戰術介面](src/ui/tacticalBattleView.js) |
| 存檔與續玩 | Schema 14 包含兩種研修進度。岩鎚的戰鬥內判定資料隨旅程快照保存。 | [版本與 Schema](src/config.js)、[存檔遷移](src/core/saveMigrations.js)、[旅程快照](src/core/runSnapshot.js) |
| 單人範圍 | 多人連線與 Electron 已從本機方案移除。網頁單人流程仍需在本版完成回歸。 | [移除紀錄](MULTIPLAYER_REMOVAL_REVIEW.md) |

目前程式與研修介面的裂陣波及係數為 **100% 攻擊力**。這是待驗收值。[README](README.md) 的本版段落仍寫 **45%**。決定最終係數後，同步規則、玩家文案與 README。

## 3. 未完成項與驗收條件

### 3.1 保護歷史資料，再修正模型（R5-02、R5-01）

1. 備份 `tools/verification-artifacts/` 的 `r4-paired-45*` 與 `r4-paired-100*`。
2. 修正 [配對工具](tools/analyze-r4-gameplay.mjs) 的輸出防護。寫檔前比對預期係數與程式實際係數。
3. 補上可重建 45% 的來源版本或最小補丁。把 45% 和 100% 放在各自的工作副本執行。
4. 修正破勢追加傷害評分。依正式傷害規則套用護衛減傷、取整與剩餘生命截斷。
5. 檢查依賴追加傷害的存活判定與後續破綻收益。
6. 重跑原有配對與受影響場景。沿用 Lv.28、兩條高地路線、兩種構築與各 12 個種子，每個係數共 48 對。
7. 記錄兩種係數的分類、招式次數和關鍵案例差異。

**驗收條件**

- 在 100% 程式下要求 45% 輸出時，工具報錯並退出。歷史檔案保持原樣。
- 兩個正確來源的輸出各自標示實際係數與來源。
- 有護衛與無護衛的破勢估值都與正式直接傷害結算對得上。可用逆風路線、續航構築、種子 8 的第 7 場重現舊資料中的受保護目標。舊決策發生在行動前第 6 回合。
- 新結果保留比較證據，足以重審 100% 候選值。

**進度（2026-11-12）**　步驟1～3（R5-02）已完成並驗證，紀錄見 [修訂與驗證紀錄](企劃/v0.2.11.0_研修回饋修訂審查紀錄.md) 的「第五輪 R5-02」。

- 基準備份在 `tools/verification-artifacts/r4-baseline-backup-20261112/`，雜湊記錄在 `SHA256SUMS`。
- 配對工具的第二個參數現在是預期係數。與程式不符時停止，不寫檔。既有輸出預設不覆寫，新結果用 `--name=<後綴>` 另存。
- 45%用 `node tools/r4-reproduce-source.mjs 45 12 --compare` 在專案外的副本重跑，100%同理。兩者都已逐位元重現歷史基準。

步驟4～7（R5-01）也已完成，紀錄見同檔的「第五輪 R5-01」。

- 評分改用 `tools/r4-policy-damage.mjs`，由 `tools/tests/test-r4-policy-damage.mjs` 對照正式傷害。
- 修正後的資料存為 `r4-paired-45-r5fix*` 與 `r4-paired-100-r5fix*`。用 `node tools/compare-r4-paired.mjs <舊> <新>` 比較。
- 結果：100%唯一的 wave-only-win 消失。裂陣組與破勢組同為45／48勝，總回合只少34。高地第7場仍有4組場景以裂陣占優。

**3.1 尚待決定**　依修正後資料決定裂陣係數，再同步規則、玩家文案與 README。這屬於玩法判定，模型資料不能代替。

### 3.2 修正續航案例的結論（R5-03）

1. 開啟 [修訂與驗證紀錄](企劃/v0.2.11.0_研修回饋修訂審查紀錄.md) 的 R4-03。
2. 寫明該固定攻擊案例使用了哪些祝福與保命技能。
3. 保留回合、結束生命、護盾與低生命次數。
4. 若要判定某個來源是通關必要條件，補同條件下移除該來源的配對，或指出具體致死回合。

**驗收條件**　結論對應已記錄的觸發與結果。低生命區間保留原門檻定義。依現有資料先保留擊殺回血規則。

### 3.3 驗收玩法、平衡與真機（R2-07、R2-08）

| 未完成項 | 接手動作 | 驗收證據 |
| --- | --- | --- |
| 守隘劍重玩價值（R2-07） | 請玩家走完三區研修。觀察是否理解兩種反攻，是否願意回舊區與切換模式。 | 記錄玩家何時切換、為什麼切換，以及何處覺得像打卡。岩鎚也記錄首次玩家能否察覺連招機會。 |
| 高地固定策略（R2-08） | 比較代表性構築的固定攻擊、守勢交替與依預告調整的策略。 | 列出角色、武器、祝福、路線與觸發鏈。記錄何時需要改變打法，以及回合、生命與護盾的代價。 |
| 裂陣與跨區組合平衡 | 用修正後的資料評估 100% 候選值。涵蓋群怪、單體首領、護衛與跨區構築。 | 記錄裂陣和破勢各自占優的條件。海岸首領的指定策略 12 對均敗。若要簽收跨區首領平衡，另補適合首領的合法打法。 |
| 真機觸控與多輪遊玩 | 在實體手機操作公會長對話、第三敵選擇、戰術預告及確認。安排真人多輪遊玩。 | 記錄裝置、瀏覽器、操作與結果。確認預告、當前生命、護盾和確認按鈕可讀、可操作。螢幕閱讀器驗收仍待做。 |

第五輪已複核指定瀏覽器案例。320×640 可讀對話動畫、以鍵盤到達捲動兩端，並可同時看見戰術預告、生命／護盾和確認按鈕。第三敵位置由右欄移至中欄，與預覽一致。保留這些案例的既有判定。整區平衡與真人重玩意願仍待簽收。

### 3.4 跑完整回歸，再整理 Git 交付

1. 從副本根目錄先跑 `node tools/run-tests.mjs quick --match training`。
2. 跑 `node tools/run-tests.mjs quick --match highland`。
3. 跑 `node tools/run-tests.mjs full`。記錄通過數、失敗項與程序退出碼。**2026-11-12：112／112通過，以代碼0結束。**
4. 若程序在摘要後卡住，定位未退出的程序。修正或記錄原因後再複驗。
5. 用隔離存檔複驗安平鎮公會、鐵匠鋪、角色裝備、高地戰鬥、存檔遷移與續玩。
6. 在交付前核對搬移的測試、新增模組、素材與預期刪除項。依授權處理提交與發布。

第四輪的研修與高地篩選測試各印出 `4/4` 與 `5/5` 通過摘要。當時程序仍需手動停止。完整套件尚未驗收。

## 4. 啟動與重現

1. 從專案根目錄執行 `python tools/dev-server.py`。
2. 在隔離瀏覽器工作階段開啟 `http://127.0.0.1:4173/`。使用測試存檔。
3. 若要重現第四輪案例，改用 `python tools/dev-server.py --port 4197`。
4. 讓 Playwright runner 在隔離的頁面上呼叫 [第四輪瀏覽器案例](tools/verify-r4-browser.cjs) 的 `async page => …` 函式。該檔需要 runner 傳入 `page`。請在副本執行，腳本會寫入截圖。
5. 驗證後關閉測試瀏覽器。停止本輪啟動的伺服器與測試程序。

工具使用 Node.js 與 Python。專案的獨立瀏覽器測試使用 Microsoft Edge 與 Playwright。若外部安裝的 Playwright 無法直接載入，支援此設定的腳本可透過 `PLAYWRIGHT_MODULE` 指定模組的絕對路徑。請勿用日常存檔執行 Debug 操作或合成存檔案例。

## 5. 交給接手者的檔案

| 要交付的內容 | 確認方式 |
| --- | --- |
| 本機工作樹與 Git 基準 | 核對 `9cdd873`、`v0.2.11.0-alpha` 和 Schema 14。保留本機的已修改檔及預期刪除。 |
| 未追蹤的程式與素材 | 檢查 `src/core/weaponTraining.js`、`src/core/hammerTraining.js`、`src/ui/weaponTrainingView.js` 及 `assets/` 下新加入的 `.webp`、`.opus`。 |
| 測試與工具 | `tools/tests/` 現有 111 個 `test-*.mjs`。其中 107 個檔名對應 `tools/` 下的刪除項，另外 4 個是研修測試。附上 `tools/run-tests.mjs`、`tools/r3-review-harness.mjs` 及本次要用的 R3／R4 腳本。 |
| 本機審查資料 | 附上 [第五輪審查評論](企劃/v0.2.11.0_第五輪審查評論與問題.md)、[修訂與驗證紀錄](企劃/v0.2.11.0_研修回饋修訂審查紀錄.md) 與 [多人移除紀錄](MULTIPLAYER_REMOVAL_REVIEW.md)。`企劃/` 受 `.gitignore` 排除，須另附。 |
| 第四輪驗證證據 | 保留 [45% 摘要](tools/verification-artifacts/r4-paired-45-summary.json)、[100% 摘要](tools/verification-artifacts/r4-paired-100-summary.json)、[45% 完整資料](tools/verification-artifacts/r4-paired-45.json.gz)、[100% 完整資料](tools/verification-artifacts/r4-paired-100.json.gz)、[護衛案例](tools/verification-artifacts/r4-guard-scenes.json)、[瀏覽器結果](tools/verification-artifacts/r4-browser-results.json) 與 [320×640 截圖](tools/verification-artifacts/r4-low-hp-after.png)。 |

交付前檢查封包內容。排除憑證、日常存檔、瀏覽器暫存及無關草稿。舊版 [專案交接](傳說永恆_專案交接.md) 可供查架構與歷史。

本文使用繁體中文。步驟採短句、單句單一動作與明確的驗收條件。寫法參考 [ASD-STE100 Issue 9，Procedural writing](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf)。
