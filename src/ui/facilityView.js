export function renderFacilityListView({ els, safeArea, facilities, onFacilityClick }) {
  els.facilityAreaName.textContent = safeArea?.name || "安全區";
  els.facilityPlacesTitle.textContent = safeArea?.placesTitle || "可前往地點";
  els.facilityPlacesDescription.textContent = safeArea?.placesDescription || "看看周圍還有哪些地方。";
  els.facilityBackButton.textContent = `回${safeArea?.name || "安全區"}`;
  els.facilityList.replaceChildren();
  els.facilityEmpty.classList.toggle("is-hidden", facilities.length > 0);

  facilities.forEach((facility) => {
    const button = document.createElement("button");
    button.className = "facility-button";
    button.type = "button";

    const name = document.createElement("strong");
    const description = document.createElement("small");
    const status = document.createElement("span");
    name.textContent = facility.name;
    description.textContent = facility.description || "";
    status.className = "facility-status";
    status.textContent = "可使用";
    button.append(name, description, status);
    button.addEventListener("click", () => onFacilityClick(facility));
    els.facilityList.append(button);
  });
}
