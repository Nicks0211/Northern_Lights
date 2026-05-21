chrome.runtime.onInstalled.addListener(() => {

  chrome.contextMenus.create({
    id: "open-nexus",
    title: "Abrir NEXUS AI",
    contexts: ["all"]
  });

});

chrome.contextMenus.onClicked.addListener((info, tab) => {

  if (info.menuItemId === "open-nexus") {

    chrome.tabs.sendMessage(tab.id, {
      action: "toggle_nexus"
    });

  }

});