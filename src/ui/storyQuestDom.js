export function getStoryQuestElements(documentRef = document) {
  return {
    storyQuestAreaLabel: documentRef.querySelector("#storyQuestAreaLabel"),
    storyQuestBackButton: documentRef.querySelector("#storyQuestBackButton"),
    storyQuestActiveList: documentRef.querySelector("#storyQuestActiveList"),
    storyQuestActiveEmpty: documentRef.querySelector("#storyQuestActiveEmpty"),
    storyQuestCompletedList: documentRef.querySelector("#storyQuestCompletedList"),
    storyQuestCompletedEmpty: documentRef.querySelector("#storyQuestCompletedEmpty")
  };
}
