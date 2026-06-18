// ==================== 应用逻辑层 ====================
class ExperimentTracker {
    constructor() {
        this.currentView = 'home';
        this.batchMode = false;
        this.selectedExperiments = new Set();
        this.currentModelId = null;
        this.currentExperimentId = null;
        this.filters = { tags: [], sortField: 'date', sortOrder: 'desc' };
    }

    init() {
        this.elements = {
            mainContent: document.getElementById('main-content'),
            breadcrumb: document.getElementById('breadcrumb'),
            headerRight: document.getElementById('header-right'),
            modalContainer: document.getElementById('modal-container'),
            toastContainer: document.getElementById('toast-container')
        };

        // 主题切换
        const saved = localStorage.getItem('dlt_theme') || 'light';
        document.documentElement.setAttribute('data-theme', saved);

        // 全局键盘
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                if (this.currentView !== 'home') this.navigate('home');
            }
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.toggleTheme();
            }
        });

        this.navigate('home');
    }

    // ==================== 主题 ====================
    toggleTheme() {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('dlt_theme', next);
    }

    // ==================== 路由 ====================
    navigate(view) {
        this.batchMode = false;
        this.selectedExperiments.clear();

        if (view === 'home') {
            this.currentView = 'home';
            this.currentModelId = null;
            this.currentExperimentId = null;
            this.renderHome();
        } else if (view.startsWith('model:')) {
            const modelId = view.split(':')[1];
            this.currentView = view;
            this.currentModelId = modelId;
            this.currentExperimentId = null;
            this.renderModel(modelId);
        } else if (view.startsWith('experiment:')) {
            const expId = view.split(':')[1];
            this.currentView = view;
            this.currentExperimentId = expId;
            const exp = Data.getExperimentById(expId);
            if (exp) this.currentModelId = exp.modelId;
            this.renderExperiment(expId);
        }
        this.updateBreadcrumb();
        window.scrollTo(0, 0);
    }

    updateBreadcrumb() {
        const bc = this.elements.breadcrumb;
        if (this.currentView === 'home') {
            bc.innerHTML = '';
            return;
        }
        let html = '<a onclick="app.navigate(\'home\')">首页</a>';
        if (this.currentModelId) {
            const model = Data.getModelById(this.currentModelId);
            html += `<span class="separator">/</span>`;
            if (this.currentView.startsWith('experiment:')) {
                html += `<a onclick="app.navigate('model:${this.currentModelId}')">${model?.name || '模型'}</a>`;
            } else {
                html += `<span class="current">${model?.name || '模型'}</span>`;
            }
        }
        if (this.currentExperimentId) {
            const exp = Data.getExperimentById(this.currentExperimentId);
            html += `<span class="separator">/</span><span class="current">${exp?.name || '实验'}</span>`;
        }
        bc.innerHTML = html;
    }

    // ==================== 首页 ====================
    renderHome() {
        const models = Data.models;
        const experiments = Data.experiments;
        const modelCount = Object.keys(models).length;
        const expCount = Object.keys(experiments).length;
        const allTags = Data.getAllTags();

        let bestAcc = '--';
        const allExps = Object.values(experiments);
        const accs = allExps
            .filter(e => e.testResults && e.testResults.length > 0)
            .map(e => { const n = parseFloat(e.testResults[0].value); return isNaN(n) ? null : n; })
            .filter(n => n !== null);
        if (accs.length > 0) bestAcc = Math.max(...accs).toFixed(1) + '%';

        this.elements.headerRight.innerHTML = `
            <button class="header-btn" onclick="app.showAddModelModal()">＋ 创建新项目</button>
            <button class="header-btn" onclick="app.addDemoData()">📝 示例数据</button>
            <button class="header-btn" onclick="app.showSettingsModal()">⚙️ 设置</button>
            <button class="header-btn" onclick="app.toggleTheme()">🌓</button>
        `;

        this.elements.mainContent.innerHTML = `
            <div class="stats-bar">
                <div class="stat-card"><div class="stat-icon models">📦</div><div class="stat-info"><div class="stat-value">${modelCount}</div><div class="stat-label">模型项目</div></div></div>
                <div class="stat-card"><div class="stat-icon experiments">🧪</div><div class="stat-info"><div class="stat-value">${expCount}</div><div class="stat-label">实验总数</div></div></div>
                <div class="stat-card"><div class="stat-icon best-acc">🎯</div><div class="stat-info"><div class="stat-value">${bestAcc}</div><div class="stat-label">最佳精度</div></div></div>
                <div class="stat-card"><div class="stat-icon tags">🏷️</div><div class="stat-info"><div class="stat-value">${allTags.length}</div><div class="stat-label">标签数</div></div></div>
            </div>
            <div id="models-container" class="cards-grid"></div>
        `;

        const container = document.getElementById('models-container');
        if (modelCount === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔬</div>
                    <h3>暂无模型项目</h3>
                    <p>点击"＋ 创建新项目"开始记录你的第一个实验</p>
                    <div style="margin-top: 20px;">
                        <button onclick="app.addDemoData()" class="btn btn-outline" style="font-size: 1.1rem; padding: 12px 28px;">📝 加载示例数据</button>
                    </div>
                </div>
            `;
        } else {
            let html = '';
            for (const id of Object.keys(models)) {
                const model = models[id];
                const exps = Object.values(experiments).filter(e => e.modelId === id);
                const hasExps = exps.length > 0;

                let best = '--';
                if (hasExps) {
                    const a = exps.filter(e => e.testResults && e.testResults.length > 0)
                        .map(e => { const n = parseFloat(e.testResults[0].value); return isNaN(n) ? null : n; })
                        .filter(n => n !== null);
                    if (a.length > 0) best = Math.max(...a).toFixed(1) + '%';
                }

                let latestDate = 'N/A';
                if (hasExps) {
                    const dates = exps.map(e => e.updatedAt || e.createdAt).sort();
                    latestDate = new Date(dates[dates.length - 1]).toLocaleDateString();
                }

                html += `
                    <div class="model-card" onclick="app.navigate('model:${id}')">
                        <div class="model-card-header">
                            <div style="flex:1; min-width:0;"><h3 class="model-name" ondblclick="event.stopPropagation(); app.inlineRenameModel('${id}', this)">${model.name}</h3></div>
                            <div class="model-card-actions">
                                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); app.deleteModel('${id}')" title="删除">🗑️</button>
                            </div>
                        </div>
                        <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 12px;">${model.description || '暂无描述'}</p>
                        <div class="model-stats">
                            <span class="model-stat"><span class="count">${exps.length}</span> 实验</span>
                            <span class="model-stat">最佳 <span class="count">${best}</span></span>
                            <span class="model-stat">${latestDate}</span>
                        </div>
                    </div>
                `;
            }
            container.innerHTML = html;
        }
    }

    // ==================== 模型详情页 ====================
    renderModel(modelId) {
        const model = Data.getModelById(modelId);
        if (!model) { this.navigate('home'); return; }

        this.elements.headerRight.innerHTML = `
            <button class="header-btn" onclick="app.navigate('home')">← 返回</button>
            <button class="header-btn" onclick="app.showAddExperimentModal()">＋ 添加实验</button>
            <button class="header-btn" onclick="document.getElementById('import-csv-input').click()">📥 导入 CSV</button>
            <button class="header-btn" onclick="app.toggleBatchMode()">${this.batchMode ? '❌ 退出管理' : '🔧 管理'}</button>
            <button class="header-btn btn-danger" onclick="app.deleteModel('${modelId}')">🗑️ 删除项目</button>
            <input type="file" id="import-csv-input" accept=".csv" onchange="app.importCSV(event, '${modelId}')" style="display:none">
        `;

        const allExps = Object.values(Data.experiments).filter(e => e.modelId === modelId);
        const allTags = [...new Set(allExps.flatMap(e => e.tags || []))];

        // 过滤和排序
        let filtered = allExps;
        if (this.filters.tags.length > 0) {
            filtered = filtered.filter(e => (e.tags || []).some(t => this.filters.tags.includes(t)));
        }
        const field = this.filters.sortField || 'date';
        const order = this.filters.sortOrder || 'desc';
        filtered.sort((a, b) => {
            let va, vb;
            if (field === 'date') {
                va = new Date(a.updatedAt || a.createdAt);
                vb = new Date(b.updatedAt || b.createdAt);
            } else if (field === 'name') {
                va = a.name; vb = b.name;
                return order === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            } else if (field === 'val_acc') {
                va = this._getAccFromLog(a); vb = this._getAccFromLog(b);
            } else if (field === 'test_acc') {
                va = this._getAccFromTest(a); vb = this._getAccFromTest(b);
            }
            if (va == null) va = -Infinity;
            if (vb == null) vb = -Infinity;
            return order === 'asc' ? va - vb : vb - va;
        });

        this.elements.mainContent.innerHTML = `
            <div class="page-header">
                <div><h2 ondblclick="app.inlineRenameModel('${modelId}', this)" style="cursor:text;">${model.name}</h2><p class="subtitle">${model.description || ''}</p></div>
                <span style="color: var(--text-muted); font-size: 14px;">${filtered.length} / ${allExps.length} 个实验</span>
            </div>
            <div id="filter-controls" class="toolbar" style="display:${allTags.length > 0 || allExps.length > 1 ? 'flex' : 'none'}">
                <div id="filter-buttons" class="toolbar-left"></div>
                <div id="sort-controls" class="toolbar-right"></div>
            </div>
            <div id="experiments-list" class="cards-grid"></div>
            <div id="batch-bar" class="batch-bar" style="display:none"></div>
        `;

        // 渲染过滤器
        if (allTags.length > 0 || allExps.length > 1) {
            document.getElementById('filter-buttons').innerHTML = allTags.slice(0, 15).map(tag => {
                const active = this.filters.tags.includes(tag) ? ' active' : '';
                return `<button class="tag${active}" onclick="app.toggleFilterTag('${tag}')">${tag}</button>`;
            }).join('');

            const sf = this.filters.sortField || 'date';
            const so = this.filters.sortOrder || 'desc';
            document.getElementById('sort-controls').innerHTML = `
                <button class="tag${sf === 'date' ? ' active' : ''}" onclick="app.setSortField('date')">📅 时间</button>
                <button class="tag${sf === 'val_acc' ? ' active' : ''}" onclick="app.setSortField('val_acc')">📈 验证精度</button>
                <button class="tag${sf === 'test_acc' ? ' active' : ''}" onclick="app.setSortField('test_acc')">🎯 测试精度</button>
                <button class="tag${sf === 'name' ? ' active' : ''}" onclick="app.setSortField('name')">🔤 名称</button>
                <button class="tag" onclick="app.toggleSortOrder()">${so === 'desc' ? '↓ 降序' : '↑ 升序'}</button>
            `;
        }

        // 渲染实验列表
        const container = document.getElementById('experiments-list');
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🧪</div>
                    <h3>暂无实验</h3>
                    <p>点击"添加实验"开始记录</p>
                </div>
            `;
        } else {
            container.innerHTML = filtered.map(exp => {
                const isSelected = this.selectedExperiments.has(exp.id);
                const tagsHtml = (exp.tags || []).map(t => `<span class="tag">${t}</span>`).join('');

                // 1.5 固定指标：Val Best Acc / Test Acc
                const log = Data.getTrainingLog(exp.id);
                const valBestAcc = log?.bestValAcc != null ? log.bestValAcc.toFixed(2) + '%' : '--';
                let testAccVal = '--';
                if (exp.testResults && exp.testResults.length > 0) {
                    const t = exp.testResults.find(r => /acc|accuracy/i.test(r.metric));
                    if (t) testAccVal = t.value;
                    else testAccVal = exp.testResults[0].value;
                }

                // 1.4 cardDisplayKeys 超参
                const displayKeys = exp.cardDisplayKeys || [];
                let hyperHtml = '';
                if (displayKeys.length > 0) {
                    hyperHtml = (exp.hyperParams || [])
                        .filter(p => displayKeys.includes(p.key))
                        .map(p => `<span class="param-pill">${p.key}=${p.value}</span>`)
                        .join('');
                } else {
                    hyperHtml = (exp.hyperParams || []).slice(0, 8).map(p =>
                        `<span class="param-pill">${p.key}=${p.value}</span>`
                    ).join('');
                }

                let dateStr = exp.date || '';
                if (!dateStr) {
                    const d = new Date(exp.updatedAt || exp.createdAt);
                    dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
                }

                const cardClick = this.batchMode
                    ? `app.toggleSelectExperiment('${exp.id}')`
                    : `app.navigate('experiment:${exp.id}')`;

                return `
                    <div class="experiment-card${isSelected ? ' batch-selected' : ''}" onclick="${cardClick}">
                        <div class="checkbox-wrapper" style="${this.batchMode ? 'display:block' : 'display:none'}">
                            <input type="checkbox" class="checkbox" ${isSelected ? 'checked' : ''}>
                        </div>
                        <div class="exp-header">
                            <span class="exp-name">${exp.name}</span>
                            <span class="exp-date">${dateStr}</span>
                        </div>
                        <div class="tags">${tagsHtml}</div>
                        <div class="metrics" style="margin-bottom:8px;">
                            <span class="metric"><span class="metric-label">VAL BEST</span><span class="metric-value">${valBestAcc}</span></span>
                            <span class="metric"><span class="metric-label">TEST ACC</span><span class="metric-value">${testAccVal}</span></span>
                        </div>
                        <div class="hyper-params">${hyperHtml}</div>
                    </div>
                `;
            }).join('');
        }

        // 批量操作栏
        this.updateBatchBar();
    }

    _getAccFromLog(exp) {
        const log = Data.getTrainingLog(exp.id);
        return log?.bestValAcc ?? null;
    }

    _getAccFromTest(exp) {
        if (!exp.testResults || exp.testResults.length === 0) return null;
        const v = parseFloat(exp.testResults[0].value);
        return isNaN(v) ? null : v;
    }

    updateBatchBar() {
        const bar = document.getElementById('batch-bar');
        if (!bar) return;
        if (!this.batchMode || this.selectedExperiments.size === 0) {
            bar.style.display = 'none';
            return;
        }
        bar.style.display = 'flex';
        bar.innerHTML = `
            <span>已选 ${this.selectedExperiments.size} 个</span>
            <div style="display:flex; gap:8px;">
                <button class="btn btn-sm btn-primary" onclick="app.batchApplyTag()">🏷️ 批量打标签</button>
                <button class="btn btn-sm btn-primary" onclick="app.exportSelected()">📦 批量导出</button>
                <button class="btn btn-sm btn-outline" onclick="app.selectAllExperiments()">☑️ 全选</button>
                <button class="btn btn-sm btn-outline" onclick="app.deselectAllExperiments()">❎ 取消</button>
                <button class="btn btn-sm btn-danger" onclick="app.batchDelete()">🗑️ 批量删除</button>
            </div>
        `;
    }

    // ==================== 实验详情页 ====================
    renderExperiment(experimentId) {
        const exp = Data.getExperimentById(experimentId);
        if (!exp) { this.navigate('home'); return; }

        // 注入训练日志（存储在独立表中）
        exp.trainingLog = Data.getTrainingLog(experimentId) || null;

        this.elements.headerRight.innerHTML = `
            <button class="header-btn" onclick="app.navigate('model:${exp.modelId}')">← 返回</button>
            <button class="header-btn btn-danger" onclick="app.deleteExperiment('${experimentId}')">🗑️ 删除</button>
        `;

        this.elements.mainContent.innerHTML = `
            <div class="page-header">
                <h2 id="experiment-title" contenteditable="true" style="outline:none; border-bottom:2px solid transparent; cursor:text;" onfocus="this.style.borderBottomColor='var(--primary)'" onblur="this.style.borderBottomColor='transparent'; app.updateExpName('${experimentId}', this.innerText)">${exp.name}</h2>
            </div>
            <div class="tabs">
                <div class="tab active" onclick="app.switchTab('overview')">📋 概览</div>
                <div class="tab" onclick="app.switchTab('log')">📊 训练日志</div>
                <div class="tab" onclick="app.switchTab('test')">🎯 测试结果</div>
            </div>
            <div id="tab-overview" class="tab-content"></div>
            <div id="tab-log" class="tab-content" style="display:none"></div>
            <div id="tab-test" class="tab-content" style="display:none"></div>
        `;

        this._renderOverviewTab(experimentId, exp);
        this._renderLogTab(experimentId, exp);
        this._renderTestTab(experimentId, exp);
    }

    _renderOverviewTab(experimentId, exp) {
        // 1.1 摘要指标
        const log = exp.trainingLog;
        const bestValAcc = log?.bestValAcc != null ? log.bestValAcc.toFixed(2) + '%' : '--';
        const bestEpoch = log?.bestEpoch != null ? log.bestEpoch : '--';
        const totalEpochs = log?.totalEpochs != null ? log.totalEpochs : '--';
        let testAcc = '--';
        if (exp.testResults && exp.testResults.length > 0) {
            const first = exp.testResults.find(r => /acc|accuracy/i.test(r.metric));
            if (first) testAcc = first.value;
        }

        // 1.2 可编辑日期
        const dateVal = exp.date || new Date().toISOString().split('T')[0];

        // 1.4 cardDisplayKeys
        const displayKeys = new Set(exp.cardDisplayKeys || []);

        const hyperHtml = (exp.hyperParams || []).map(p => {
            const checked = displayKeys.has(p.key) ? 'checked' : '';
            return `
            <div class="param-item" style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <input type="checkbox" class="checkbox" ${checked} onchange="app.toggleCardDisplayKey('${experimentId}', '${p.key}', this.checked)" title="显示在卡片上">
                <span class="param-key" contenteditable="true" onblur="app.updateParamKey('${experimentId}', '${p.key}', this.innerText)" style="min-width:120px; font-weight:600;">${p.key}</span>
                <input class="form-input" value="${p.value}" onchange="app.updateParamValue('${experimentId}', '${p.key}', this.value)" style="flex:1;">
                <button class="btn btn-sm btn-danger" onclick="app.deleteParam('${experimentId}', '${p.key}')">✕</button>
            </div>`;
        }).join('');

        const testHtml = (exp.testResults || []).map((r, i) => `
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                <input class="form-input" value="${r.metric}" onchange="app.editTestResult('${experimentId}', ${i}, 'metric', this.value)" style="flex:1;" placeholder="指标名">
                <input class="form-input" value="${r.value}" onchange="app.editTestResult('${experimentId}', ${i}, 'val', this.value)" style="flex:1;" placeholder="值">
                <input class="form-input" value="${r.notes || ''}" onchange="app.editTestResult('${experimentId}', ${i}, 'notes', this.value)" style="flex:1;" placeholder="备注">
                <button class="btn btn-sm btn-danger" onclick="app.deleteTestResult('${experimentId}', ${i})">✕</button>
            </div>
        `).join('');

        document.getElementById('tab-overview').innerHTML = `
            <div class="metrics-grid" style="margin-bottom:20px;">
                <div class="metric-card"><div class="metric-icon">🎯</div><div class="metric-title">Val Best Acc</div><div class="metric-number">${bestValAcc}</div></div>
                <div class="metric-card"><div class="metric-icon">📊</div><div class="metric-title">Best Epoch</div><div class="metric-number">${bestEpoch}</div></div>
                <div class="metric-card"><div class="metric-icon">✅</div><div class="metric-title">Test Acc</div><div class="metric-number">${testAcc}</div></div>
                <div class="metric-card"><div class="metric-icon">🔄</div><div class="metric-title">Total Epochs</div><div class="metric-number">${totalEpochs}</div></div>
            </div>
            <div class="info-card" style="margin-bottom:16px;">
                <h4>📝 基本信息</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:12px; color:var(--text-muted); margin-bottom:4px; display:block;">实验名称</label>
                        <input class="form-input" value="${exp.name}" onchange="app.updateExpName('${experimentId}', this.value)">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:12px; color:var(--text-muted); margin-bottom:4px; display:block;">实验日期</label>
                        <input type="date" class="form-input" value="${dateVal}" onchange="app.updateExpDate('${experimentId}', this.value)">
                    </div>
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:12px; color:var(--text-muted); margin-bottom:4px; display:block;">备注</label>
                    <textarea id="exp-description" class="form-input" rows="2" onchange="app.updateExpDesc('${experimentId}')">${exp.description || ''}</textarea>
                </div>
            </div>
            <div class="info-card" style="margin-bottom:16px;">
                <h4 style="display:flex; justify-content:space-between; align-items:center;">
                    ⚙️ 超参数 <span style="font-size:12px; color:var(--text-muted); font-weight:400;">勾选展示在卡片</span>
                    <button class="btn btn-sm btn-outline" onclick="app.addParam('${experimentId}')">＋ 添加</button>
                </h4>
                <div id="hyperparams-list">${hyperHtml || '<p style="color: var(--text-muted);">暂无超参数</p>'}</div>
            </div>
            <div class="info-card" style="margin-bottom:16px;">
                <h4 style="display:flex; justify-content:space-between; align-items:center;">
                    🎯 测试结果
                    <div>
                        <button class="btn btn-sm btn-outline" onclick="app.addTestResult('${experimentId}')">＋ 添加</button>
                        <button class="btn btn-sm btn-outline" onclick="app.reUploadTest('${experimentId}')">🔄 重传</button>
                    </div>
                </h4>
                <div id="test-results-list">${testHtml || '<p style="color: var(--text-muted);">暂无测试结果</p>'}</div>
            </div>
            <div class="info-card">
                <h4 style="display:flex; justify-content:space-between; align-items:center;">
                    📎 配置文件
                    <button class="btn btn-sm btn-outline" onclick="app.uploadConfig('${experimentId}')">📄 上传</button>
                </h4>
                ${exp.config ? `<pre style="background: var(--gray-50); padding: 12px; border-radius: 8px; font-size: 13px; overflow: auto; max-height: 300px;">${exp.config}</pre>` : '<p style="color: var(--text-muted);">点击"上传配置"导入训练脚本或配置文件</p>'}
            </div>
        `;
    }

    _renderLogTab(experimentId, exp) {
        const log = exp.trainingLog;
        const hasLog = !!log && log.rows && log.rows.length > 0;

        // 超参数展示（从 CSV 提取的）
        const hyperFromLog = log?.hyperParams || {};
        const hyperKeys = Object.keys(hyperFromLog);
        let hyperHtml = '';
        if (hyperKeys.length > 0) {
            hyperHtml = `<div class="info-card" style="margin-bottom:16px;">
                <h4>⚙️ 从 CSV 提取的超参数</h4>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                    ${hyperKeys.map(k => `<span class="param-pill">${k}=${hyperFromLog[k]}</span>`).join('')}
                </div>
            </div>`;
        }

        // 摘要指标
        let summaryHtml = '';
        if (hasLog) {
            const bestAcc = log.bestValAcc != null ? log.bestValAcc.toFixed(2) + '%' : '--';
            const bestEp = log.bestEpoch != null ? log.bestEpoch : '--';
            const total = log.totalEpochs != null ? log.totalEpochs : '--';
            summaryHtml = `
                <div class="metrics-grid" style="margin-bottom:16px;">
                    <div class="metric-card"><div class="metric-icon">🎯</div><div class="metric-title">Val Best Acc</div><div class="metric-number">${bestAcc}</div></div>
                    <div class="metric-card"><div class="metric-icon">📊</div><div class="metric-title">Best Epoch</div><div class="metric-number">${bestEp}</div></div>
                    <div class="metric-card"><div class="metric-icon">🔄</div><div class="metric-title">Total Epochs</div><div class="metric-number">${total}</div></div>
                </div>`;
        }

        // 图表
        let chartsHtml = '';
        if (hasLog) {
            chartsHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div class="chart-container"><h4>📉 损失曲线</h4><div style="height:300px;"><canvas id="chart-loss"></canvas></div></div>
                    <div class="chart-container"><h4>📈 精度曲线</h4><div style="height:300px;"><canvas id="chart-acc"></canvas></div></div>
                </div>`;
        }

        // 完整数据表格
        let tableHtml = '';
        if (hasLog) {
            const cols = log.columns || [];
            const rows = log.rows || [];
            const headHtml = cols.map(c => `<th>${c}</th>`).join('');
            const bodyHtml = rows.map(row =>
                '<tr>' + row.map(v => `<td>${v}</td>`).join('') + '</tr>'
            ).join('');
            tableHtml = `
                <div class="table-container" style="max-height: 500px; overflow: auto;">
                    <table class="data-table">
                        <thead><tr>${headHtml}</tr></thead>
                        <tbody>${bodyHtml}</tbody>
                    </table>
                </div>
                <p style="color: var(--text-muted); font-size: 13px; margin-top: 8px;">共 ${rows.length} 条记录</p>
            `;
        }

        document.getElementById('tab-log').innerHTML = `
            ${summaryHtml}
            ${hyperHtml}
            ${chartsHtml}
            ${tableHtml || '<div class="empty-state"><div class="empty-icon">📄</div><h3>暂无训练日志</h3><p>上传 CSV 文件导入训练日志</p></div>'}
            <input type="file" id="log-csv-file" accept=".csv" onchange="app.handleLogUpload(event, '${experimentId}')" style="display:none">
            <div style="display:flex; gap:8px; margin-top:16px; align-items:center;">
                <div class="upload-area" style="flex:1; margin:0;" onclick="document.getElementById('log-csv-file').click()">
                    <div class="upload-icon">📄</div>
                    <div class="upload-text">${hasLog ? '上传新 CSV（支持追加/覆盖）' : '拖拽训练日志 CSV 到此处'}</div>
                    <div class="upload-hint">或点击选择文件</div>
                </div>
                ${hasLog ? `<button class="btn btn-danger" onclick="app.deleteTrainingLog('${experimentId}')" style="white-space:nowrap;">🗑️ 删除训练日志</button>` : ''}
            </div>
        `;

        // 渲染图表
        if (hasLog) {
            requestAnimationFrame(() => this._renderLogCharts(log));
        }
    }

    _renderLogCharts(log) {
        const columns = log.columns || [];
        const rows = log.rows || [];
        const xs = rows.map((_, i) => i + 1);
        const colors = ['#6c5ce7', '#00b894', '#e17055', '#fdcb6e', '#0984e3', '#e84393'];
        const commonOpts = {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: { x: { title: { display: true, text: 'Epoch' } } }
        };

        // Loss chart — 仅展示 train_loss 和 val_loss
        const lossCtx = document.getElementById('chart-loss');
        if (lossCtx) {
            const lossWhitelist = ['train_loss', 'val_loss'];
            const datasets = [];
            columns.forEach((col, i) => {
                if (i === 0) return;
                if (lossWhitelist.includes(col.toLowerCase())) {
                    datasets.push({
                        label: col, data: rows.map(r => parseFloat(r[i])),
                        borderColor: colors[datasets.length % colors.length],
                        borderWidth: 2, fill: false, tension: 0.3, pointRadius: 1
                    });
                }
            });
            if (datasets.length > 0) {
                new Chart(lossCtx, {
                    type: 'line', data: { labels: xs, datasets },
                    options: { ...commonOpts, scales: { ...commonOpts.scales, y: { title: { display: true, text: 'Loss' }, beginAtZero: false } } }
                });
            }
        }

        // Acc chart
        const accCtx = document.getElementById('chart-acc');
        if (accCtx) {
            const datasets = [];
            columns.forEach((col, i) => {
                if (i === 0) return;
                const lk = col.toLowerCase();
                if (lk.includes('acc') || lk.includes('accuracy') || lk.includes('f1') || lk.includes('mae')) {
                    datasets.push({
                        label: col, data: rows.map(r => parseFloat(r[i])),
                        borderColor: colors[datasets.length % colors.length],
                        borderWidth: 2, fill: false, tension: 0.3, pointRadius: 1
                    });
                }
            });
            if (datasets.length > 0) {
                new Chart(accCtx, {
                    type: 'line', data: { labels: xs, datasets },
                    options: { ...commonOpts, scales: { ...commonOpts.scales, y: { title: { display: true, text: 'Value' }, beginAtZero: false } } }
                });
            }
        }
    }

    _calcBinaryMetrics(cm) {
        if (!cm || !cm.labels || !cm.matrix || cm.labels.length !== 2) return null;
        const m = cm.matrix;
        const TP = m[1][1], FN = m[1][0], FP = m[0][1];
        const precision = (TP + FP) > 0 ? TP / (TP + FP) : null;
        const recall = (TP + FN) > 0 ? TP / (TP + FN) : null;
        const f1 = (precision !== null && recall !== null && (precision + recall) > 0)
            ? 2 * precision * recall / (precision + recall) : null;
        return { precision, recall, f1 };
    }

    _renderTestTab(experimentId, exp) {
        const detail = exp.testResultDetail || null;
        const testResults = exp.testResults || [];
        const hasDetail = detail && (detail.predictions || detail.summary || detail.confusionMatrix);

        let html = '';

        if (hasDetail) {
            // 汇总指标卡片
            const s = detail.summary || {};
            const metrics = [
                { icon: '🎯', label: 'Test ACC', value: s.testAcc != null ? s.testAcc + '%' : '--' },
                { icon: '📊', label: 'mAP', value: s.mAP != null ? s.mAP : '--' },
                { icon: '⚡', label: 'Avg Inference', value: s.avgInferenceTime != null ? s.avgInferenceTime : '--' },
                { icon: '📉', label: 'Test Loss', value: s.testLoss != null ? s.testLoss : '--' }
            ];
            // 二分类指标（PR/RC/F1）
            const binary = this._calcBinaryMetrics(detail.confusionMatrix);
            if (binary) {
                const fmt = v => v != null ? (v * 100).toFixed(2) + '%' : '--';
                metrics.push({ icon: '📊', label: 'Precision', value: fmt(binary.precision) });
                metrics.push({ icon: '📈', label: 'Recall', value: fmt(binary.recall) });
                metrics.push({ icon: '🏆', label: 'F1 Score', value: fmt(binary.f1) });
            }
            html += `<div class="metrics-grid" style="margin-bottom:20px;">
                ${metrics.map(m => `<div class="metric-card"><div class="metric-icon">${m.icon}</div><div class="metric-title">${m.label}</div><div class="metric-number">${m.value}</div></div>`).join('')}
            </div>`;

            // 混淆矩阵
            if (detail.confusionMatrix && detail.confusionMatrix.matrix) {
                const cm = detail.confusionMatrix;
                const labels = cm.labels || [];
                const matrix = cm.matrix || [];
                html += `<div class="info-card" style="margin-bottom:16px;">
                    <h4>🔢 混淆矩阵</h4>
                    <div class="confusion-matrix" style="overflow:auto;">
                        <table class="data-table" style="text-align:center;">
                            <thead><tr><th style="font-weight:700;">实际\\预测</th>${labels.map(l => `<th>${l}</th>`).join('')}</tr></thead>
                            <tbody>${matrix.map((row, i) => {
                                const maxInRow = Math.max(...row);
                                return `<tr><td style="font-weight:700;">${labels[i]}</td>${row.map((v, j) => {
                                    const isDiag = i === j;
                                    const isMisclass = !isDiag && v > 0;
                                    const cls = isDiag ? 'diagonal' : (isMisclass ? 'misclassify' : '');
                                    return `<td class="${cls}" style="${isDiag ? 'background:rgba(0,184,148,0.15); font-weight:700;' : (isMisclass ? 'background:rgba(225,112,85,0.15); color:#e17055;' : '')}">${v}</td>`;
                                }).join('')}</tr>`;
                            }).join('')}</tbody>
                        </table>
                    </div>
                </div>`;
            }

            // 错误样本
            if (detail.predictions && detail.predictions.length > 0) {
                const errors = detail.predictions.filter(p => p.actualLabel !== p.predictLabel);
                if (errors.length > 0) {
                    errors.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
                    html += `<div class="info-card" style="margin-bottom:16px;">
                        <h4>❌ 错误样本 (${errors.length})</h4>
                        <div class="error-samples" style="max-height:400px; overflow:auto;">
                            <table class="data-table">
                                <thead><tr><th>文件路径</th><th>实际标签</th><th>预测标签</th><th>置信度</th></tr></thead>
                                <tbody>${errors.map(p => `<tr>
                                    <td style="font-size:12px; word-break:break-all;">${p.filePath || ''}</td>
                                    <td>${p.actualLabel}</td>
                                    <td style="color:var(--danger);">${p.predictLabel}</td>
                                    <td>${p.confidence != null ? (p.confidence * 100).toFixed(1) + '%' : '--'}</td>
                                </tr>`).join('')}</tbody>
                            </table>
                        </div>
                    </div>`;
                }

                // 全部预测（可折叠）
                html += `<details style="margin-bottom:16px;">
                    <summary style="cursor:pointer; font-weight:600; padding:8px 0;">📋 全部预测结果 (${detail.predictions.length})</summary>
                    <div class="table-container" style="max-height:400px; overflow:auto;">
                        <table class="data-table">
                            <thead><tr><th>文件路径</th><th>实际标签</th><th>预测标签</th><th>置信度</th></tr></thead>
                            <tbody>${detail.predictions.map(p => `<tr>
                                <td style="font-size:12px; word-break:break-all;">${p.filePath || ''}</td>
                                <td>${p.actualLabel}</td>
                                <td>${p.predictLabel}</td>
                                <td>${p.confidence != null ? (p.confidence * 100).toFixed(1) + '%' : '--'}</td>
                            </tr>`).join('')}</tbody>
                        </table>
                    </div>
                </details>`;
            }

            // 删除按钮
            html += `<div style="margin-top:8px;">
                <button class="btn btn-sm btn-danger" onclick="app.deleteTestResultDetail('${experimentId}')">🗑️ 删除测试结果</button>
            </div>`;
        }

        // 兼容旧的 testResults（手动添加的指标）
        if (!hasDetail && testResults.length > 0) {
            html = `
                <div class="table-container">
                    <table class="data-table">
                        <thead><tr><th>指标</th><th>值</th><th>备注</th><th>操作</th></tr></thead>
                        <tbody>
                            ${testResults.map((r, i) => `
                                <tr>
                                    <td><input class="form-input" value="${r.metric}" onchange="app.editTestResult('${experimentId}', ${i}, 'metric', this.value)" style="border:none; background:transparent;"></td>
                                    <td><input class="form-input" value="${r.value}" onchange="app.editTestResult('${experimentId}', ${i}, 'val', this.value)" style="border:none; background:transparent;"></td>
                                    <td><input class="form-input" value="${r.notes || ''}" onchange="app.editTestResult('${experimentId}', ${i}, 'notes', this.value)" style="border:none; background:transparent;"></td>
                                    <td><button class="btn btn-sm btn-danger" onclick="app.deleteTestResult('${experimentId}', ${i})">✕</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
        }

        document.getElementById('tab-test').innerHTML = `
            ${html || '<div class="empty-state"><div class="empty-icon">🎯</div><h3>暂无测试结果</h3><p>上传 CSV 或手动添加</p></div>'}
            <div style="margin-top: 12px; display: flex; gap: 8px;">
                <button class="btn btn-outline" onclick="app.addTestResult('${experimentId}')">＋ 手动添加</button>
                <button class="btn btn-outline" onclick="document.getElementById('test-csv-file').click()">📄 上传 CSV</button>
            </div>
            <input type="file" id="test-csv-file" accept=".csv" onchange="app.handleTestUpload(event, '${experimentId}')" style="display:none">
            <div class="upload-area" style="margin-top: 16px;" onclick="document.getElementById('test-csv-file').click()">
                <div class="upload-icon">📄</div>
                <div class="upload-text">拖拽测试结果 CSV 到此处</div>
                <div class="upload-hint">或点击选择文件</div>
            </div>
        `;
    }

    deleteTestResultDetail(experimentId) {
        this.showConfirmModal('删除测试结果', '此操作将永久删除测试结果数据', () => {
            Data.updateExperiment(experimentId, { testResultDetail: null, testResults: [] });
            this.showToast('测试结果已删除');
            this.renderExperiment(experimentId);
            this.switchTab('test');
        }, '删除', true);
    }

    deleteTrainingLog(experimentId) {
        this.showConfirmModal('删除训练日志', '删除后概要 Tab 中的超参和摘要指标将同步清除', () => {
            DB.deleteTrainingLog(experimentId);
            this.showToast('训练日志已删除');
            this.renderExperiment(experimentId);
            this.switchTab('log');
        }, '删除', true);
    }

    switchTab(name) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        const tabs = document.querySelectorAll('.tab');
        const names = ['overview', 'log', 'test'];
        const idx = names.indexOf(name);
        if (idx >= 0 && tabs[idx]) tabs[idx].classList.add('active');
        const panel = document.getElementById(`tab-${name}`);
        if (panel) panel.style.display = 'block';
    }

    _isStorageQuotaError(err) {
        const name = err?.name || '';
        const message = err?.message || '';
        return name === 'QuotaExceededError'
            || name === 'NS_ERROR_DOM_QUOTA_REACHED'
            || /quota|exceeded|storage/i.test(message);
    }

    _saveExperimentUpdate(experimentId, updates, context = '保存失败') {
        try {
            Data.updateExperiment(experimentId, updates);
            return true;
        } catch (err) {
            console.error(context, err);
            const message = this._isStorageQuotaError(err)
                ? `${context}：浏览器存储空间不足，请先导出备份并清理旧记录后再导入。`
                : `${context}：${err?.message || err}`;
            this.showToast(message, 'error');
            return false;
        }
    }

    // ==================== CRUD ====================
    addModel() {
        const nameInput = document.getElementById('new-model-name');
        const descInput = document.getElementById('new-model-desc');
        const name = nameInput?.value?.trim();
        if (!name) { this.showToast('请输入项目名称', 'error'); return; }
        const description = descInput?.value?.trim() || '';
        const id = Data.addModel(name, description);
        this.closeModal();
        this.navigate('model:' + id);
    }

    deleteModel(id) {
        const model = Data.getModelById(id);
        this.showConfirmModal('删除项目', `确定删除项目"${model?.name || id}"及其所有实验？`, () => {
            Data.deleteModel(id);
            this.showToast('项目已删除');
            this.navigate('home');
        }, '删除', true);
    }

    addExperiment() {
        const nameInput = document.getElementById('new-exp-name');
        const descInput = document.getElementById('new-exp-desc');
        const name = nameInput?.value?.trim();
        if (!name) { this.showToast('请输入实验名称', 'error'); return; }
        const id = Data.addExperiment(this.currentModelId, name);
        const description = descInput?.value?.trim();
        if (description) Data.updateExperiment(id, { description });
        this.closeModal();
        this.navigate('experiment:' + id);
    }

    deleteExperiment(id) {
        this.showConfirmModal('删除实验', '确定删除此实验？所有相关数据将被永久删除。', () => {
            Data.deleteExperiment(id);
            this.selectedExperiments.delete(id);
            this.showToast('实验已删除');
            if (this.currentModelId) this.navigate('model:' + this.currentModelId);
            else this.navigate('home');
        }, '删除', true);
    }

    // ==================== 批量操作 ====================
    toggleBatchMode() {
        this.batchMode = !this.batchMode;
        if (!this.batchMode) this.selectedExperiments.clear();
        this.renderModel(this.currentModelId);
    }

    toggleSelectExperiment(id) {
        if (this.selectedExperiments.has(id)) this.selectedExperiments.delete(id);
        else this.selectedExperiments.add(id);
        this.renderModel(this.currentModelId);
    }

    selectAllExperiments() {
        Object.values(Data.experiments).filter(e => e.modelId === this.currentModelId).forEach(e => this.selectedExperiments.add(e.id));
        this.renderModel(this.currentModelId);
    }

    deselectAllExperiments() {
        this.selectedExperiments.clear();
        this.renderModel(this.currentModelId);
    }

    batchDelete() {
        if (this.selectedExperiments.size === 0) return;
        const count = this.selectedExperiments.size;
        this.showConfirmModal('批量删除', `确定删除选中的 ${count} 个实验？`, () => {
            this.selectedExperiments.forEach(id => Data.deleteExperiment(id));
            this.selectedExperiments.clear();
            this.batchMode = false;
            this.showToast(`已删除 ${count} 个实验`);
            this.renderModel(this.currentModelId);
        }, '删除', true);
    }

    batchApplyTag() {
        const tag = prompt('输入标签名：');
        if (!tag) return;
        this.selectedExperiments.forEach(id => {
            const exp = Data.getExperimentById(id);
            if (exp) {
                const tags = [...new Set([...(exp.tags || []), tag])];
                Data.updateExperiment(id, { tags });
            }
        });
        this.showToast(`已为 ${this.selectedExperiments.size} 个实验添加标签 "${tag}"`);
        this.renderModel(this.currentModelId);
    }

    exportSelected() {
        if (this.selectedExperiments.size === 0) return;
        let exported = 0;
        this.selectedExperiments.forEach(id => {
            const csv = DB.exportToCSV(id);
            if (!csv) return;
            const exp = Data.getExperimentById(id);
            const safeName = (exp?.name || id).replace(/[^a-zA-Z0-9一-鿿_-]/g, '_');
            const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${safeName}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
            exported++;
        });
        this.showToast(`已导出 ${exported} 个实验为 CSV 文件`);
    }

    // ==================== 参数编辑 ====================
    addParam(experimentId) {
        const key = prompt('参数名：');
        if (!key) return;
        const exp = Data.getExperimentById(experimentId);
        const params = [...(exp.hyperParams || []), { key, value: '' }];
        Data.updateExperiment(experimentId, { hyperParams: params });
        this.renderExperiment(experimentId);
        this.switchTab('overview');
    }

    updateParamKey(experimentId, oldKey, newKey) {
        const exp = Data.getExperimentById(experimentId);
        if (!exp) return;
        const params = (exp.hyperParams || []).map(p => p.key === oldKey ? { ...p, key: newKey } : p);
        Data.updateExperiment(experimentId, { hyperParams: params });
    }

    updateParamValue(experimentId, key, value) {
        const exp = Data.getExperimentById(experimentId);
        if (!exp) return;
        const params = (exp.hyperParams || []).map(p => p.key === key ? { ...p, value } : p);
        Data.updateExperiment(experimentId, { hyperParams: params });
    }

    deleteParam(experimentId, key) {
        const exp = Data.getExperimentById(experimentId);
        if (!exp) return;
        const params = (exp.hyperParams || []).filter(p => p.key !== key);
        Data.updateExperiment(experimentId, { hyperParams: params });
        this.renderExperiment(experimentId);
        this.switchTab('overview');
    }

    updateExpDesc(experimentId) {
        const textarea = document.getElementById('exp-description');
        if (textarea) Data.updateExperiment(experimentId, { description: textarea.value });
    }

    updateExpName(experimentId, name) {
        name = name.trim();
        if (!name) return;
        Data.updateExperiment(experimentId, { name });
        // 更新页面标题
        const title = document.getElementById('experiment-title');
        if (title && title.innerText.trim() !== name) title.innerText = name;
    }

    updateExpDate(experimentId, date) {
        Data.updateExperiment(experimentId, { date });
    }

    renameModel(id, newName) {
        newName = newName.trim();
        if (!newName) return;
        DB.updateModel(id, { name: newName });
        Data.models[id] = DB.getModel(id);
        this.showToast('模型已重命名');
    }

    inlineRenameModel(id, el) {
        const oldName = el.innerText;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = oldName;
        input.className = 'form-input';
        input.style.cssText = 'font-size:inherit; font-weight:inherit; padding:2px 6px; width:100%;';
        const save = () => {
            const newName = input.value.trim();
            if (newName && newName !== oldName) {
                this.renameModel(id, newName);
            }
            el.innerText = newName || oldName;
            el.style.display = '';
        };
        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = oldName; input.blur(); } });
        el.style.display = 'none';
        el.parentNode.insertBefore(input, el);
        input.focus();
        input.select();
    }

    toggleCardDisplayKey(experimentId, key, checked) {
        const exp = Data.getExperimentById(experimentId);
        if (!exp) return;
        let keys = [...(exp.cardDisplayKeys || [])];
        if (checked) {
            keys.push(key);
        } else {
            keys = keys.filter(k => k !== key);
        }
        Data.updateExperiment(experimentId, { cardDisplayKeys: keys });
    }

    // ==================== 测试结果编辑 ====================
    editTestResult(experimentId, index, field, value) {
        const exp = Data.getExperimentById(experimentId);
        if (!exp || !exp.testResults) return;
        const results = [...exp.testResults];
        if (!results[index]) return;
        if (field === 'metric') results[index] = { ...results[index], metric: value };
        else if (field === 'val') results[index] = { ...results[index], value: value };
        else if (field === 'notes') results[index] = { ...results[index], notes: value };
        Data.updateExperiment(experimentId, { testResults: results });
    }

    addTestResult(experimentId) {
        const exp = Data.getExperimentById(experimentId);
        const results = [...(exp.testResults || []), { metric: '', value: '', notes: '' }];
        Data.updateExperiment(experimentId, { testResults: results });
        this.renderExperiment(experimentId);
        this.switchTab('overview');
    }

    deleteTestResult(experimentId, index) {
        const exp = Data.getExperimentById(experimentId);
        if (!exp || !exp.testResults) return;
        const results = exp.testResults.filter((_, i) => i !== index);
        Data.updateExperiment(experimentId, { testResults: results });
        this.renderExperiment(experimentId);
        this.switchTab('overview');
    }

    reUploadTest(experimentId) {
        const input = document.getElementById('test-csv-file');
        if (input) input.click();
    }

    // ==================== 文件上传 ====================
    _extractDateFromFilename(filename) {
        // 优先从文件名提取日期：20240315, 2024-03-15, 2024_03_15
        const patterns = [
            /(\d{4})[-_]?(\d{2})[-_]?(\d{2})/,  // YYYYMMDD / YYYY-MM-DD
        ];
        for (const pat of patterns) {
            const m = filename.match(pat);
            if (m) {
                const [, y, mo, d] = m;
                const date = `${y}-${mo}-${d}`;
                if (!isNaN(new Date(date).getTime())) return date;
            }
        }
        return null;
    }

    _executeLogImport(experimentId, text, parsed, mode) {
        // 1. 同步超参数到实验
        if (parsed.hyperParams && Object.keys(parsed.hyperParams).length > 0) {
            const exp = Data.getExperimentById(experimentId);
            const existing = exp.hyperParams || [];
            const merged = [...existing];
            for (const [k, v] of Object.entries(parsed.hyperParams)) {
                const idx = merged.findIndex(p => p.key === k);
                if (idx >= 0) merged[idx] = { ...merged[idx], value: String(v) };
                else merged.push({ key: k, value: String(v) });
            }
            Data.updateExperiment(experimentId, { hyperParams: merged });
        }

        // 2. 导入训练日志（追加或覆盖）
        if (mode === 'append') {
            const existingLog = Data.getTrainingLog(experimentId);
            if (existingLog && existingLog.epochs && existingLog.epochs.length > 0) {
                const oldEpochs = existingLog.epochs;
                const newEpochs = parsed.epochs;
                const offset = oldEpochs.length;
                const epochCol = parsed.columns.find(c => /^epoch$/i.test(c));
                const reindexed = newEpochs.map((ep, i) => {
                    const copy = { ...ep };
                    if (epochCol) copy[epochCol] = offset + i + 1;
                    return copy;
                });
                const mergedEpochs = [...oldEpochs, ...reindexed];
                const mergedRows = mergedEpochs.map(ep => parsed.columns.map(c => ep[c] ?? ''));
                const valCol = parsed.columns.find(c => /val.*acc/i.test(c));
                let bestValAcc = existingLog.bestValAcc, bestEpoch = existingLog.bestEpoch;
                if (valCol) {
                    mergedEpochs.forEach((ep, i) => {
                        const v = parseFloat(ep[valCol]);
                        if (!isNaN(v) && (bestValAcc == null || v > bestValAcc)) {
                            bestValAcc = v;
                            bestEpoch = i + 1;
                        }
                    });
                }
                DB.saveTrainingLog(experimentId, {
                    columns: parsed.columns, epochs: mergedEpochs, rows: mergedRows,
                    bestValAcc, bestEpoch, totalEpochs: mergedEpochs.length,
                    hyperParams: parsed.hyperParams || {}
                });
                this.showToast(`训练日志追加成功：+${newEpochs.length} 条（共 ${mergedEpochs.length} 条）`);
            } else {
                Data.addTrainingLog(experimentId, text);
                this.showToast(`训练日志导入成功：${parsed.totalEpochs} 条记录`);
            }
        } else {
            Data.addTrainingLog(experimentId, text);
            this.showToast(`训练日志导入成功：${parsed.totalEpochs} 条记录`);
        }

        this.renderExperiment(experimentId);
        this.switchTab('log');
    }

    _showLogPreviewModal(file, experimentId, text, parsed) {
        const existingLog = Data.getTrainingLog(experimentId);
        const hasExisting = existingLog && existingLog.epochs && existingLog.epochs.length > 0;
        const fileDate = this._extractDateFromFilename(file.name);
        const hp = parsed.hyperParams || {};
        const hpKeys = Object.keys(hp);
        const cols = parsed.columns || [];
        const epochs = parsed.epochs || [];
        const previewRows = epochs.slice(0, 20);
        const warnings = parsed.warnings || [];

        let statusHtml = `<span style="color:var(--success);">✅ 解析成功：${parsed.totalEpochs} 条记录</span>`;
        if (warnings.length > 0) {
            statusHtml += `<br><span style="color:var(--warning);">⚠️ ${warnings.join('；')}</span>`;
        }
        if (fileDate) {
            statusHtml += `<br><span style="color:var(--text-muted);">📅 从文件名提取日期：${fileDate}</span>`;
        }

        let hyperTableHtml = '';
        if (hpKeys.length > 0) {
            hyperTableHtml = `<div style="margin-bottom:16px;">
                <h4 style="margin-bottom:8px;">⚙️ 提取到的超参数</h4>
                <table class="data-table"><thead><tr><th>参数</th><th>值</th></tr></thead>
                <tbody>${hpKeys.map(k => `<tr><td>${k}</td><td>${hp[k]}</td></tr>`).join('')}</tbody></table>
            </div>`;
        }

        const headHtml = cols.map(c => `<th>${c}</th>`).join('');
        const bodyHtml = previewRows.map(row =>
            '<tr>' + cols.map(c => `<td>${row[c] ?? ''}</td>`).join('') + '</tr>'
        ).join('');
        const dataPreviewHtml = `<div>
            <h4 style="margin-bottom:8px;">📊 训练数据预览${epochs.length > 20 ? `（前 20 / ${epochs.length} 条）` : ''}</h4>
            <div class="table-container" style="max-height:300px; overflow:auto;">
                <table class="data-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
            </div>
        </div>`;

        let modeHtml = '';
        if (hasExisting) {
            modeHtml = `<div style="margin-bottom:16px; padding:12px; background:var(--warning-bg, #fff3cd); border-radius:8px;">
                <strong>⚠️ 当前已有 ${existingLog.totalEpochs || existingLog.epochs.length} 条训练记录</strong>
                <div style="margin-top:8px; display:flex; gap:12px;">
                    <label><input type="radio" name="log-import-mode" value="replace" checked> 覆盖</label>
                    <label><input type="radio" name="log-import-mode" value="append"> 追加（续训）</label>
                </div>
            </div>`;
        }

        this.elements.modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="if(event.target===this) app.closeModal()">
                <div class="modal modal-lg" style="max-width:900px;">
                    <div class="modal-header"><h3>📄 训练日志预览</h3><button class="btn btn-ghost" onclick="app.closeModal()">✕</button></div>
                    <div class="modal-body" style="max-height:75vh; overflow-y:auto; padding:20px 24px;">
                        <div style="margin-bottom:12px;">${statusHtml}</div>
                        ${modeHtml}
                        ${hyperTableHtml}
                        ${dataPreviewHtml}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="app.closeModal()">取消</button>
                        <button class="btn btn-primary" id="log-preview-confirm">确认导入</button>
                    </div>
                </div>
            </div>`;

        document.getElementById('log-preview-confirm').onclick = () => {
            const modeRadio = document.querySelector('input[name="log-import-mode"]:checked');
            const mode = modeRadio ? modeRadio.value : 'replace';
            this.closeModal();
            if (fileDate) Data.updateExperiment(experimentId, { date: fileDate });
            this._executeLogImport(experimentId, text, parsed, mode);
        };
    }

    handleLogUpload(event, experimentId) {
        const file = event.target.files[0];
        if (!file) return;
        event.target.value = '';
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const parsed = CSVParser.parseTrainingLog(text);
            if (!parsed.success) {
                this.showToast('解析失败：' + parsed.error, 'error');
                return;
            }
            this._showLogPreviewModal(file, experimentId, text, parsed);
        };
        reader.readAsText(file);
    }

    _showTestPreviewModal(experimentId, parsed) {
        const predictions = parsed.predictions || [];
        const summary = parsed.summary || {};
        const cm = parsed.confusionMatrix;

        // 汇总指标
        const metrics = [
            { label: 'Test ACC', value: summary.testAcc != null ? summary.testAcc + '%' : '--' },
            { label: 'mAP', value: summary.mAP != null ? summary.mAP : '--' },
            { label: 'Avg Inference', value: summary.avgInferenceTime != null ? summary.avgInferenceTime : '--' },
            { label: 'Test Loss', value: summary.testLoss != null ? summary.testLoss : '--' }
        ];
        // 二分类指标
        const binary = this._calcBinaryMetrics(cm);
        if (binary) {
            const fmt = v => v != null ? (v * 100).toFixed(2) + '%' : '--';
            metrics.push({ label: 'Precision', value: fmt(binary.precision) });
            metrics.push({ label: 'Recall', value: fmt(binary.recall) });
            metrics.push({ label: 'F1 Score', value: fmt(binary.f1) });
        }
        const cols = metrics.length <= 4 ? 4 : metrics.length;
        let summaryHtml = `<div style="display:grid; grid-template-columns:repeat(${cols},1fr); gap:8px; margin-bottom:16px;">
            ${metrics.map(m => `<div style="background:var(--card-bg,#f8f9fa); padding:12px; border-radius:8px; text-align:center;">
                <div style="font-size:12px; color:var(--text-muted);">${m.label}</div>
                <div style="font-size:18px; font-weight:700;">${m.value}</div>
            </div>`).join('')}
        </div>`;

        // 混淆矩阵
        let cmHtml = '';
        if (cm && cm.matrix && cm.labels) {
            const labels = cm.labels;
            const matrix = cm.matrix;
            cmHtml = `<div style="margin-bottom:16px;">
                <h4 style="margin-bottom:8px;">🔢 混淆矩阵</h4>
                <div style="overflow:auto;">
                    <table class="data-table" style="text-align:center;">
                        <thead><tr><th style="font-weight:700;">实际\\预测</th>${labels.map(l => `<th>${l}</th>`).join('')}</tr></thead>
                        <tbody>${matrix.map((row, i) => `<tr><td style="font-weight:700;">${labels[i]}</td>${row.map((v, j) => {
                            const cls = i === j ? 'style="background:rgba(0,184,148,0.15); font-weight:700;"' : (v > 0 ? 'style="background:rgba(225,112,85,0.15); color:#e17055;"' : '');
                            return `<td ${cls}>${v}</td>`;
                        }).join('')}</tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>`;
        }

        // 预测预览
        const previewPreds = predictions.slice(0, 20);
        let predHtml = '';
        if (previewPreds.length > 0) {
            predHtml = `<div>
                <h4 style="margin-bottom:8px;">📋 预测结果预览${predictions.length > 20 ? `（前 20 / ${predictions.length} 条）` : `（${predictions.length} 条）`}</h4>
                <div class="table-container" style="max-height:300px; overflow:auto;">
                    <table class="data-table">
                        <thead><tr><th>文件路径</th><th>实际标签</th><th>预测标签</th><th>置信度</th></tr></thead>
                        <tbody>${previewPreds.map(p => `<tr>
                            <td style="font-size:12px; word-break:break-all;">${p.filePath || ''}</td>
                            <td>${p.actualLabel}</td>
                            <td>${p.predictLabel}</td>
                            <td>${p.confidence != null ? (p.confidence * 100).toFixed(1) + '%' : '--'}</td>
                        </tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>`;
        }

        this.elements.modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="if(event.target===this) app.closeModal()">
                <div class="modal modal-lg" style="max-width:900px;">
                    <div class="modal-header"><h3>🎯 测试结果预览</h3><button class="btn btn-ghost" onclick="app.closeModal()">✕</button></div>
                    <div class="modal-body" style="max-height:75vh; overflow-y:auto; padding:20px 24px;">
                        <div style="margin-bottom:12px;"><span style="color:var(--success);">✅ 解析成功：${predictions.length} 条预测</span></div>
                        ${summaryHtml}
                        ${cmHtml}
                        ${predHtml}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="app.closeModal()">取消</button>
                        <button class="btn btn-primary" id="test-preview-confirm">确认导入</button>
                    </div>
                </div>
            </div>`;

        document.getElementById('test-preview-confirm').onclick = () => {
            this.closeModal();
            const detail = {
                summary: parsed.summary || {},
                predictions: parsed.predictions || [],
                confusionMatrix: parsed.confusionMatrix || null
            };
            const results = [];
            if (parsed.summary) {
                if (parsed.summary.testAcc != null) results.push({ metric: 'Test Accuracy', value: parsed.summary.testAcc + '%', notes: '自动计算' });
                if (parsed.summary.mAP != null) results.push({ metric: 'mAP', value: parsed.summary.mAP, notes: '' });
            }
            if (!this._saveExperimentUpdate(experimentId, { testResultDetail: detail, testResults: results }, '测试结果保存失败')) return;
            this.showToast('测试结果导入成功');
            this.renderExperiment(experimentId);
            this.switchTab('test');
        };
    }

    handleTestUpload(event, experimentId) {
        const file = event.target.files[0];
        if (!file) return;
        event.target.value = '';
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const parsed = CSVParser.parseTestResult(text);
            if (parsed.success) {
                this._showTestPreviewModal(experimentId, parsed);
            } else {
                this.showToast('解析失败：' + parsed.error, 'error');
            }
        };
        reader.readAsText(file);
    }

    uploadConfig(experimentId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.yaml,.yml,.json,.txt,.cfg,.ini,.py';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                Data.updateExperiment(experimentId, { config: ev.target.result });
                this.showToast('配置文件已上传');
                this.renderExperiment(experimentId);
                this.switchTab('overview');
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // ==================== CSV 导入 ====================
    importCSV(event, modelId) {
        const file = event.target.files[0];
        if (!file) return;
        event.target.value = '';
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            this._processCSVImport(modelId, text, file.name);
        };
        reader.readAsText(file);
    }

    _processCSVImport(modelId, text, filename) {
        const lines = text.split(/\r?\n/);
        const isExported = text.includes('# Experiment Configuration') || text.includes('===== Training Data =====') || text.includes('===== Test Results =====');

        if (isExported) {
            this._importExportedCSV(modelId, lines, filename);
        } else {
            this._importPlainCSV(modelId, text, filename);
        }
    }

    _importExportedCSV(modelId, lines, filename) {
        // 解析导出格式的 CSV
        let expName = filename.replace(/\.csv$/i, '');
        let expDate = '';
        let expNotes = '';
        let expTags = [];
        const hyperParams = [];
        let trainingSection = null;
        let testSummary = {};
        let testPredictions = [];
        let testConfusionMatrix = null;

        let section = 'config'; // config | hyper | training | test_summary | test_predictions | test_cm
        let trainingLines = [];
        let testLines = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // 检测段落分隔
            if (trimmed.startsWith('===== Training Data =====')) { section = 'training'; continue; }
            if (trimmed.startsWith('===== Test Results =====')) { section = 'test_summary'; continue; }
            if (trimmed === 'Confusion Matrix') { section = 'test_cm'; continue; }
            if (section === 'test_summary' && trimmed.startsWith('file_path,')) { section = 'test_predictions'; }
            if (section === 'test_predictions' && !trimmed.includes(',') && trimmed !== '') { section = 'test_summary'; }

            // 配置区和超参区（# 开头）
            if (trimmed.startsWith('#')) {
                const content = trimmed.substring(1).trim();
                if (!content) continue;

                if (section === 'config') {
                    if (content.startsWith('Name,')) expName = content.substring(5);
                    else if (content.startsWith('Date,')) expDate = content.substring(5);
                    else if (content.startsWith('Notes,')) expNotes = content.substring(6);
                    else if (content.startsWith('Tags,')) expTags = content.substring(5).split(';').filter(Boolean);
                    else if (content === 'HyperParameters') section = 'hyper';
                } else if (section === 'hyper') {
                    const idx = content.indexOf(',');
                    if (idx > 0) {
                        hyperParams.push({ key: content.substring(0, idx), value: content.substring(idx + 1) });
                    }
                }
                continue;
            }

            // 训练数据
            if (section === 'training' && trimmed) {
                trainingLines.push(trimmed);
            }

            // 测试结果
            if (section === 'test_summary' && trimmed && trimmed !== 'Test Summary') {
                const idx = trimmed.indexOf(',');
                if (idx > 0) {
                    const k = trimmed.substring(0, idx);
                    const v = trimmed.substring(idx + 1);
                    if (k === 'testAcc' || k === 'Test Accuracy') testSummary.testAcc = parseFloat(v) || v;
                    else if (k === 'mAP') testSummary.mAP = v;
                    else if (k === 'testLoss' || k === 'Test Loss') testSummary.testLoss = v;
                    else if (k === 'avgInferenceTime' || k === 'Inference Time') testSummary.avgInferenceTime = v;
                    else testSummary[k] = v;
                }
            }

            if (section === 'test_predictions' && trimmed && !trimmed.startsWith('file_path,')) {
                const parts = trimmed.split(',');
                if (parts.length >= 3) {
                    testPredictions.push({
                        filePath: parts[0],
                        actualLabel: parts[1],
                        predictLabel: parts[2],
                        confidence: parts[3] ? parseFloat(parts[3]) : null
                    });
                }
            }

            if (section === 'test_cm' && trimmed && trimmed !== 'Confusion Matrix') {
                const parts = trimmed.split(',');
                if (!testConfusionMatrix) {
                    testConfusionMatrix = { labels: parts.slice(1), matrix: [] };
                } else {
                    testConfusionMatrix.matrix.push(parts.slice(1).map(v => parseInt(v) || 0));
                }
            }
        }

        // 创建实验
        const expId = Data.addExperiment(modelId, expName);
        const updates = {};
        if (expDate) updates.date = expDate;
        if (expNotes) updates.description = expNotes;
        if (expTags.length > 0) updates.tags = expTags;
        if (hyperParams.length > 0) updates.hyperParams = hyperParams;
        Data.updateExperiment(expId, updates);

        // 导入训练日志 — 直接解析，不走 CSVParser（避免表头被误识别）
        if (trainingLines.length >= 2) {
            const cols = trainingLines[0].split(',').map(c => c.trim());
            const epochs = trainingLines.slice(1).map(line => {
                const vals = line.split(',');
                const row = {};
                cols.forEach((c, i) => { row[c] = vals[i] ?? ''; });
                return row;
            });
            const rows = epochs.map(ep => cols.map(c => ep[c] ?? ''));
            // 计算 best val_acc
            const valCol = cols.find(c => /val.*acc/i.test(c));
            let bestValAcc = null, bestEpoch = null;
            if (valCol) {
                epochs.forEach((ep, i) => {
                    const v = parseFloat(ep[valCol]);
                    if (!isNaN(v) && (bestValAcc == null || v > bestValAcc)) {
                        bestValAcc = v;
                        bestEpoch = i + 1;
                    }
                });
            }
            DB.saveTrainingLog(expId, {
                columns: cols, epochs, rows, bestValAcc, bestEpoch,
                totalEpochs: epochs.length, hyperParams: {}
            });
        }

        // 导入测试结果
        if (testPredictions.length > 0 || Object.keys(testSummary).length > 0) {
            const detail = { summary: testSummary, predictions: testPredictions, confusionMatrix: testConfusionMatrix };
            const results = [];
            if (testSummary.testAcc != null) results.push({ metric: 'Test Accuracy', value: testSummary.testAcc + '%', notes: '自动计算' });
            if (testSummary.mAP != null) results.push({ metric: 'mAP', value: testSummary.mAP, notes: '' });
            if (!this._saveExperimentUpdate(expId, { testResultDetail: detail, testResults: results }, '测试结果保存失败')) return;
        }

        this.showToast(`已导入实验：${expName}`);
        this.renderModel(modelId);
    }

    _importPlainCSV(modelId, text, filename) {
        // 普通 CSV：尝试解析为训练日志或测试结果
        const parsedLog = CSVParser.parseTrainingLog(text);
        const parsedTest = CSVParser.parseTestResult(text);

        const baseName = filename.replace(/\.csv$/i, '');
        const expId = Data.addExperiment(modelId, baseName);

        // 从文件名提取日期
        const fileDate = this._extractDateFromFilename(filename);
        if (fileDate) Data.updateExperiment(expId, { date: fileDate });

        let imported = [];
        if (parsedLog.success) {
            Data.addTrainingLog(expId, text);
            imported.push(`训练日志 ${parsedLog.totalEpochs} 条`);
            // 同步超参
            if (parsedLog.hyperParams && Object.keys(parsedLog.hyperParams).length > 0) {
                const merged = Object.entries(parsedLog.hyperParams).map(([key, value]) => ({ key, value: String(value) }));
                Data.updateExperiment(expId, { hyperParams: merged });
            }
        }
        if (parsedTest.success) {
            const detail = {
                summary: parsedTest.summary || {},
                predictions: parsedTest.predictions || [],
                confusionMatrix: parsedTest.confusionMatrix || null
            };
            const results = [];
            if (parsedTest.summary) {
                if (parsedTest.summary.testAcc != null) results.push({ metric: 'Test Accuracy', value: parsedTest.summary.testAcc + '%', notes: '自动计算' });
                if (parsedTest.summary.mAP != null) results.push({ metric: 'mAP', value: parsedTest.summary.mAP, notes: '' });
            }
            if (!this._saveExperimentUpdate(expId, { testResultDetail: detail, testResults: results }, '测试结果保存失败')) return;
            imported.push(`测试结果 ${(parsedTest.predictions || []).length} 条`);
        }

        if (imported.length === 0) {
            this.showToast('无法识别 CSV 格式', 'error');
            Data.deleteExperiment(expId);
            return;
        }

        this.showToast(`已导入：${imported.join('、')}`);
        this.renderModel(modelId);
    }

    // ==================== 过滤排序 ====================
    toggleFilterTag(tag) {
        const idx = this.filters.tags.indexOf(tag);
        if (idx >= 0) this.filters.tags.splice(idx, 1);
        else this.filters.tags.push(tag);
        this.renderModel(this.currentModelId);
    }

    setSortField(field) {
        this.filters.sortField = field;
        this.renderModel(this.currentModelId);
    }

    toggleSortOrder() {
        this.filters.sortOrder = this.filters.sortOrder === 'desc' ? 'asc' : 'desc';
        this.renderModel(this.currentModelId);
    }

    // ==================== 弹窗 ====================
    showAddModelModal() {
        this.elements.modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="if(event.target===this) app.closeModal()">
                <div class="modal modal-md">
                    <div class="modal-header"><h3>创建新项目</h3><button class="btn btn-ghost" onclick="app.closeModal()">✕</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>项目名称</label><input type="text" id="new-model-name" class="form-input" placeholder="例: ResNet-50 图像分类"></div>
                        <div class="form-group"><label>项目描述</label><textarea id="new-model-desc" class="form-input" rows="3" placeholder="项目背景、目标等等"></textarea></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="app.closeModal()">取消</button>
                        <button class="btn btn-primary" onclick="app.addModel()">创建</button>
                    </div>
                </div>
            </div>
        `;
        setTimeout(() => document.getElementById('new-model-name')?.focus(), 100);
    }

    showAddExperimentModal() {
        this.elements.modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="if(event.target===this) app.closeModal()">
                <div class="modal modal-md">
                    <div class="modal-header"><h3>添加新实验</h3><button class="btn btn-ghost" onclick="app.closeModal()">✕</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>实验名称</label><input type="text" id="new-exp-name" class="form-input" placeholder="例: 使用CosineAnnealing调度器"></div>
                        <div class="form-group"><label>实验描述</label><textarea id="new-exp-desc" class="form-input" rows="3" placeholder="简述实验目的"></textarea></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="app.closeModal()">取消</button>
                        <button class="btn btn-primary" onclick="app.addExperiment()">创建</button>
                    </div>
                </div>
            </div>
        `;
        setTimeout(() => document.getElementById('new-exp-name')?.focus(), 100);
    }

    showSettingsModal() {
        const modelCount = Object.keys(Data.models).length;
        const expCount = Object.keys(Data.experiments).length;
        const size = new Blob([JSON.stringify(Data.exportAll())]).size;
        const sizeStr = size > 1024 * 1024 ? (size / 1024 / 1024).toFixed(2) + ' MB' : (size / 1024).toFixed(1) + ' KB';

        this.elements.modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="if(event.target===this) app.closeModal()">
                <div class="modal modal-md">
                    <div class="modal-header"><h3>⚙️ 数据管理</h3><button class="btn btn-ghost" onclick="app.closeModal()">✕</button></div>
                    <div class="modal-body">
                        <p>📊 <strong>${modelCount}</strong> 个项目，<strong>${expCount}</strong> 个实验</p>
                        <p>💾 数据大小：<strong>${sizeStr}</strong></p>
                        <p style="font-size: 0.9rem; color: var(--text-muted);">数据存储在浏览器 localStorage 中，清除浏览器数据会丢失。建议定期导出备份。</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="app.exportAll()">📦 导出全部</button>
                        <button class="btn btn-outline" onclick="app.triggerImport()">📥 导入</button>
                        <button class="btn btn-outline" onclick="app.closeModal()">关闭</button>
                    </div>
                </div>
            </div>
        `;
    }

    closeModal() {
        this.elements.modalContainer.innerHTML = '';
    }

    showConfirmModal(title, message, onConfirm, confirmText = '确定', danger = false) {
        this.elements.modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="if(event.target===this) app.closeModal()">
                <div class="modal modal-sm">
                    <div class="modal-header"><h3>${title}</h3><button class="btn btn-ghost" onclick="app.closeModal()">✕</button></div>
                    <div class="modal-body"><p>${message}</p></div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="app.closeModal()">取消</button>
                        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-modal-ok">${confirmText}</button>
                    </div>
                </div>
            </div>`;
        document.getElementById('confirm-modal-ok').onclick = () => { this.closeModal(); onConfirm(); };
    }

    // ==================== 导入导出 ====================
    exportAll() {
        const data = Data.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `dl_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.showToast('数据已导出');
        this.closeModal();
    }

    triggerImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.name.toLowerCase().endsWith('.json')) {
                this.showToast('请选择 JSON 文件', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (data.models || data.experiments) {
                        this.showConfirmModal('导入数据', '这将覆盖所有现有数据，确定要导入吗？', () => {
                            Data.importAll(data);
                            this.showToast('数据导入成功!');
                            this.closeModal();
                            this.navigate('home');
                        }, '导入', true);
                    } else {
                        this.showToast('无效的数据文件', 'error');
                    }
                } catch (err) {
                    this.showToast('文件解析失败: ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // ==================== Toast ====================
    showToast(message, type = 'success') {
        const container = this.elements.toastContainer;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ==================== 示例数据 ====================
    addDemoData() {
        const doAdd = () => {
            const modelId = Data.addModel('ResNet-50 图像分类', '基于CIFAR-10数据集的图像分类任务');
            const expId1 = Data.addExperiment(modelId, 'ResNet-50 Baseline');
            Data.updateExperiment(expId1, {
                hyperParams: [
                    { key: 'learning_rate', value: '0.001' },
                    { key: 'batch_size', value: '128' },
                    { key: 'epochs', value: '100' },
                    { key: 'optimizer', value: 'Adam' },
                    { key: 'weight_decay', value: '0.0001' }
                ],
                description: '使用默认参数训练的基线模型。采用Adam优化器，学习率0.001，batch size 128。',
                testResults: [
                    { metric: 'Test Accuracy', value: '93.62%', notes: '最终测试精度' },
                    { metric: 'Test Loss', value: '0.2156', notes: '交叉熵损失' },
                    { metric: 'Inference Time', value: '2.3ms/image', notes: 'GPU推理时间' }
                ]
            });
            Data.addTrainingLog(expId1, [
                'epoch,train_loss,train_acc,val_loss,val_acc,learning_rate',
                ...this.generateDemoLog(0.001, 30, 93.5, 0.05, 4.0)
            ].join('\n'));

            const expId2 = Data.addExperiment(modelId, 'ResNet-50 Cosine Annealing');
            Data.updateExperiment(expId2, {
                hyperParams: [
                    { key: 'learning_rate', value: '0.01' },
                    { key: 'batch_size', value: '128' },
                    { key: 'epochs', value: '100' },
                    { key: 'optimizer', value: 'SGD+Momentum' },
                    { key: 'scheduler', value: 'CosineAnnealing' }
                ],
                description: '使用Cosine Annealing学习率调度策略。初始学习率0.01，配合SGD+Momentum优化器。',
                testResults: [
                    { metric: 'Test Accuracy', value: '94.87%', notes: '最终测试精度' },
                    { metric: 'Test Loss', value: '0.1823', notes: '交叉熵损失' },
                    { metric: 'F1 Score', value: '0.949', notes: '加权平均F1' }
                ]
            });
            Data.addTrainingLog(expId2, [
                'epoch,train_loss,train_acc,val_loss,val_acc,learning_rate',
                ...this.generateDemoLog(0.01, 30, 94.5, 0.03, 6.0, true)
            ].join('\n'));

            const modelId2 = Data.addModel('BERT 文本分类', '情感分析任务');
            const expId3 = Data.addExperiment(modelId2, 'BERT-base 微调');
            Data.updateExperiment(expId3, {
                hyperParams: [
                    { key: 'learning_rate', value: '2e-5' },
                    { key: 'batch_size', value: '32' },
                    { key: 'epochs', value: '3' },
                    { key: 'warmup_steps', value: '500' },
                    { key: 'max_seq_length', value: '128' }
                ],
                description: '在情感分析数据集上微调BERT-base模型。',
                testResults: [
                    { metric: 'Test Accuracy', value: '91.3%', notes: '测试集准确率' },
                    { metric: 'Test F1', value: '0.912', notes: '宏平均F1' },
                    { metric: 'Test AUC', value: '0.968', notes: 'ROC曲线下面积' }
                ]
            });
            Data.addTrainingLog(expId3, [
                'epoch,train_loss,train_acc,val_loss,val_acc',
                '1,0.4521,0.8234,0.3156,0.8867',
                '2,0.1987,0.9312,0.2534,0.9089',
                '3,0.0876,0.9723,0.2745,0.9134'
            ].join('\n'));

            Data.save();
            this.showToast('示例数据已添加！共3个实验');
            this.navigate('home');
        };
        if (Object.keys(Data.models).length > 0) {
            this.showConfirmModal('添加示例数据', '将追加到现有数据，确定吗？', doAdd);
        } else {
            doAdd();
        }
    }

    generateDemoLog(initLR, epochs, bestAcc, startLoss, startAcc, useCosine = false) {
        const lines = [];
        for (let i = 1; i <= epochs; i++) {
            const progress = i / epochs;
            const trainLoss = (startLoss * Math.exp(-2.5 * progress) + 0.02 + Math.random() * 0.03).toFixed(4);
            const trainAcc = (startAcc + (99.5 - startAcc) * (1 - Math.exp(-3 * progress)) + Math.random() * 0.3).toFixed(2);
            const valLoss = (parseFloat(trainLoss) + 0.05 + Math.random() * 0.1 - 0.05).toFixed(4);
            const bestIdx = Math.floor(epochs * 0.7);
            const valAcc = i <= bestIdx
                ? (startAcc + (bestAcc - startAcc) * (i / bestIdx) + Math.random() * 0.3)
                : (bestAcc - 0.3 + Math.random() * 0.6);
            let lr;
            if (useCosine) {
                lr = (initLR * 0.5 * (1 + Math.cos(Math.PI * progress))).toFixed(6);
            } else {
                lr = (initLR * Math.pow(0.97, i)).toFixed(6);
            }
            lines.push(`${i},${trainLoss},${trainAcc},${valLoss},${valAcc.toFixed(2)},${lr}`);
        }
        return lines;
    }
}

// ==================== 初始化 ====================
const app = new ExperimentTracker();
app.init();
