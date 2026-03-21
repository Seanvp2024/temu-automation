const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getAppPath: () => ipcRenderer.invoke("get-app-path"),

  automation: {
    login: (accountId, phone, password) =>
      ipcRenderer.invoke("automation:login", accountId, phone, password),
    scrapeProducts: () =>
      ipcRenderer.invoke("automation:scrape-products"),
    scrapeOrders: () =>
      ipcRenderer.invoke("automation:scrape-orders"),
    scrapeSales: () =>
      ipcRenderer.invoke("automation:scrape-sales"),
    close: () =>
      ipcRenderer.invoke("automation:close"),
    ping: () =>
      ipcRenderer.invoke("automation:ping"),
  },

  onAutomationEvent: (callback) => {
    ipcRenderer.on("automation-event", (_, data) => callback(data));
  },

  store: {
    get: (key) => ipcRenderer.invoke("store:get", key),
    set: (key, data) => ipcRenderer.invoke("store:set", key, data),
  },
});
