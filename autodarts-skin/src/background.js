// Opens the settings page when the toolbar icon is clicked.
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
