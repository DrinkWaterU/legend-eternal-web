import { showCampLayout, showEventLayout } from "./eventView.js";
import { renderCampBlessingChoices, renderChoiceList, renderStatList } from "./renderHelpers.js";

export function renderBeachSegmentChoice({ els, onFinish, onCamp }) {
  showEventLayout(els);
  els.eventEyebrow.textContent = "海岸・海灘段落完成";
  els.eventTitle.textContent = "潮聲沒有在 Boss 倒下後停止。";
  els.eventNarrative.replaceChildren();
  [
    "海灘的戰鬥已經結束，但海岸的路還沒有走完。",
    "你可以現在收起這段旅途，或在潮聲裡整理祝福，前往海岸洞穴。"
  ].forEach((text, index, lines) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    if (index === lines.length - 1) paragraph.classList.add("event-narrative-emphasis");
    els.eventNarrative.append(paragraph);
  });
  els.eventPrompt.textContent = "接下來要怎麼做？";
  els.eventPrompt.hidden = false;
  els.eventReward.replaceChildren();
  els.eventReward.hidden = true;
  els.eventContinueButton.hidden = true;
  renderChoiceList(els.eventChoices, [
    {
      title: "結束海灘冒險",
      meta: "結算本輪目前成果",
      description: "帶著海灘的收穫回到出發地，這輪冒險就此結束。",
      action: "結束本輪",
      onClick: onFinish
    },
    {
      title: "扎營並前往海岸洞穴",
      meta: "回復生命並整理祝福",
      description: "回復至重建後最大生命的 50%，從目前祝福中選出 8 個帶進下一段路。",
      action: "開始扎營",
      onClick: onCamp
    }
  ]);
  els.resultLabel.textContent = "海灘段落完成";
  els.encounterLabel.textContent = "海岸｜海灘 Boss 後";
}

export function renderCampSelectionView({ els, instances, selectedIds, hpRatio = 50, message = "", onToggle }) {
  showCampLayout(els);
  els.campTransitionEyebrow.textContent = "海岸・中繼扎營";
  els.campTransitionTitle.textContent = "在潮聲裡整理下一段路。";
  els.campTransitionNarrative.replaceChildren();
  [
    "這裡不是安全區，也不會結束本輪冒險。",
    "扎營只會回復生命，接著請從已取得的祝福中選出要帶進海岸洞穴的 8 個。"
  ].forEach((text) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    els.campTransitionNarrative.append(paragraph);
  });
  renderStatList(els.campTransitionSummary, [
    ["生命", `${hpRatio}%`],
    ["可帶入", `${instances.length} 個祝福`],
    ["保留", `${selectedIds.length} / 8 個`],
    ["下一段", "海岸洞穴"]
  ]);
  els.campTransitionReminder.textContent = "祝福的立即恢復效果不會在扎營時再次觸發；扎營只會回復至重建後最大生命的 50%。";
  els.campTransitionBlessingSection.hidden = false;
  els.campTransitionReadySection.hidden = true;
  els.campTransitionSelectionHint.textContent = "同名祝福仍會分開列出；點擊卡片只會預覽保留配置。";
  els.campTransitionSelectionCount.textContent = `已選 ${selectedIds.length} / 8`;
  els.campTransitionMessage.textContent = message || (instances.length < 8
    ? "目前可帶入的祝福不足 8 個，暫時無法完成扎營。"
    : selectedIds.length === 8
      ? "已選滿 8 個祝福，可以確認配置。"
      : "請選出 8 個要帶進海岸洞穴的祝福。");
  renderCampBlessingChoices(
    els.campTransitionBlessingGrid,
    instances,
    selectedIds,
    onToggle
  );
  els.campTransitionConfirmButton.textContent = selectedIds.length === 8
    ? "確認祝福配置"
    : `選擇 ${Math.max(0, 8 - selectedIds.length)} 個祝福`;
  els.campTransitionConfirmButton.disabled = selectedIds.length !== 8 || instances.length < 8;
  els.campTransitionBackButton.disabled = false;
  els.resultLabel.textContent = "中繼扎營";
  els.encounterLabel.textContent = "海岸｜祝福配置";
}

export function renderCampReadyView({ els, hpRatio = 50 }) {
  showCampLayout(els);
  els.campTransitionEyebrow.textContent = "海岸・中繼扎營完成";
  els.campTransitionTitle.textContent = "下一段路已經準備好。";
  els.campTransitionNarrative.replaceChildren();
  [
    `你已經把生命整理到最大生命的 ${hpRatio}%，也選好了要帶走的祝福。`,
    "海岸洞穴的入口會從這裡接續，請沿著潮聲繼續前進。"
  ].forEach((text) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    els.campTransitionNarrative.append(paragraph);
  });
  renderStatList(els.campTransitionSummary, [
    ["生命", `${hpRatio}%`],
    ["保留", "8 個祝福"],
    ["狀態", "延續本輪冒險"],
    ["下一段", "海岸洞穴"]
  ]);
  els.campTransitionReminder.textContent = "本輪冒險尚未結束；下一段內容會從目前的生命、祝福與冒險進度接續。";
  els.campTransitionBlessingSection.hidden = true;
  els.campTransitionReadySection.hidden = false;
  els.campTransitionReadyText.textContent = "中繼整備已完成，等待下一段冒險入口接續。";
  els.campTransitionBackButton.disabled = true;
  els.campTransitionConfirmButton.disabled = true;
  els.resultLabel.textContent = "中繼整備完成";
  els.encounterLabel.textContent = "海岸｜等待下一段冒險";
}
