// ============================================================
// sync.js — 远程同步逻辑（在 data.js 之前加载）
// ============================================================

const Sync = {
    _pushTimer: null,
    _pullTimer: null,
    _PULL_INTERVAL: 30000,  // 30 秒
    _PUSH_DELAY: 500,       // 500ms debounce

    // 延迟推送到服务器
    debounceSave() {
        clearTimeout(this._pushTimer);
        this._pushTimer = setTimeout(() => {
            StorageAdapter.pushToServer();
        }, this._PUSH_DELAY);
    },

    // 启动定期拉取
    startPull() {
        if (StorageAdapter._mode !== 'remote') return;
        this._pullTimer = setInterval(() => {
            StorageAdapter.pullFromServer();
        }, this._PULL_INTERVAL);
    },

    // 初始化：remote 模式下首次拉取（不再定时拉取，避免覆盖本地数据）
    async init() {
        if (StorageAdapter._mode !== 'remote') return;
        try {
            await StorageAdapter.pullFromServer();
        } catch (e) {
            console.warn('首次同步失败，使用本地缓存:', e.message);
        }
    },

    // 停止同步
    stop() {
        clearTimeout(this._pushTimer);
        clearInterval(this._pullTimer);
    }
};
