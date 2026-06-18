const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const parserPath = path.join(__dirname, '..', 'frontend', 'parser.js');
const CSVParser = vm.runInNewContext(fs.readFileSync(parserPath, 'utf8') + ';CSVParser', {});

const numericLabelTestCsv = [
    'file_path,actual_label,predict_label,confidence',
    '/data/test/0/a.png,0,0,0.95',
    '/data/test/0/b.png,0,1,0.88',
    '/data/test/1/c.png,1,1,0.91',
    '',
    'Test Summary',
    'Test ACC,66.67%',
    'Test Loss,0.1234',
    '',
    'Confusion Matrix',
    'actual/predict,0,1',
    '0,1,1',
    '1,0,1'
].join('\n');

const classLabelTestCsv = numericLabelTestCsv
    .replaceAll(',0,0,', ',Class_0,Class_0,')
    .replaceAll(',0,1,', ',Class_0,Class_1,')
    .replaceAll(',1,1,', ',Class_1,Class_1,')
    .replaceAll('actual/predict,0,1', 'actual/predict,Class_0,Class_1')
    .replaceAll('\n0,1,1', '\nClass_0,1,1')
    .replaceAll('\n1,0,1', '\nClass_1,0,1');

test('数字类别的测试结果 CSV 不应被误判为训练日志', () => {
    const testResult = CSVParser.parseTestResult(numericLabelTestCsv);
    assert.equal(testResult.success, true);
    assert.equal(testResult.predictions.length, 3);
    assert.deepEqual([...testResult.confusionMatrix.labels], ['0', '1']);

    const trainingLog = CSVParser.parseTrainingLog(numericLabelTestCsv);
    assert.equal(trainingLog.success, false);
});

test('文本类别的测试结果 CSV 同样不应被误判为训练日志', () => {
    const testResult = CSVParser.parseTestResult(classLabelTestCsv);
    assert.equal(testResult.success, true);
    assert.equal(testResult.predictions.length, 3);
    assert.deepEqual([...testResult.confusionMatrix.labels], ['Class_0', 'Class_1']);

    const trainingLog = CSVParser.parseTrainingLog(classLabelTestCsv);
    assert.equal(trainingLog.success, false);
});

test('只有预测明细时可自动生成混淆矩阵', () => {
    const predictionOnlyCsv = [
        'file_path,actual_label,predict_label,confidence',
        '/data/test/0/a.png,0,0,0.95',
        '/data/test/0/b.png,0,1,0.88',
        '/data/test/1/c.png,1,1,0.91'
    ].join('\n');

    const testResult = CSVParser.parseTestResult(predictionOnlyCsv);
    assert.equal(testResult.success, true);
    assert.deepEqual([...testResult.confusionMatrix.labels], ['0', '1']);
    assert.deepEqual([...testResult.confusionMatrix.matrix].map(row => [...row]), [[1, 1], [0, 1]]);
});

test('普通训练日志仍可正常解析', () => {
    const trainingCsv = [
        'epoch,train_loss,train_acc,val_loss,val_acc,learning_rate',
        '1,0.9,60.1,0.8,62.3,0.001',
        '2,0.5,78.4,0.4,80.2,0.001'
    ].join('\n');

    const trainingLog = CSVParser.parseTrainingLog(trainingCsv);
    assert.equal(trainingLog.success, true);
    assert.equal(trainingLog.totalEpochs, 2);
    assert.equal(trainingLog.bestValAcc, 80.2);

    const testResult = CSVParser.parseTestResult(trainingCsv);
    assert.equal(testResult.success, false);
});
