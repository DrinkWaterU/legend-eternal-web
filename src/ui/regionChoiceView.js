import { getRegionDisplayName, getRegionSegmentName } from "../data/regions/regionDefinition.js";

export function renderRegionChoiceList({
  element,
  regions,
  documentRef = document,
  onSelect
}) {
  element.replaceChildren();
  Object.entries(regions).forEach(([regionId, region]) => {
    const button = documentRef.createElement("button");
    const heading = documentRef.createElement("span");
    const title = documentRef.createElement("strong");
    const meta = documentRef.createElement("small");
    const description = documentRef.createElement("em");
    const action = documentRef.createElement("b");
    const desktopBackground = region.visual?.background?.desktop;
    const mobileBackground = region.visual?.background?.mobile || desktopBackground;

    button.type = "button";
    button.className = "choice-button region-choice-card";
    if (desktopBackground) {
      button.style.setProperty(
        "--region-choice-background-desktop",
        toCssUrl(desktopBackground, documentRef.baseURI)
      );
      button.style.setProperty(
        "--region-choice-background-mobile",
        toCssUrl(mobileBackground, documentRef.baseURI)
      );
    }

    heading.className = "region-choice-heading";
    title.textContent = getRegionDisplayName(region);
    meta.textContent = region.recommendedLevel
      ? `${region.difficulty}｜${region.recommendedLevel}`
      : region.difficulty;
    const segmentName = getRegionSegmentName(region);
    description.textContent = segmentName === getRegionDisplayName(region)
      ? `${region.encounterCount} 場遭遇，首領：${region.bossName}`
      : `${segmentName}段落｜${region.encounterCount} 場遭遇，首領：${region.bossName}`;
    action.textContent = "查看地區";
    heading.append(title, meta);
    button.append(heading, description, action);
    button.addEventListener("click", () => onSelect?.(regionId));
    element.append(button);
  });
}

function toCssUrl(path, baseURI) {
  return `url(${JSON.stringify(new URL(path, baseURI).href)})`;
}
