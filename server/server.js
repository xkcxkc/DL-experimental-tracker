const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DATA_FILE = '/data/state.json';
const EMPTY_STATE = { MODELS: [], EXPERIMENTS: [], HYPERPARAMS: [], TRAINING_LOGS: [], TEST_RESULTS: [], TAGS: [] };
const FIELD_ALIASES = {
    MODELS: ['MODELS', 'models'],
    EXPERIMENTS: ['EXPERIMENTS', 'experiments'],
    HYPERPARAMS: ['HYPERPARAMS', 'hyperparams'],
    TRAINING_LOGS: ['TRAINING_LOGS', 'trainingLogs'],
    TEST_RESULTS: ['TEST_RESULTS', 'testResults'],
    TAGS: ['TAGS', 'tags']
};

app.use(express.json({ limit: '50mb' }));

function normalizeState(state) {
    const normalized = {};
    for (const [targetKey, aliases] of Object.entries(FIELD_ALIASES)) {
        const value = aliases.map(alias => state?.[alias]).find(Array.isArray);
        normalized[targetKey] = value || [];
    }

    const resultExperimentIds = new Set(normalized.TEST_RESULTS.map(item => item.experimentId));
    normalized.EXPERIMENTS = normalized.EXPERIMENTS.map(exp => {
        if (!exp || typeof exp !== 'object') return exp;
        const { testResultDetail, testResults, ...cleanExp } = exp;
        if ((testResultDetail || testResults) && exp.id && !resultExperimentIds.has(exp.id)) {
            normalized.TEST_RESULTS.push({
                id: `${exp.id}-test-result`,
                experimentId: exp.id,
                summary: testResultDetail?.summary || {},
                predictions: testResultDetail?.predictions || [],
                confusionMatrix: testResultDetail?.confusionMatrix || null,
                results: testResults || [],
                updatedAt: exp.updatedAt || exp.createdAt || new Date().toISOString()
            });
            resultExperimentIds.add(exp.id);
        }
        return cleanExp;
    });

    return normalized;
}

// 持久化写入（排队式，不丢数据）
let writeQueue = Promise.resolve();

function writeState(state) {
    const writeOperation = writeQueue.then(() => {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(normalizeState(state), null, 2), 'utf8');
    });
    writeQueue = writeOperation.catch(() => {});
    return writeOperation;
}

// 读取完整状态
function readState() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return normalizeState(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
        }
    } catch (e) {
        console.error('读取状态失败:', e.message);
    }
    return { ...EMPTY_STATE };
}

// 允许的实体集合（与前端 DB.KEYS 对应）
const ALLOWED_ENTITIES = ['MODELS', 'EXPERIMENTS', 'HYPERPARAMS', 'TRAINING_LOGS', 'TEST_RESULTS', 'TAGS'];

// ==================== 全量接口（向后兼容） ====================

app.get('/api/data', (req, res) => {
    try {
        res.json(readState());
    } catch (e) {
        console.error('读取失败:', e.message);
        res.status(500).json({ error: '读取失败' });
    }
});

app.post('/api/data', (req, res) => {
    writeState(req.body).then(() => res.json({ ok: true })).catch(() => res.status(500).json({ error: '保存失败' }));
});

// ==================== 按实体的 CRUD 接口 ====================

// 获取单个实体的全部记录
app.get('/api/data/:entity', (req, res) => {
    const { entity } = req.params;
    if (!ALLOWED_ENTITIES.includes(entity)) {
        return res.status(400).json({ error: '未知实体: ' + entity });
    }
    const state = readState();
    res.json(state[entity] || []);
});

// 向实体追加一条记录
app.post('/api/data/:entity', (req, res) => {
    const { entity } = req.params;
    if (!ALLOWED_ENTITIES.includes(entity)) {
        return res.status(400).json({ error: '未知实体: ' + entity });
    }
    const state = readState();
    if (!Array.isArray(state[entity])) state[entity] = [];
    state[entity].push(req.body);
    writeState(state).then(() => res.json({ ok: true, item: req.body })).catch(() => res.status(500).json({ error: '保存失败' }));
});

// 更新实体中指定 id 的记录
app.put('/api/data/:entity/:id', (req, res) => {
    const { entity, id } = req.params;
    if (!ALLOWED_ENTITIES.includes(entity)) {
        return res.status(400).json({ error: '未知实体: ' + entity });
    }
    const state = readState();
    const arr = state[entity];
    if (!Array.isArray(arr)) return res.status(404).json({ error: '实体不存在' });
    const idx = arr.findIndex(item => item.id === id);
    if (idx === -1) return res.status(404).json({ error: '记录不存在' });
    arr[idx] = { ...arr[idx], ...req.body, id };
    writeState(state).then(() => res.json({ ok: true, item: arr[idx] })).catch(() => res.status(500).json({ error: '保存失败' }));
});

// 删除实体中指定 id 的记录
app.delete('/api/data/:entity/:id', (req, res) => {
    const { entity, id } = req.params;
    if (!ALLOWED_ENTITIES.includes(entity)) {
        return res.status(400).json({ error: '未知实体: ' + entity });
    }
    const state = readState();
    const arr = state[entity];
    if (!Array.isArray(arr)) return res.status(404).json({ error: '实体不存在' });
    const before = arr.length;
    state[entity] = arr.filter(item => item.id !== id);
    if (state[entity].length === before) {
        return res.status(404).json({ error: '记录不存在' });
    }
    writeState(state).then(() => res.json({ ok: true })).catch(() => res.status(500).json({ error: '保存失败' }));
});

// 健康检查
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3000, () => console.log('Server running on :3000'));
