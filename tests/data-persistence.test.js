const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const syncPath = path.join(__dirname, '..', 'frontend', 'sync.js');
const dataPath = path.join(__dirname, '..', 'frontend', 'data.js');

function createDataLayer({ initialServerState, quotaKeys = new Set() } = {}) {
    const store = new Map();
    let serverState = initialServerState || {
        MODELS: [],
        EXPERIMENTS: [],
        HYPERPARAMS: [],
        TRAINING_LOGS: [],
        TEST_RESULTS: [],
        TAGS: []
    };

    const context = {
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        localStorage: {
            getItem(key) {
                return store.has(key) ? store.get(key) : null;
            },
            setItem(key, value) {
                if (quotaKeys.has(key)) {
                    const err = new Error('quota exceeded');
                    err.name = 'QuotaExceededError';
                    throw err;
                }
                store.set(key, value);
            }
        },
        fetch: async (_url, options = {}) => {
            if (options.method === 'POST') {
                serverState = JSON.parse(options.body);
                return { ok: true, status: 200, json: async () => ({ ok: true }) };
            }
            return { ok: true, status: 200, json: async () => serverState };
        }
    };

    const source = [
        fs.readFileSync(syncPath, 'utf8'),
        fs.readFileSync(dataPath, 'utf8'),
        ';({ DB, Data, StorageAdapter, Sync })'
    ].join('\n');
    const api = vm.runInNewContext(source, context);

    return {
        ...api,
        getServerState: () => serverState,
        getLocalItem: key => store.get(key)
    };
}

test('测试结果明细在浏览器缓存写入失败时仍会推送到服务器集合', async () => {
    const { Data, StorageAdapter, getServerState, getLocalItem } = createDataLayer({
        quotaKeys: new Set(['dlt_test_results'])
    });

    const modelId = Data.addModel('ResNet');
    const experimentId = Data.addExperiment(modelId, 'baseline');
    Data.updateExperiment(experimentId, {
        testResultDetail: {
            summary: { testAcc: 66.67 },
            predictions: [
                { filePath: 'a.png', actualLabel: '0', predictLabel: '0', confidence: 0.95 },
                { filePath: 'b.png', actualLabel: '0', predictLabel: '1', confidence: 0.88 }
            ],
            confusionMatrix: { labels: ['0', '1'], matrix: [[1, 1], [0, 0]] }
        },
        testResults: [{ metric: 'Test Accuracy', value: '66.67%', notes: '自动计算' }]
    });

    await StorageAdapter.pushToServer();

    const serverState = getServerState();
    assert.equal(getLocalItem('dlt_test_results'), undefined);
    assert.equal(serverState.TEST_RESULTS.length, 1);
    assert.equal(serverState.TEST_RESULTS[0].experimentId, experimentId);
    assert.equal(serverState.TEST_RESULTS[0].predictions.length, 2);
    assert.equal(serverState.TEST_RESULTS[0].results[0].value, '66.67%');
    assert.equal('testResultDetail' in serverState.EXPERIMENTS[0], false);
    assert.equal('testResults' in serverState.EXPERIMENTS[0], false);
});

test('刷新后可从服务器状态恢复测试结果明细', async () => {
    const { Data, StorageAdapter } = createDataLayer({
        initialServerState: {
            MODELS: [{ id: 'model-1', name: 'ResNet', createdAt: '2026-01-01T00:00:00.000Z' }],
            EXPERIMENTS: [{
                id: 'exp-1',
                modelId: 'model-1',
                name: 'baseline',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z'
            }],
            HYPERPARAMS: [],
            TRAINING_LOGS: [],
            TEST_RESULTS: [{
                id: 'result-1',
                experimentId: 'exp-1',
                summary: { testAcc: 91.2 },
                predictions: [{ filePath: 'a.png', actualLabel: 'cat', predictLabel: 'cat', confidence: 0.99 }],
                confusionMatrix: { labels: ['cat'], matrix: [[1]] },
                results: [{ metric: 'Test Accuracy', value: '91.2%', notes: '自动计算' }],
                updatedAt: '2026-01-01T00:00:01.000Z'
            }],
            TAGS: []
        }
    });

    await StorageAdapter.pullFromServer();

    const experiment = Data.getExperimentById('exp-1');
    assert.equal(experiment.testResultDetail.summary.testAcc, 91.2);
    assert.equal(experiment.testResultDetail.predictions.length, 1);
    assert.equal(experiment.testResults[0].value, '91.2%');
});
