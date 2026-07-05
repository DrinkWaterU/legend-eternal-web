import achievementsData from "./achievements.json" with { type: "json" };

export const achievementDefinitions = achievementsData;

export function getAchievementDefinition(achievementId) {
  return achievementDefinitions[achievementId] || null;
}
