export function createRunResumeView({ documentRef = document, onResume, onDiscard }) {
  const panels = [];
  for (const selector of ["#menuScreen .menu-layout", "#campScreen .camp-layout"]) {
    const host = documentRef.querySelector(selector);
    if (!host) continue;
    const panel = documentRef.createElement("section");
    panel.className = "run-resume-panel";
    panel.setAttribute("aria-label", "待續旅程");
    const title = documentRef.createElement("h3");
    title.textContent = "旅途還在等你";
    const detail = documentRef.createElement("p");
    detail.className = "run-resume-detail";
    const resume = documentRef.createElement("button");
    resume.type = "button";
    resume.className = "resume-run-button primary-button";
    resume.textContent = "繼續冒險";
    resume.addEventListener("click", onResume);
    const discard = documentRef.createElement("button");
    discard.type = "button";
    discard.className = "discard-run-button secondary-button";
    discard.textContent = "結束這段旅程";
    // 結束旅程改在面板內二次確認，不使用瀏覽器原生 confirm（內嵌瀏覽器與部分環境會直接擋掉）。
    const confirmBox = documentRef.createElement("div");
    confirmBox.className = "run-resume-confirm";
    confirmBox.hidden = true;
    confirmBox.setAttribute("role", "alertdialog");
    confirmBox.setAttribute("aria-label", "確認結束旅程");
    const warning = documentRef.createElement("p");
    warning.textContent = "結束這段旅程？已保存的角色成長與素材會保留，這次冒險將無法再續玩。";
    const confirm = documentRef.createElement("button");
    confirm.type = "button";
    confirm.className = "confirm-discard-run-button danger-button";
    confirm.textContent = "確定結束";
    const cancel = documentRef.createElement("button");
    cancel.type = "button";
    cancel.className = "cancel-discard-run-button secondary-button";
    cancel.textContent = "先不要";
    confirmBox.append(warning, confirm, cancel);
    const setConfirming = (confirming) => {
      confirmBox.hidden = !confirming;
      resume.hidden = confirming;
      discard.hidden = confirming;
    };
    discard.addEventListener("click", () => { setConfirming(true); cancel.focus?.(); });
    cancel.addEventListener("click", () => { setConfirming(false); discard.focus?.(); });
    confirm.addEventListener("click", () => { setConfirming(false); onDiscard(); });
    panel.append(title, detail, resume, discard, confirmBox);
    host.prepend(panel);
    panels.push({ panel, detail, resume, setConfirming });
  }
  return Object.freeze({
    render({ exists, valid, description }) {
      for (const view of panels) {
        view.panel.hidden = !exists;
        if (!exists) view.setConfirming(false);
        view.detail.textContent = description;
        view.resume.disabled = !valid;
      }
    }
  });
}
