// ============================================================
// Data Layer - LocalStorage based data management
// ============================================================

const DB = {
    KEYS: {
        MODELS: 'dlt_models',
        EXPERIMENTS: 'dlt_experiments',
        HYPERPARAMS: 'dlt_hyperparams',
        TRAINING_LOGS: 'dlt_training_logs',
        TEST_RESULTS: 'dlt_test_results',
        TAGS: 'dlt_tags'
    },

    // Generate UUID
    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    },

    // Generic CRUD
    _getAll(key) {
        if (StorageAdapter._mode === 'remote') {
            return StorageAdapter._cache[key] || [];
        }
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch {
            return [];
        }
    },

    _saveAll(key, data) {
        if (StorageAdapter._mode === 'remote') {
            StorageAdapter._cache[key] = data;
            // 同时写入 localStorage 作为本地缓存，防止刷新丢失
            try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
            Sync.debounceSave();
            return;
        }
        localStorage.setItem(key, JSON.stringify(data));
    },

    _getById(key, id) {
        return this._getAll(key).find(item => item.id === id);
    },

    _add(key, item) {
        const all = this._getAll(key);
        all.push(item);
        this._saveAll(key, all);
        return item;
    },

    _update(key, id, updates) {
        const all = this._getAll(key);
        const idx = all.findIndex(item => item.id === id);
        if (idx === -1) return null;
        all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
        this._saveAll(key, all);
        return all[idx];
    },

    _delete(key, id) {
        const all = this._getAll(key);
        this._saveAll(key, all.filter(item => item.id !== id));
    },

    // ==================== Models ====================
    getModels() {
        return this._getAll(this.KEYS.MODELS).sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    },

    getModel(id) {
        return this._getById(this.KEYS.MODELS, id);
    },

    createModel(name) {
        return this._add(this.KEYS.MODELS, {
            id: this.uuid(),
            name: name.trim(),
            createdAt: new Date().toISOString()
        });
    },

    updateModel(id, updates) {
        return this._update(this.KEYS.MODELS, id, updates);
    },

    deleteModel(id) {
        const experiments = this.getExperiments(id);
        experiments.forEach(exp => this.deleteExperiment(exp.id));
        this._delete(this.KEYS.MODELS, id);
    },

    // ==================== Experiments ====================
    getExperiments(modelId) {
        let exps = this._getAll(this.KEYS.EXPERIMENTS);
        if (modelId !== undefined) exps = exps.filter(exp => exp.modelId === modelId);
        return exps
            .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
            .map(exp => this._hydrateExperiment(exp));
    },

    getExperiment(id) {
        return this._hydrateExperiment(this._getById(this.KEYS.EXPERIMENTS, id));
    },

    _hydrateExperiment(exp) {
        if (!exp) return exp;
        const testResult = this.getTestResult(exp.id);
        if (!testResult) return exp;

        return {
            ...exp,
            testResults: testResult.results || exp.testResults || [],
            testResultDetail: {
                summary: testResult.summary || {},
                predictions: testResult.predictions || [],
                confusionMatrix: testResult.confusionMatrix || null
            }
        };
    },

    createExperiment(modelId, data) {
        return this._add(this.KEYS.EXPERIMENTS, {
            id: this.uuid(),
            modelId,
            name: data.name || 'Untitled Experiment',
            date: data.date || new Date().toISOString().split('T')[0],
            notes: data.notes || '',
            tags: data.tags || [],
            cardDisplayKeys: data.cardDisplayKeys || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    },

    updateExperiment(id, updates) {
        return this._update(this.KEYS.EXPERIMENTS, id, updates);
    },

    deleteExperiment(id) {
        this._delete(this.KEYS.HYPERPARAMS, id);
        this._delete(this.KEYS.TRAINING_LOGS, id);
        this._delete(this.KEYS.TEST_RESULTS, id);
        const allParams = this._getAll(this.KEYS.HYPERPARAMS);
        this._saveAll(this.KEYS.HYPERPARAMS, allParams.filter(p => p.experimentId !== id));
        const allLogs = this._getAll(this.KEYS.TRAINING_LOGS);
        this._saveAll(this.KEYS.TRAINING_LOGS, allLogs.filter(l => l.experimentId !== id));
        const allResults = this._getAll(this.KEYS.TEST_RESULTS);
        this._saveAll(this.KEYS.TEST_RESULTS, allResults.filter(r => r.experimentId !== id));
        this._delete(this.KEYS.EXPERIMENTS, id);
    },

    batchDeleteExperiments(ids) {
        ids.forEach(id => this.deleteExperiment(id));
    },

    // ==================== HyperParams ====================
    getHyperParams(experimentId) {
        return this._getAll(this.KEYS.HYPERPARAMS).find(p => p.experimentId === experimentId);
    },

    saveHyperParams(experimentId, params) {
        const all = this._getAll(this.KEYS.HYPERPARAMS);
        const idx = all.findIndex(p => p.experimentId === experimentId);
        const record = {
            id: idx >= 0 ? all[idx].id : this.uuid(),
            experimentId,
            params: params || {}
        };
        if (idx >= 0) {
            all[idx] = record;
        } else {
            all.push(record);
        }
        this._saveAll(this.KEYS.HYPERPARAMS, all);
        return record;
    },

    // ==================== Training Logs ====================
    getTrainingLog(experimentId) {
        return this._getAll(this.KEYS.TRAINING_LOGS).find(l => l.experimentId === experimentId);
    },

    saveTrainingLog(experimentId, data) {
        const all = this._getAll(this.KEYS.TRAINING_LOGS);
        const idx = all.findIndex(l => l.experimentId === experimentId);
        const record = {
            id: idx >= 0 ? all[idx].id : this.uuid(),
            experimentId,
            ...data
        };
        if (idx >= 0) {
            all[idx] = record;
        } else {
            all.push(record);
        }
        this._saveAll(this.KEYS.TRAINING_LOGS, all);
        return record;
    },

    deleteTrainingLog(experimentId) {
        const all = this._getAll(this.KEYS.TRAINING_LOGS);
        this._saveAll(this.KEYS.TRAINING_LOGS, all.filter(l => l.experimentId !== experimentId));
    },

    // ==================== Test Results ====================
    getTestResult(experimentId) {
        return this._getAll(this.KEYS.TEST_RESULTS).find(r => r.experimentId === experimentId);
    },

    saveTestResult(experimentId, data) {
        const all = this._getAll(this.KEYS.TEST_RESULTS);
        const idx = all.findIndex(r => r.experimentId === experimentId);
        const detail = data.testResultDetail || data.detail || data;
        const record = {
            id: idx >= 0 ? all[idx].id : this.uuid(),
            experimentId,
            summary: detail.summary || {},
            predictions: detail.predictions || [],
            confusionMatrix: detail.confusionMatrix || null,
            results: data.testResults || data.results || [],
            updatedAt: new Date().toISOString()
        };
        if (idx >= 0) {
            all[idx] = record;
        } else {
            all.push(record);
        }
        this._saveAll(this.KEYS.TEST_RESULTS, all);
        return record;
    },

    deleteTestResult(experimentId) {
        const all = this._getAll(this.KEYS.TEST_RESULTS);
        this._saveAll(this.KEYS.TEST_RESULTS, all.filter(r => r.experimentId !== experimentId));
    },

    // ==================== Tags ====================
    getAllTags() {
        const experiments = this._getAll(this.KEYS.EXPERIMENTS);
        const tags = new Set();
        experiments.forEach(exp => {
            (exp.tags || []).forEach(tag => tags.add(tag));
        });
        return [...tags].sort();
    },

    // ==================== Summary Helpers ====================
    getExperimentSummary(experimentId) {
        const log = this.getTrainingLog(experimentId);
        const result = this.getTestResult(experimentId);
        const params = this.getHyperParams(experimentId);

        return {
            bestValAcc: log?.bestValAcc ?? null,
            bestEpoch: log?.bestEpoch ?? null,
            totalEpochs: log?.totalEpochs ?? null,
            testAcc: result?.summary?.testAcc ?? null,
            hyperParams: params?.params || {}
        };
    },

    // ==================== Export ====================
    exportExperiment(experimentId) {
        const exp = this.getExperiment(experimentId);
        if (!exp) return null;

        const summary = this.getExperimentSummary(experimentId);
        const log = this.getTrainingLog(experimentId);
        const storedResult = this.getTestResult(experimentId);
        const result = storedResult || exp.testResultDetail;

        return {
            experiment: exp,
            hyperParams: summary.hyperParams,
            trainingLog: log ? {
                columns: log.columns,
                epochs: log.epochs,
                bestEpoch: log.bestEpoch,
                bestValAcc: log.bestValAcc,
                totalEpochs: log.totalEpochs
            } : null,
            testResult: result ? {
                summary: result.summary,
                predictions: result.predictions,
                confusionMatrix: result.confusionMatrix
            } : null
        };
    },

    // Generate CSV from exported data
    exportToCSV(experimentId) {
        const data = this.exportExperiment(experimentId);
        if (!data) return null;

        let csv = '';

        // Section 1: Config
        csv += '# Experiment Configuration\n';
        csv += `# Name,${data.experiment.name}\n`;
        csv += `# Date,${data.experiment.date || ''}\n`;
        csv += `# Notes,${(data.experiment.notes || data.experiment.description || '').replace(/\n/g, ' ')}\n`;
        csv += `# Tags,${(data.experiment.tags || []).join(';')}\n`;
        csv += '#\n';

        // Section 2: HyperParams
        const hp = data.hyperParams;
        let hpEntries = [];
        if (Array.isArray(hp)) {
            hpEntries = hp.map(p => [p.key, p.value]);
        } else if (hp && typeof hp === 'object') {
            hpEntries = Object.entries(hp);
        }
        if (hpEntries.length > 0) {
            csv += '# HyperParameters\n';
            hpEntries.forEach(([k, v]) => {
                csv += `# ${k},${v}\n`;
            });
            csv += '#\n';
        }

        // Section 3: Training Log
        if (data.trainingLog) {
            csv += '===== Training Data =====\n';
            csv += data.trainingLog.columns.join(',') + '\n';
            data.trainingLog.epochs.forEach(epoch => {
                csv += data.trainingLog.columns.map(col => epoch[col] ?? '').join(',') + '\n';
            });
            csv += '\n';
        }

        // Section 4: Test Results
        if (data.testResult) {
            csv += '===== Test Results =====\n';
            csv += 'Test Summary\n';
            if (data.testResult.summary) {
                Object.entries(data.testResult.summary).forEach(([k, v]) => {
                    csv += `${k},${v}\n`;
                });
            }
            csv += '\n';

            if (data.testResult.predictions && data.testResult.predictions.length > 0) {
                csv += 'file_path,actual_label,predict_label,confidence\n';
                data.testResult.predictions.forEach(p => {
                    csv += `${p.filePath},${p.actualLabel},${p.predictLabel},${p.confidence}\n`;
                });
                csv += '\n';
            }

            if (data.testResult.confusionMatrix) {
                csv += 'Confusion Matrix\n';
                const cm = data.testResult.confusionMatrix;
                csv += 'actual/predict,' + cm.labels.join(',') + '\n';
                cm.matrix.forEach((row, i) => {
                    csv += cm.labels[i] + ',' + row.join(',') + '\n';
                });
            }
        }

        return csv;
    }
};

// ============================================================
// StorageAdapter — 本地/远程存储抽象层
// ============================================================
const StorageAdapter = {
    _mode: 'local',
    _cache: {},
    _apiUrl: '/api/data',
    _lastPull: 0,

    init() {
        // 始终使用远程模式，数据存储在服务器端
        this._mode = 'remote';
    },

    // 从 localStorage 读取全量状态
    _getState() {
        if (this._mode === 'remote') {
            const state = {};
            for (const [name, key] of Object.entries(DB.KEYS)) {
                state[name] = this._cache[key] || [];
            }
            return state;
        }
        const state = {};
        for (const [name, key] of Object.entries(DB.KEYS)) {
            try {
                state[name] = JSON.parse(localStorage.getItem(key)) || [];
            } catch {
                state[name] = [];
            }
        }
        return state;
    },

    // 写入全量状态到 localStorage
    _setState(state) {
        for (const [name, key] of Object.entries(DB.KEYS)) {
            if (state[name] !== undefined) {
                if (this._mode === 'remote') {
                    this._cache[key] = state[name];
                } else {
                    localStorage.setItem(key, JSON.stringify(state[name]));
                }
            }
        }
    },

    _normalizeServerState(serverState) {
        const normalized = {};
        for (const [serverKey, frontendKey] of Object.entries(DB.KEYS)) {
            if (Array.isArray(serverState[serverKey])) {
                normalized[serverKey] = serverState[serverKey];
            } else if (Array.isArray(serverState[frontendKey])) {
                normalized[serverKey] = serverState[frontendKey];
            }
        }
        return normalized;
    },

    // 前端缓存 key → 服务器 key 映射
    _SERVER_KEYS: null,
    _getServerKeys() {
        if (this._SERVER_KEYS) return this._SERVER_KEYS;
        this._SERVER_KEYS = {};
        for (const [serverKey, frontendKey] of Object.entries(DB.KEYS)) {
            this._SERVER_KEYS[frontendKey] = serverKey;
        }
        return this._SERVER_KEYS;
    },

    // 推送到服务器
    async pushToServer() {
        if (this._mode !== 'remote') return;
        try {
            // 从缓存读取，转换为服务器格式
            const serverData = {};
            const serverKeys = this._getServerKeys();
            for (const [frontendKey, serverKey] of Object.entries(serverKeys)) {
                serverData[serverKey] = this._cache[frontendKey] || [];
            }
            const res = await fetch(this._apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serverData)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            console.warn('推送失败:', e.message);
        }
    },

    // 合并服务器数据到本地（以本地为准，只补充服务器有而本地没有的）
    _mergeState(serverState) {
        for (const [name, key] of Object.entries(DB.KEYS)) {
            const serverItems = serverState[name];
            if (!Array.isArray(serverItems) || serverItems.length === 0) continue;
            const localItems = this._mode === 'remote'
                ? (this._cache[key] || [])
                : JSON.parse(localStorage.getItem(key) || '[]');
            const localById = new Map(localItems.map(item => [item.id, item]));
            let changed = false;

            for (const serverItem of serverItems) {
                const localItem = localById.get(serverItem.id);
                if (!localItem) {
                    localById.set(serverItem.id, serverItem);
                    changed = true;
                    continue;
                }

                const serverTime = Date.parse(serverItem.updatedAt || serverItem.createdAt || 0);
                const localTime = Date.parse(localItem.updatedAt || localItem.createdAt || 0);
                if (!localTime || serverTime >= localTime) {
                    localById.set(serverItem.id, serverItem);
                    changed = true;
                }
            }

            if (changed) {
                const merged = [...localById.values()];
                if (this._mode === 'remote') {
                    this._cache[key] = merged;
                } else {
                    localStorage.setItem(key, JSON.stringify(merged));
                }
            }
        }
    },

    // 从服务器拉取（合并模式，不覆盖本地数据）
    async pullFromServer() {
        if (this._mode !== 'remote') return;
        try {
            const res = await fetch(this._apiUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const serverState = this._normalizeServerState(await res.json());
            if (serverState && typeof serverState === 'object' && Object.keys(serverState).length > 0) {
                this._mergeState(serverState);
                Data.refresh();
                if (typeof app !== 'undefined' && app.currentView) {
                    app.navigate(app.currentView);
                }
                this._lastPull = Date.now();
            }
        } catch (e) {
            console.warn('拉取失败:', e.message);
        }
    }
};

// ==================== UI 兼容层 ====================
const Data = {
    models: {},
    experiments: {},

    refresh() {
        this.models = {};
        DB.getModels().forEach(m => { this.models[m.id] = m; });
        this.experiments = {};
        DB.getExperiments().forEach(e => { this.experiments[e.id] = e; });
    },

    save() { this.refresh(); },

    getModels() { return DB.getModels(); },
    getModel(id) { return DB.getModel(id); },
    getModelById(id) { return this.models[id] || DB.getModel(id); },
    getExperiments(modelId) {
        if (modelId === undefined) return Object.values(this.experiments);
        return DB.getExperiments(modelId);
    },
    getExperiment(id) { return DB.getExperiment(id); },
    getExperimentById(id) { return this.experiments[id] || DB.getExperiment(id); },

    addModel(name, description) {
        const m = DB.createModel(name);
        if (description) DB.updateModel(m.id, { description });
        this.models[m.id] = DB.getModel(m.id);
        return m.id;
    },

    deleteModel(id) {
        if (!this.models[id]) {
            const found = Object.values(this.models).find(m => m.name === id);
            if (found) id = found.id;
        }
        DB.deleteModel(id);
        this.refresh();
    },

    addExperiment(modelId, name) {
        const e = DB.createExperiment(modelId, { name });
        this.experiments[e.id] = e;
        return e.id;
    },

    updateExperiment(id, data) {
        const { testResultDetail, testResults, ...experimentUpdates } = data;
        DB.updateExperiment(id, experimentUpdates);
        if (data.hyperParams) DB.saveHyperParams(id, data.hyperParams);
        if (testResultDetail !== undefined || testResults !== undefined) {
            const existing = DB.getTestResult(id);
            DB.saveTestResult(id, {
                testResultDetail: testResultDetail !== undefined ? testResultDetail : existing,
                testResults: testResults !== undefined ? testResults : (existing?.results || [])
            });
        }
        this.experiments[id] = DB.getExperiment(id);
    },

    deleteExperiment(id) {
        DB.deleteExperiment(id);
        delete this.experiments[id];
    },

    addTrainingLog(experimentId, csvText) {
        const parsed = CSVParser.parseTrainingLog(csvText);
        if (!parsed.success) return;
        DB.saveTrainingLog(experimentId, {
            columns: parsed.columns,
            epochs: parsed.epochs,
            rows: parsed.epochs.map(e => parsed.columns.map(c => e[c] ?? '')),
            bestValAcc: parsed.bestValAcc,
            bestEpoch: parsed.bestEpoch,
            totalEpochs: parsed.totalEpochs,
            hyperParams: parsed.hyperParams || {}
        });
    },

    getTrainingLog(experimentId) { return DB.getTrainingLog(experimentId); },
    getHyperParams(experimentId) { return DB.getHyperParams(experimentId); },
    saveHyperParams(experimentId, params) { DB.saveHyperParams(experimentId, params); },

    getTestResult(experimentId) { return DB.getTestResult(experimentId); },
    saveTestResult(experimentId, data) { DB.saveTestResult(experimentId, data); },
    deleteTestResult(experimentId) { DB.deleteTestResult(experimentId); },

    exportAll() {
        return {
            models: DB.getModels(),
            experiments: DB._getAll(DB.KEYS.EXPERIMENTS),
            hyperparams: DB._getAll(DB.KEYS.HYPERPARAMS),
            trainingLogs: DB._getAll(DB.KEYS.TRAINING_LOGS),
            testResults: DB._getAll(DB.KEYS.TEST_RESULTS)
        };
    },

    importAll(data) {
        // 支持旧格式（只有 models/experiments）和新格式（包含所有数据）
        const fieldMap = {
            models: DB.KEYS.MODELS,
            experiments: DB.KEYS.EXPERIMENTS,
            hyperparams: DB.KEYS.HYPERPARAMS,
            trainingLogs: DB.KEYS.TRAINING_LOGS,
            testResults: DB.KEYS.TEST_RESULTS
        };
        for (const [field, cacheKey] of Object.entries(fieldMap)) {
            if (data[field] && Array.isArray(data[field])) {
                StorageAdapter._cache[cacheKey] = data[field];
                try { localStorage.setItem(cacheKey, JSON.stringify(data[field])); } catch (e) {}
            }
        }
        this.refresh();
        if (StorageAdapter._mode === 'remote') {
            Sync.debounceSave();
        }
    },

    getAllTags() { return DB.getAllTags(); },
    exportExperiment(id) { return DB.exportExperiment(id); },
    exportToCSV(id) { return DB.exportToCSV(id); }
};

// ==================== 初始化 ====================
StorageAdapter.init();
// 先从 localStorage 恢复缓存（防止刷新丢失数据）
for (const key of Object.values(DB.KEYS)) {
    try {
        const cached = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(cached) && cached.length > 0) {
            StorageAdapter._cache[key] = cached;
        }
    } catch (e) {}
}
Data.refresh();
// remote 模式下异步拉取服务器数据（不阻塞首屏渲染）
if (StorageAdapter._mode === 'remote') {
    Sync.init();
}
