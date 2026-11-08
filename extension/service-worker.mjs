import { createBridge } from "./bridge.mjs";

const bridge = createBridge({ chromeApi: chrome });
bridge.ready();
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  bridge.handle(message, sender).then(
    data => sendResponse({ ok: true, data }),
    error => sendResponse({ ok: false, error: error instanceof Error ? error.message : "The operation failed." }),
  );
  return true;
});
