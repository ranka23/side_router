function Storage() {
  this.get = async (keys) => {
    try {
      return await chrome.storage.local.get(keys);
    } catch {
      return {};
    }
  };

  this.set = async (data) => {
    try {
      return await chrome.storage.local.set(data);
    } catch {
      return false;
    }
  };

  this.remove = async (keys) => {
    try {
      return await chrome.storage.local.remove(keys);
    } catch {
      return false;
    }
  };
}

window.Storage = Storage;