const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DATA_FILE = '/data/state.json';
const EMPTY_STATE = { models: [], experiments: [], hyperparams: [], trainingLogs: [], testResults: [] };

app.use(express.json({ limit: '10mb' }));

// 并发写锁
let writeLock = false;

app.get('/api/data', (req, res) => {
    try {
        const data = fs.existsSync(DATA_FILE)
            ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
            : EMPTY_STATE;
        res.json(data);
    } catch (e) {
        console.error('读取失败:', e.message);
        res.status(500).json({ error: '读取失败' });
    }
});

app.post('/api/data', (req, res) => {
    if (writeLock) return res.status(429).json({ error: '正在保存，请稍后' });
    writeLock = true;
    try {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), 'utf8');
        res.json({ ok: true });
    } catch (e) {
        console.error('保存失败:', e.message);
        res.status(500).json({ error: '保存失败' });
    } finally {
        writeLock = false;
    }
});

// 健康检查
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3000, () => console.log('Server running on :3000'));
