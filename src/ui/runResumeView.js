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
    discard.addEventListener("click", onDiscard);
    panel.append(title, detail, resume, discard);
    host.prepend(panel);
    panels.push({ panel, detail, resume });
  }
  return Object.freeze({
    render({ exists, valid, description }) {
      for (const view of panels) {
        view.panel.hidden = !exists;
        view.detail.textContent = description;
        view.resume.disabled = !valid;
      }
    }
  });
}
