// ==================== UI 渲染层 ====================
class TrackerUI {

    getTagIcon(tag) {
        const icons = {
            'baseline': '📊', '改进': '🔧', '优化': '⚡', '实验': '🔬',
            '消融': '🧪', '对比': '⚖️', '调试': '🐛',
            'Convolutional': '🖼️', 'Recurrent': '♻️', 'Transformer': '🤖',
            'Graph Neural Network': '🕸️', 'Reinforcement Learning': '🎮', 'Generative Model': '✨',
            'SOTA': '🏆', '过拟合': '📈', '正则化': '🛡️', '调参': '🎛️', '数据增强': '🔄'
        };
        return icons[tag] || '🏷️';
    }

    getTagClass(tag) {
        const classes = {
            'baseline': 'tag-baseline', 'SOTA': 'tag-sota', '过拟合': 'tag-warning'
        };
        return classes[tag] || '';
    }

    // ==================== Model List ====================
    renderModelList(models, allExperiments) {
        let html = '';
        const modelIds = Object.keys(models);
        if (modelIds.length === 0) {
            html = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔬</div>
                    <h3>暂无模型项目</h3>
                    <p>点击"＋ 创建新项目"开始记录你的第一个实验</p>
                    <div style="margin-top: 20px;">
                        <button onclick="app.addDemoData()" class="btn btn-outline" style="font-size: 1.1rem; padding: 12px 28px;">📝 加载示例数据</button>
                    </div>
                </div>
            `;
        } else {
            for (const id of modelIds) {
                const model = models[id];
                const experiments = Object.values(allExperiments).filter(e => e.modelId === id);
                const hasExps = experiments.length > 0;

                let bestAcc = '--';
                if (hasExps) {
                    const accs = experiments
                        .filter(e => e.testResults && e.testResults.length > 0)
                        .map(e => {
                            const first = e.testResults[0].value;
                            const n = parseFloat(first.replace('%', ''));
                            return isNaN(n) ? null : n;
                        })
                        .filter(n => n !== null);
                    if (accs.length > 0) bestAcc = Math.max(...accs).toFixed(1) + '%';
                }

                let latestDate = 'N/A';
                if (hasExps) {
                    const dates = experiments.map(e => e.updatedAt || e.createdAt).sort();
                    latestDate = new Date(dates[dates.length - 1]).toLocaleDateString();
                }

                html += `
                    <div class="model-card" onclick="app.navigate('model:${id}')">
                        <div class="model-card-header">
                            <div style="flex:1; min-width:0;">
                                <h3 class="model-card-title">${model.name}</h3>
                            </div>
                            <button class="btn btn-icon btn-danger" onclick="event.stopPropagation(); app.deleteModel('${id}')" title="删除">🗑️</button>
                        </div>
                        <p class="model-card-desc">${model.description || '暂无描述'}</p>
                        <div class="model-card-stats">
                            <div class="model-stat-value">${experiments.length}</div>
                            <div class="model-stat-label">实验</div>
                            <div class="model-stat-value">${bestAcc}</div>
                            <div class="model-stat-label">最佳</div>
                            <div class="model-stat-value">${latestDate}</div>
                            <div class="model-stat-label">更新日期</div>
                        </div>
                    </div>
                `;
            }
        }
        this.elements.modelsContainer.innerHTML = html;
    }

    // ==================== Experiment List ====================
    renderExperimentList(modelId, experiments, sortedIds) {
        const model = Data.getModelById(modelId);
        this.elements.modelTitle.textContent = model ? model.name : 'Model';

        const exps = sortedIds || experiments.map(e => e.id);

        let html = `
            <div class="section-header">
                <h2 class="section-title">${exps.length} 个实验</h2>
                <div class="section-actions">
                    <button class="btn btn-primary" onclick="app.showAddExperimentModal()">＋ 添加实验</button>
                    <button class="btn btn-outline" onclick="app.toggleBatchMode()">
                        <span id="batch-mode-btn-text">${app.batchMode ? '❌ 退出批量' : '☑️ 批量模式'}</span>
                    </button>
                    <button class="btn btn-outline btn-danger" onclick="app.deleteModel('${modelId}')">🗑️ 删除项目</button>
                </div>
            </div>
        `;

        if (exps.length === 0) {
            html += `
                <div class="empty-state">
                    <div class="empty-state-icon">🧪</div>
                    <h3>暂无实验</h3>
                    <p>点击"添加实验"或"批量导入实验"开始记录</p>
                </div>
            `;
        } else {
            html += '<div class="card-grid">';
            for (const expId of exps) {
                const exp = experiments.find(e => e.id === expId);
                if (!exp) continue;
                const isSelected = app.selectedExperiments.has(exp.id);
                const checkboxClass = `experiment-checkbox ${app.batchMode ? 'visible' : ''}`;
                const selectedClass = `experiment-card ${isSelected ? 'selected' : ''} exp-card-${exp.id.replace(/[^a-zA-Z0-9]/g, '')}`;

                let tagsHtml = '';
                if (exp.hyperParams && Array.isArray(exp.hyperParams)) {
                    tagsHtml = exp.hyperParams.map(p => `<span class="tag ${this.getTagClass(p.value)}">${this.getTagIcon(p.value)} ${p.value}</span>`).join('');
                }

                let testSummary = '';
                if (exp.testResults && exp.testResults.length > 0) {
                    testSummary = '<div class="test-summary">' + exp.testResults.map(r => `
                        <span class="test-metric">
                            <span class="test-metric-name">${r.metric}:</span>
                            <span class="test-metric-value">${r.value}</span>
                        </span>
                    `).join('') + '</div>';
                }

                let updateDate = 'N/A';
                if (exp.updatedAt || exp.createdAt) {
                    const d = new Date(exp.updatedAt || exp.createdAt);
                    updateDate = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
                }

                html += `
                    <div class="${selectedClass}" onclick="app.navigate('experiment:${exp.id}')">
                        <div class="${checkboxClass}" onclick="event.stopPropagation(); app.toggleSelectExperiment('${exp.id}')">
                            <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation()">
                        </div>
                        <div class="exp-card-header">
                            <div class="exp-card-date">📅 ${updateDate}</div>
                        </div>
                        <div class="exp-card-name">${exp.name}</div>
                        <div class="exp-card-tags">${tagsHtml}</div>
                        ${testSummary}
                        <div class="exp-card-actions" onclick="event.stopPropagation()">
                            <button class="btn btn-icon btn-danger" onclick="app.deleteExperiment('${exp.id}')" title="删除实验">✕</button>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
        }

        this.elements.experimentsList.innerHTML = html;
    }

    // ==================== Filter Controls ====================
    renderFilterControls(allTags, currentFilters) {
        const sortField = currentFilters.sortField || 'date';
        const sortOrder = currentFilters.sortOrder || 'desc';

        this.elements.filterButtons.innerHTML = allTags.slice(0, 15).map(tag => {
            const isActive = currentFilters.tags && currentFilters.tags.includes(tag);
            return `<button class="filter-tag ${isActive ? 'active' : ''}" data-tag="${tag}" onclick="app.toggleFilterTag('${tag}')">${this.getTagIcon(tag)} ${tag}</button>`;
        }).join('');

        this.elements.activeFilters.innerHTML = `
            <button class="sort-btn ${sortField === 'date' ? 'active' : ''}" onclick="app.setSortField('date')">📅 时间</button>
            <button class="sort-btn ${sortField === 'val_acc' ? 'active' : ''}" onclick="app.setSortField('val_acc')">📈 验证精度</button>
            <button class="sort-btn ${sortField === 'test_acc' ? 'active' : ''}" onclick="app.setSortField('test_acc')">🎯 测试精度</button>
            <button class="sort-btn ${sortField === 'name' ? 'active' : ''}" onclick="app.setSortField('name')">🔤 名称</button>
            <button class="sort-btn" onclick="app.toggleSortOrder()">
                ${sortOrder === 'desc' ? '↓ 降序' : '↑ 升序'}
            </button>
        `;
    }

    // ==================== Batch Bar ====================
    renderBatchBar(selectedCount, totalCount) {
        this.elements.batchBar.className = `batch-bar ${selectedCount > 0 ? 'active' : ''}`;
        this.elements.batchBar.innerHTML = selectedCount > 0 ? `
            <div class="batch-info">
                <span class="batch-count">${selectedCount}</span>
                <span>已选择 (共${totalCount}个)</span>
            </div>
            <div class="batch-actions">
                <button class="btn btn-primary" onclick="app.showBatchTagModal()">🏷️ 批量打标签</button>
                <button class="btn btn-primary" onclick="app.exportSelected()">📦 批量导出</button>
                <button class="btn btn-outline" onclick="app.selectAllExperiments()">☑️ 全选</button>
                <button class="btn btn-outline" onclick="app.deselectAllExperiments()">❎ 取消全选</button>
                <button class="btn btn-outline btn-danger" onclick="app.batchDelete()">🗑️ 批量删除</button>
            </div>
        ` : '';
    }

    // ==================== Experiment Detail ====================
    renderExperimentPage(experimentId) {
        const exp = Data.getExperimentById(experimentId);
        if (!exp) return;

        const hasTest = exp.testResults && exp.testResults.length > 0;
        const hasLog = !!exp.trainingLog;

        this.elements.experimentTitle.textContent = exp.name;

        // Tab 状态
        document.querySelectorAll('.tab').forEach(tab => {
            const tabName = tab.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
            if (tabName === 'test' && !hasTest) tab.classList.add('disabled');
            else if (tabName === 'log' && !hasLog) tab.classList.add('disabled');
            else tab.classList.remove('disabled');
        });

        // Overview Tab
        let overviewHtml = `
            <div class="param-section">
                <div class="param-header">
                    <h3 class="param-title">📝 实验描述</h3>
                </div>
                <div class="input-group">
                    <textarea id="exp-description" class="code-textarea" style="min-height: 80px;"
                        onchange="app.updateExpDesc('${experimentId}')">${exp.description || ''}</textarea>
                </div>
            </div>
            <div class="param-section">
                <div class="param-header">
                    <h3 class="param-title">⚙️ 超参数</h3>
                    <button class="btn btn-outline" onclick="app.addParam('${experimentId}')">＋ 添加参数</button>
                </div>
                <div class="param-grid" id="hyperparams-list">
                    ${this.renderHyperParams(experimentId, exp.hyperParams || [])}
                </div>
            </div>
            <div class="param-section">
                <div class="param-header">
                    <h3 class="param-title">📊 测试结果</h3>
                    ${hasTest ? `<button class="btn btn-outline" onclick="app.reUploadTest('${experimentId}')">🔄 重新上传</button>` : ''}
                </div>
                ${hasTest ? `
                    <div class="test-summary" style="font-size: 1rem; flex-wrap: wrap;">
                        ${exp.testResults.map((r, i) => `
                            <span class="test-metric" style="background: var(--card-bg); border: 1px solid var(--border); padding: 8px 12px; border-radius: 8px; position: relative;">
                                <span class="test-metric-name">${r.metric}</span>
                                <span class="test-metric-value">${r.value}</span>
                                ${r.notes ? `<span style="font-size: 0.85rem; color: var(--text-secondary); display: block;">${r.notes}</span>` : ''}
                            </span>
                        `).join('')}
                    </div>
                ` : `<p style="color: var(--text-secondary);">使用 CSV 上传器导入测试结果</p>`}
            </div>

            <div class="param-section">
                <div class="param-header">
                    <h3 class="param-title">📎 配置文件</h3>
                    <button class="btn btn-outline" onclick="app.uploadConfig('${experimentId}')">📄 上传配置</button>
                </div>
                ${exp.config ? `
                    <pre class="config-preview">${exp.config}</pre>
                ` : `<p style="color: var(--text-secondary);">点击"上传配置"导入训练脚本或配置文件</p>`}
            </div>
        `;
        this.elements.overviewTab.innerHTML = overviewHtml;

        // Log Tab
        if (hasLog) {
            const log = exp.trainingLog;
            const columns = log.columns || [];
            const rows = log.rows || [];
            const lastRow = rows.length > 0 ? rows[rows.length - 1] : [];

            this.elements.logHead.innerHTML = columns.map((c, i) => {
                return `<th contenteditable="true" onblur="app.editColumn('${experimentId}', ${i}, this.innerText)">${c}</th>`;
            }).join('');

            const start = Math.max(0, rows.length - 20);
            this.elements.logBody.innerHTML = rows.slice(start).map(row => {
                return '<tr>' + row.map(v => `<td>${v}</td>`).join('') + '</tr>';
            }).join('');

            this.elements.logFooter.innerHTML = `
                <span>共 ${rows.length} 条</span>
                ${rows.length > 20 ? `<span style="color: var(--text-secondary);">（仅显示最后20条）</span>` : ''}
            `;
        } else {
            this.elements.logHead.innerHTML = '';
            this.elements.logBody.innerHTML = '<tr><td colspan="99" style="text-align: center; color: var(--text-secondary); padding: 20px;">使用下方 CSV 上传器导入训练日志</td></tr>';
            this.elements.logFooter.innerHTML = '';
        }

        // Test Tab
        if (hasTest) {
            this.elements.testTable.innerHTML = `
                <table id="test-table">
                    <thead>
                        <tr>
                            <th>指标</th>
                            <th>值</th>
                            <th>备注</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exp.testResults.map((r, i) => `
                            <tr>
                                <td><input class="inline-edit" value="${r.metric}" onchange="app.editTestResult('${experimentId}', ${i}, 'metric', this.value)" /></td>
                                <td><input class="inline-edit" value="${r.value}" onchange="app.editTestResult('${experimentId}', ${i}, 'val', this.value)" /></td>
                                <td><input class="inline-edit" value="${r.notes || ''}" onchange="app.editTestResult('${experimentId}', ${i}, 'notes', this.value)" /></td>
                                <td>
                                    <button class="btn btn-icon btn-danger" onclick="app.deleteTestResult('${experimentId}', ${i})">✕</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="search-bar" style="margin-top: 10px;">
                    <button class="btn btn-outline" onclick="app.addTestResult('${experimentId}')">＋ 添加结果</button>
                    <button class="btn btn-outline" onclick="app.reUploadTest('${experimentId}')">🔄 重新上传</button>
                </div>
            `;
        } else {
            this.elements.testTable.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <p>暂无测试结果</p>
                    <button class="btn btn-primary" onclick="app.addTestResult('${experimentId}')">＋ 手动添加</button>
                </div>
            `;
        }

        // CSV Uploaders
        this.elements.logUploader.innerHTML = `
            <input type="file" id="log-csv-file" accept=".csv" onchange="app.handleLogUpload(event, '${experimentId}')" style="display:none">
            <div class="csv-dropzone" onclick="document.getElementById('log-csv-file').click()">
                <div class="csv-icon">📄</div>
                <h3>拖拽训练日志 CSV 到此处</h3>
                <p>或点击选择文件</p>
            </div>
        `;
        this.elements.testUploader.innerHTML = `
            <input type="file" id="test-csv-file" accept=".csv" onchange="app.handleTestUpload(event, '${experimentId}')" style="display:none">
            <div class="csv-dropzone" onclick="document.getElementById('test-csv-file').click()">
                <div class="csv-icon">📄</div>
                <h3>拖拽测试结果 CSV 到此处</h3>
                <p>或点击选择文件</p>
            </div>
        `;

        // Default tab
        this.switchTab('overview', experimentId);
    }

    renderHyperParams(experimentId, params) {
        if (!params || params.length === 0) {
            return '<p style="color: var(--text-secondary);">暂无超参数，点击"＋ 添加参数"开始</p>';
        }
        return params.map(p => `
            <div class="param-item">
                <label class="param-key" contenteditable="true" onblur="app.updateParamKey('${experimentId}', '${p.key}', this.innerText)">${p.key}</label>
                <input class="param-value" value="${p.value}" onchange="app.updateParamValue('${experimentId}', '${p.key}', this.value)" />
                <button class="btn btn-icon btn-danger" onclick="app.deleteParam('${experimentId}', '${p.key}')">✕</button>
            </div>
        `).join('');
    }

    updateHyperParams(experimentId, params) {
        const container = document.getElementById('hyperparams-list');
        if (container) {
            container.innerHTML = this.renderHyperParams(experimentId, params);
        }
    }

    // ==================== Charts ====================
    renderCharts(experimentId) {
        const exp = Data.getExperimentById(experimentId);
        if (!exp || !exp.trainingLog) {
            this.elements.chartContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">上传训练日志后生成图表</p>';
            return;
        }

        const log = exp.trainingLog;
        const columns = log.columns || [];
        const rows = log.rows || [];

        if (rows.length === 0) return;

        this.elements.chartContainer.innerHTML = `
            <div class="chart-row">
                <div class="chart-box"><div class="chart-title">📉 损失曲线</div><canvas id="chart-loss"></canvas></div>
                <div class="chart-box"><div class="chart-title">📈 精度曲线</div><canvas id="chart-acc"></canvas></div>
            </div>
        `;

        requestAnimationFrame(() => {
            const xs = rows.map((_, i) => i + 1);
            const commonOpts = {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: { x: { title: { display: true, text: 'Epoch' } } }
            };

            // Loss chart
            const lossCtx = document.getElementById('chart-loss');
            if (lossCtx) {
                const lossDatasets = [];
                columns.forEach((col, i) => {
                    if (i === 0) return;
                    const lk = col.toLowerCase();
                    if (lk.includes('loss')) {
                        lossDatasets.push({
                            label: col, data: rows.map(r => parseFloat(r[i])),
                            borderColor: this.getChartColor(lossDatasets.length),
                            borderWidth: 2, fill: false, tension: 0.3, pointRadius: 1
                        });
                    }
                });
                if (lossDatasets.length > 0) {
                    new Chart(lossCtx, {
                        type: 'line',
                        data: { labels: xs, datasets: lossDatasets },
                        options: { ...commonOpts, scales: { ...commonOpts.scales, y: { title: { display: true, text: 'Loss' }, beginAtZero: false } } }
                    });
                }
            }

            // Acc chart
            const accCtx = document.getElementById('chart-acc');
            if (accCtx) {
                const accDatasets = [];
                columns.forEach((col, i) => {
                    if (i === 0) return;
                    const lk = col.toLowerCase();
                    if (lk.includes('acc') || lk.includes('accuracy') || lk.includes('f1') || lk.includes('mae')) {
                        accDatasets.push({
                            label: col, data: rows.map(r => parseFloat(r[i])),
                            borderColor: this.getChartColor(accDatasets.length),
                            borderWidth: 2, fill: false, tension: 0.3, pointRadius: 1
                        });
                    }
                });
                if (accDatasets.length > 0) {
                    new Chart(accCtx, {
                        type: 'line',
                        data: { labels: xs, datasets: accDatasets },
                        options: { ...commonOpts, scales: { ...commonOpts.scales, y: { title: { display: true, text: 'Value' }, beginAtZero: false } } }
                    });
                }
            }
        });
    }

    getChartColor(index) {
        const colors = ['#6c5ce7', '#00b894', '#e17055', '#fdcb6e', '#0984e3', '#e84393', '#00cec9', '#636e72'];
        return colors[index % colors.length];
    }

    // ==================== Modals ====================
    showAddModelModal() {
        this.showModal(`
            <h3 class="modal-title">创建新项目</h3>
            <div class="input-group">
                <label class="input-label">项目名称</label>
                <input type="text" id="new-model-name" class="form-input" placeholder="例: ResNet-50 图像分类">
            </div>
            <div class="input-group">
                <label class="input-label">项目描述</label>
                <textarea id="new-model-desc" class="form-input code-textarea" placeholder="项目背景、目标等等"></textarea>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="app.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="app.addModel()">创建</button>
            </div>
        `);
        setTimeout(() => document.getElementById('new-model-name')?.focus(), 100);
    }

    showAddExperimentModal() {
        this.showModal(`
            <h3 class="modal-title">添加新实验</h3>
            <div class="input-group">
                <label class="input-label">实验名称</label>
                <input type="text" id="new-exp-name" class="form-input" placeholder="例: 使用CosineAnnealing调度器">
            </div>
            <div class="input-group">
                <label class="input-label">实验描述</label>
                <textarea id="new-exp-desc" class="form-input code-textarea" placeholder="简述实验目的"></textarea>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="app.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="app.addExperiment()">创建</button>
            </div>
        `);
        setTimeout(() => document.getElementById('new-exp-name')?.focus(), 100);
    }

    showBatchTagModal(allTags) {
        this.showModal(`
            <h3 class="modal-title">批量打标签</h3>
            <div class="input-group">
                <label class="input-label">选择或输入标签</label>
                <div class="tag-select-grid">
                    ${allTags.map(t => `
                        <button class="filter-tag" onclick="this.classList.toggle('active'); document.getElementById('batch-tag-input').value = this.dataset.tag;" data-tag="${t}">
                            ${this.getTagIcon(t)} ${t}
                        </button>
                    `).join('')}
                </div>
                <input type="text" id="batch-tag-input" class="form-input" placeholder="选择上方标签或自定义">
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="app.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="app.batchApplyTag()">应用</button>
            </div>
        `);
    }

    showSettingsModal(models, experiments) {
        const modelCount = Object.keys(models).length;
        const expCount = Object.keys(experiments).length;
        const dataSize = new Blob([JSON.stringify({models, experiments})]).size;
        const sizeStr = dataSize > 1024 * 1024
            ? (dataSize / 1024 / 1024).toFixed(2) + ' MB'
            : (dataSize / 1024).toFixed(1) + ' KB';

        this.showModal(`
            <h3 class="modal-title">⚙️ 数据管理</h3>
            <div class="param-section">
                <p>📊 <strong>${modelCount}</strong> 个项目, <strong>${expCount}</strong> 个实验</p>
                <p>💾 数据大小: <strong>${sizeStr}</strong></p>
                <p style="font-size: 0.9rem; color: var(--text-secondary);">数据存储在浏览器 localStorage 中，清除浏览器数据会丢失。建议定期导出备份。</p>
            </div>
            <div class="search-bar" style="margin-top: 15px;">
                <button class="btn btn-primary" onclick="app.exportAll()">📦 导出全部数据</button>
                <button class="btn btn-outline" onclick="app.triggerImport()">📥 导入数据文件</button>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="app.closeModal()">关闭</button>
            </div>
        `);
    }

    showModal(content) {
        this.elements.modalContent.innerHTML = content;
        this.elements.modalOverlay.classList.add('active');
    }

    hideModal() {
        this.elements.modalOverlay.classList.remove('active');
    }

    // ==================== Toast ====================
    showToast(message, type = 'success') {
        this.elements.toast.className = `toast ${type}`;
        this.elements.toast.querySelector('#toast-message').textContent = message;
        this.elements.toast.classList.add('show');
        setTimeout(() => this.elements.toast.classList.remove('show'), 3000);
    }
}

const UI = new TrackerUI();
