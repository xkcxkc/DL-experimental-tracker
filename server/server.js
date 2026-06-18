const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DATA_FILE = '/data/state.json';
const EMPTY_STATE = { models: [], experiments: [], hyperparams: [], trainingLogs: [], testResults: [] };

app.use(express.json({ limit: '10mb' }));

// 并发写锁
let writeLock = false;

// 读取完整状态
function readState() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('读取状态失败:', e.message);
    }
    return { ...EMPTY_STATE };
}

// 写入完整状态（带并发锁）
function writeState(state, res) {
    if (writeLock) {
        res.status(429).json({ error: '正在保存，请稍后' });
        return false;
    }
    writeLock = true;
    try {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('保存状态失败:', e.message);
        if (res) res.status(500).json({ error: '保存失败' });
        return false;
    } finally {
        writeLock = false;
    }
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
    if (writeState(req.body, res)) {
        res.json({ ok: true });
    }
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
    if (writeState(state, res)) {
        res.json({ ok: true, item: req.body });
    }
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
    if (writeState(state, res)) {
        res.json({ ok: true, item: arr[idx] });
    }
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
    if (writeState(state, res)) {
        res.json({ ok: true });
    }
});

// 健康检查
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3000, () => console.log('Server running on :3000'));