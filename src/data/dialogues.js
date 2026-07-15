const storyFlagCondition = (key, value) => Object.freeze({
  type: "storyFlag",
  key,
  operator: "equals",
  value
});

const gotoNode = (nodeId) => Object.freeze({ type: "gotoNode", nodeId });

export const dialogueDefinitions = Object.freeze({
  "anping-blacksmith-main": Object.freeze({
    id: "anping-blacksmith-main",
    npcId: "anping-blacksmith",
    entryRules: Object.freeze([
      Object.freeze({
        conditions: Object.freeze([storyFlagCondition("knowsAnpingBlacksmithName", true)]),
        nodeId: "known-name-greeting"
      }),
      Object.freeze({
        conditions: Object.freeze([storyFlagCondition("metAnpingBlacksmith", false)]),
        nodeId: "first-meeting"
      })
    ]),
    fallbackNodeId: "default-greeting",
    nodes: Object.freeze({
      "first-meeting": Object.freeze({
        pages: Object.freeze([
          Object.freeze({ text: "……有事？" }),
          Object.freeze({ text: "要打造武器，就把材料放到桌上。別靠爐子太近。" }),
          Object.freeze({ text: "我只做能讓人活著回來的東西。其他的，別浪費爐火。" })
        ]),
        actionsOnComplete: Object.freeze([
          Object.freeze({ type: "setStoryFlag", key: "metAnpingBlacksmith", value: true })
        ]),
        nextNodeId: "default-greeting"
      }),
      "default-greeting": Object.freeze({
        pages: Object.freeze([Object.freeze({ text: "材料帶了？" })]),
        choices: Object.freeze([
          Object.freeze({
            id: "open-smithing",
            label: "進行鍛造",
            action: Object.freeze({ type: "openFacility", facilityId: "blacksmith" })
          }),
          Object.freeze({ id: "talk-weapons", label: "聊聊武器", action: gotoNode("about-weapons") }),
          Object.freeze({ id: "talk-anping", label: "聊聊安平鎮", action: gotoNode("about-anping") }),
          Object.freeze({
            id: "leave",
            label: "離開",
            action: Object.freeze({ type: "returnToFacilityList" })
          })
        ])
      }),
      "known-name-greeting": Object.freeze({
        pages: Object.freeze([Object.freeze({ text: "來了。要打造什麼？" })]),
        choices: Object.freeze([
          Object.freeze({
            id: "open-smithing-known",
            label: "進行鍛造",
            action: Object.freeze({ type: "openFacility", facilityId: "blacksmith" })
          }),
          Object.freeze({ id: "talk-weapons-known", label: "聊聊武器", action: gotoNode("about-weapons") }),
          Object.freeze({ id: "talk-anping-known", label: "聊聊安平鎮", action: gotoNode("about-anping") }),
          Object.freeze({ id: "talk-past", label: "聊聊你的過去", action: gotoNode("about-past") }),
          Object.freeze({
            id: "leave-known",
            label: "離開",
            action: Object.freeze({ type: "returnToFacilityList" })
          })
        ])
      }),
      "about-weapons": Object.freeze({
        pages: Object.freeze([
          Object.freeze({ text: "武器不是拿來炫耀的。" }),
          Object.freeze({ text: "材料、重心、刃口，少一樣，都可能害死人。" }),
          Object.freeze({ text: "帶著我打的東西出去，就好好用。別拿命逞強。" })
        ]),
        choices: Object.freeze([
          Object.freeze({ id: "ask-why-care", label: "你似乎很在意使用武器的人", action: gotoNode("about-craft-principle") }),
          Object.freeze({
            id: "finish-weapons-unknown",
            label: "先談到這裡",
            conditions: Object.freeze([storyFlagCondition("knowsAnpingBlacksmithName", false)]),
            action: gotoNode("default-greeting")
          }),
          Object.freeze({
            id: "finish-weapons-known",
            label: "先談到這裡",
            conditions: Object.freeze([storyFlagCondition("knowsAnpingBlacksmithName", true)]),
            action: gotoNode("known-name-greeting")
          })
        ])
      }),
      "about-craft-principle": Object.freeze({
        pages: Object.freeze([
          Object.freeze({ text: "我在意的是手藝。" }),
          Object.freeze({ text: "人回不來，再好的武器也只是廢鐵。" })
        ]),
        choices: Object.freeze([
          Object.freeze({
            id: "ask-name",
            label: "還沒問過該怎麼稱呼你",
            conditions: Object.freeze([storyFlagCondition("knowsAnpingBlacksmithName", false)]),
            action: gotoNode("ask-name")
          }),
          Object.freeze({
            id: "return-after-principle-unknown",
            label: "我明白了",
            conditions: Object.freeze([storyFlagCondition("knowsAnpingBlacksmithName", false)]),
            action: gotoNode("default-greeting")
          }),
          Object.freeze({
            id: "return-after-principle-known",
            label: "我明白了",
            conditions: Object.freeze([storyFlagCondition("knowsAnpingBlacksmithName", true)]),
            action: gotoNode("known-name-greeting")
          })
        ])
      }),
      "ask-name": Object.freeze({
        pages: Object.freeze([
          Object.freeze({ text: "……名字？" }),
          Object.freeze({ text: "羅根。" }),
          Object.freeze({ text: "記住也好。至少別忘了，武器是拿來保命的。" })
        ]),
        actionsOnComplete: Object.freeze([
          Object.freeze({ type: "setStoryFlag", key: "knowsAnpingBlacksmithName", value: true })
        ]),
        nextNodeId: "known-name-greeting"
      }),
      "about-anping": Object.freeze({
        pages: Object.freeze([
          Object.freeze({ text: "安平鎮？夠安靜。" }),
          Object.freeze({ text: "海風重。鐵器放久了，容易生鏽。鎮上的人倒還算安分。" }),
          Object.freeze({ text: "你能從森林走到這裡，命是夠硬。別因此鬆懈。" })
        ]),
        choices: Object.freeze([
          Object.freeze({
            id: "return-anping-unknown",
            label: "我知道了",
            conditions: Object.freeze([storyFlagCondition("knowsAnpingBlacksmithName", false)]),
            action: gotoNode("default-greeting")
          }),
          Object.freeze({
            id: "return-anping-known",
            label: "我知道了",
            conditions: Object.freeze([storyFlagCondition("knowsAnpingBlacksmithName", true)]),
            action: gotoNode("known-name-greeting")
          })
        ])
      }),
      "about-past": Object.freeze({
        pages: Object.freeze([
          Object.freeze({ text: "以前的事，沒什麼好說的。" }),
          Object.freeze({ text: "我現在只是個打鐵的。" })
        ]),
        choices: Object.freeze([
          Object.freeze({ id: "return-from-past", label: "不再追問", action: gotoNode("known-name-greeting") })
        ])
      })
    })
  })
});

export function getDialogueDefinition(dialogueId) {
  return dialogueDefinitions[dialogueId] || null;
}
