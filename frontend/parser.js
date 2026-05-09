// ============================================================
// CSV Parser - Training Log & Test Result intelligent parsing
// ============================================================

const CSVParser = {
    
    // ==================== Common Utilities ====================
    
    // Clean BOM, normalize line endings, remove extra blank lines
    preprocess(text) {
        // Remove BOM
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.slice(1);
        }
        // Normalize line endings
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        return text;
    },

    // Split CSV line respecting quoted fields
    splitCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                // Handle escaped quotes ""
                if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++; // skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    },

    // Try to parse a number, return original string if not possible
    tryParseNumber(val) {
        if (val === '' || val === null || val === undefined) return val;
        const trimmed = val.toString().trim();
        // Remove % sign
        const cleaned = trimmed.replace(/%$/, '');
        const num = parseFloat(cleaned);
        if (!isNaN(num) && isFinite(num)) return num;
        return val;
    },

    // Strip # prefixes from a line (for commented config lines)
    stripComment(line) {
        return line.replace(/^#+\s*/, '');
    },

    // Check if a line is a separator line like "========..."
    isSeparator(line) {
        return /^={3,}/.test(line.trim());
    },

    // Check if a line is effectively empty (all commas / whitespace)
    isEmptyLike(line) {
        return /^[,\s]*$/.test(line);
    },

    // ==================== Column Name Standardization ====================
    
    // Comprehensive column name mapping
    _columnAliases: null,
    _getColumnAliases() {
        if (this._columnAliases) return this._columnAliases;
        this._columnAliases = {
            // epoch / step
            'epoch':           'epoch',
            'epochs':          'epoch',
            'step':            'epoch',
            'steps':           'epoch',
            'iteration':       'epoch',
            'iterations':      'epoch',
            'iter':            'epoch',
            'global_step':     'epoch',

            // train loss
            'train_loss':       'train_loss',
            'trainloss':        'train_loss',
            'training_loss':    'train_loss',
            'trainingloss':     'train_loss',
            'tl':               'train_loss',
            'loss':             'train_loss',  // when no val_loss exists, loss = train

            // val loss
            'val_loss':         'val_loss',
            'valloss':          'val_loss',
            'validation_loss':  'val_loss',
            'validationloss':   'val_loss',
            'valid_loss':       'val_loss',
            'vl':               'val_loss',
            'eval_loss':        'val_loss',

            // train acc
            'train_acc':               'train_acc',
            'trainacc':                'train_acc',
            'training_acc':            'train_acc',
            'trainingacc':             'train_acc',
            'train_accuracy':          'train_acc',
            'training_accuracy':       'train_acc',
            'trainacc(%)':             'train_acc',
            'train_acc(%)':            'train_acc',
            'train_accuracy(%)':       'train_acc',
            'ta':                      'train_acc',

            // val acc
            'val_acc':                 'val_acc',
            'valacc':                  'val_acc',
            'validation_acc':          'val_acc',
            'validationacc':           'val_acc',
            'valid_acc':               'val_acc',
            'val_accuracy':            'val_acc',
            'validation_accuracy':     'val_acc',
            'valacc(%)':               'val_acc',
            'val_acc(%)':              'val_acc',
            'val_accuracy(%)':         'val_acc',
            'accuracy':                'val_acc',
            'acc':                     'val_acc',
            'test_acc':                'val_acc',
            'test_accuracy':           'val_acc',
            'va':                      'val_acc',

            // learning rate
            'lr':                      'lr',
            'learning_rate':           'lr',
            'learningrate':            'lr',
            'learning rate':           'lr',
            'current_lr':              'lr',
            'current learning rate':   'lr',
            'learn_rate':              'lr',

            // epoch time
            'epoch_time(s)':    'epoch_time',
            'epoch_time':       'epoch_time',
            'epochtime':        'epoch_time',
            'epoch time (s)':   'epoch_time',
            'epoch time':       'epoch_time',
            'time':             'epoch_time',
            'duration':         'epoch_time',

            // Various loss components (from knowledge distillation etc.)
            'train_ce_loss':     'train_ce_loss',
            'train_kd_loss':     'train_kd_loss',
            'train_logits_loss': 'train_logits_loss',
            'train_focus_loss':  'train_focus_loss',
            'train_cap_loss':    'train_cap_loss',
        };
        return this._columnAliases;
    },

    standardizeColumn(col) {
        const lower = col.toLowerCase().trim()
            .replace(/\s*\(\s*/g, '(')   // normalize parens (remove spaces around them)
            .replace(/\s*\)\s*/g, ')')
            .replace(/\s+/g, '_');       // spaces to underscores
        
        const aliases = this._getColumnAliases();
        
        // Direct match
        if (aliases[lower] !== undefined) return aliases[lower];

        // Try without percentage parens: "train_acc(%)" -> "train_acc"
        const withoutPct = lower.replace(/\(%?\)/g, '').replace(/_?%?$/, '');
        if (aliases[withoutPct] !== undefined) return aliases[withoutPct];

        // Try replacing spaces with underscores
        const spaceNorm = col.toLowerCase().trim().replace(/\s+/g, '_');
        if (aliases[spaceNorm] !== undefined) return aliases[spaceNorm];

        // Fallback: use regex-based matching
        // epoch
        if (/^(epoch|step|iter)/i.test(col)) return 'epoch';

        // train loss
        if (/train.*loss/i.test(col) && !/val|valid/i.test(col)) return 'train_loss';

        // val loss
        if (/(val|valid|eval).*loss/i.test(col)) return 'val_loss';

        // train acc
        if (/train.*acc/i.test(col) && !/val|valid/i.test(col)) return 'train_acc';

        // val acc
        if (/(val|valid|test).*acc/i.test(col)) return 'val_acc';

        // lr
        if (/^(lr|learning.?rate|current.?lr)/i.test(col) && !/loss|layer/i.test(col)) return 'lr';

        // epoch time
        if (/epoch.*time|time.*epoch|^time$/i.test(col)) return 'epoch_time';

        return col.trim();
    },

    // ==================== Config Parsing Multi-Strategy ====================
    
    /**
     * Parse a single config line. Returns { key, value } or null.
     * Supports:
     *   - # key,value  (comment style, with or without #)
     *   - key,value    (plain CSV)
     *   - key=value    (equals style)
     *   - key: value   (colon style)
     */
    _parseConfigLine(line) {
        let cleaned = line.trim();
        if (!cleaned) return null;

        // Skip separator lines
        if (this.isSeparator(cleaned)) return null;

        // Strip leading # comment markers
        cleaned = this.stripComment(cleaned);
        cleaned = cleaned.trim();

        // Remove trailing commas (from formats with extra empty columns)
        cleaned = cleaned.replace(/,+$/, '').trim();
        if (!cleaned) return null;

        // Strategy 1: equals-separated  key=value or key = value
        const eqMatch = cleaned.match(/^([^=]+?)\s*=\s*(.+)$/);
        if (eqMatch) {
            return { key: eqMatch[1].trim(), value: eqMatch[2].trim() };
        }

        // Strategy 2: colon-separated  key: value or key : value
        const colonMatch = cleaned.match(/^([^:]+?)\s*:\s*(.+)$/);
        if (colonMatch) {
            return { key: colonMatch[1].trim(), value: colonMatch[2].trim() };
        }

        // Strategy 3: comma-separated CSV (first non-empty field as key, second as value)
        const parts = this.splitCSVLine(cleaned);
        const nonEmpty = parts.filter(p => p !== '');
        if (nonEmpty.length >= 2) {
            return { key: nonEmpty[0].trim(), value: nonEmpty[1].trim() };
        }

        // Strategy 4: single key=value with no comma but has equals (already covered above)
        return null;
    },

    // ==================== Section Detection ====================

    /**
     * Detect if a line is the start of a config section header
     * e.g. "======== 训练配置 ========" or "======== 训练数据 ========"
     */
    _isConfigHeader(line) {
        return this.isSeparator(line) && /训练配置|配置|config|hyper.?param/i.test(line);
    },

    _isTrainingDataHeader(line) {
        return this.isSeparator(line) && /训练数据|数据|train.*data|data/i.test(line);
    },

    /**
     * Detect if a line looks like a CSV column header (contains letters in most fields)
     */
    _isLikelyHeader(line) {
        const fields = this.splitCSVLine(line);
        // Remove trailing empty fields caused by extra commas
        while (fields.length > 0 && fields[fields.length - 1] === '') fields.pop();
        if (fields.length < 2) return false;

        const alphaCount = fields.filter(f => /[a-zA-Z\u4e00-\u9fa5]/.test(f)).length;
        // At least half the fields (or at least 2) should contain letter characters
        return alphaCount >= Math.max(2, fields.length * 0.4);
    },

    /**
     * Detect if a line looks like training data (numeric content).
     * Returns a score 0-1 of how "numeric" the line is.
     */
    _numericScore(line) {
        const fields = this.splitCSVLine(line);
        // Remove trailing empty fields
        while (fields.length > 0 && fields[fields.length - 1] === '') fields.pop();
        if (fields.length < 2) return 0;

        let numericCount = 0;
        for (const f of fields) {
            if (f === '') continue;
            const num = parseFloat(f);
            if (!isNaN(num) && isFinite(num)) numericCount++;
        }
        const nonEmpty = fields.filter(f => f !== '').length;
        return nonEmpty > 0 ? numericCount / nonEmpty : 0;
    },

    // ==================== Training Log Parser ====================
    
    parseTrainingLog(text) {
        text = this.preprocess(text);
        const lines = text.split('\n').filter(l => !this.isEmptyLike(l));
        
        if (lines.length === 0) {
            return { success: false, error: '文件为空' };
        }

        // ---- Phase 1: Detect sections ----
        // Look for explicit section separators (========)
        let configHeaderIdx = -1;
        let dataHeaderIdx = -1;

        for (let i = 0; i < lines.length; i++) {
            if (this._isConfigHeader(lines[i])) configHeaderIdx = i;
            if (this._isTrainingDataHeader(lines[i])) dataHeaderIdx = i;
        }

        let configLines = [];
        let dataLines = [];
        let headerLine = null;
        let warnings = [];

        // ---- Case A: Both section headers found ----
        if (configHeaderIdx >= 0 && dataHeaderIdx >= 0 && dataHeaderIdx > configHeaderIdx) {
            configLines = lines.slice(configHeaderIdx + 1, dataHeaderIdx);
            dataLines = lines.slice(dataHeaderIdx + 1);
        }
        // ---- Case B: Only data header found (config might use # prefix without ===) ----
        else if (dataHeaderIdx >= 0) {
            dataLines = lines.slice(dataHeaderIdx + 1);
            // Config is everything before data header that's NOT a data-looking line
            configLines = lines.slice(0, dataHeaderIdx);
        }
        // ---- Case C: Only config header found ----
        else if (configHeaderIdx >= 0) {
            configLines = lines.slice(configHeaderIdx + 1);
        }
        // ---- Case D: No section headers at all ----
        else {
            // Need to intelligently split config from data
            configLines = [];
            dataLines = [];
            // Scan lines for transition point
            for (let i = 0; i < lines.length; i++) {
                const score = this._numericScore(lines[i]);
                const hasHash = lines[i].trim().startsWith('#');
                const isSep = this.isSeparator(lines[i]);
                
                if (score >= 0.5 && !hasHash && !isSep) {
                    // This looks like data – everything before this candidate
                    // Check if previous line is a header
                    if (i > 0 && this._isLikelyHeader(lines[i - 1])) {
                        configLines = lines.slice(0, i - 1);
                        headerLine = lines[i - 1];
                        dataLines = lines.slice(i);
                    } else {
                        configLines = lines.slice(0, i);
                        dataLines = lines.slice(i);
                    }
                    break;
                }
                // Also check for commented-out config
                if (hasHash && this._parseConfigLine(this.stripComment(lines[i]))) {
                    configLines.push(lines[i]);
                }
            }
            // If still no data lines found, treat everything as data
            if (dataLines.length === 0) {
                configLines = [];
                dataLines = lines;
            }
        }

        // ---- Phase 2: Parse config section ----
        const hyperParams = this._parseConfigSection(configLines);

        // ---- Phase 3: Parse data section ----
        // Filter out separators and config-like lines from data section
        dataLines = dataLines.filter(l => {
            const trimmed = l.trim();
            if (!trimmed) return false;
            if (this.isSeparator(trimmed) && /\u8bad\u7ec3\u914d\u7f6e|config/i.test(trimmed)) return false;
            return true;
        });

        const dataResult = this._parseDataSection(dataLines, headerLine);
        
        if (!dataResult.success) {
            return {
                success: false,
                error: dataResult.error,
                hyperParams,
                rawPreview: lines.slice(0, 15).join('\n')
            };
        }

        // ---- Phase 4: Calculate summary ----
        const summary = this._calculateTrainingSummary(dataResult.epochs, dataResult.columns);

        return {
            success: true,
            hyperParams,
            columns: dataResult.columns,
            epochs: dataResult.epochs,
            ...summary,
            warnings: dataResult.warnings || [],
            rawPreview: lines.slice(0, 15).join('\n')
        };
    },

    // ==================== Config Section Parser (reworked) ====================

    _parseConfigSection(lines) {
        const params = {};
        const seen = new Set();
        
        for (const line of lines) {
            // Skip pure separator lines
            if (this.isSeparator(line) && this.isEmptyLike(this.stripComment(line).replace(/=/g, ''))) continue;
            
            // Try to parse config line with multi-strategy
            const result = this._parseConfigLine(line);
            if (!result) continue;

            let { key, value } = result;

            // Clean up key: lowercase, spaces to underscores
            let normalizedKey = key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            if (!normalizedKey) continue;

            // Deduplicate
            if (seen.has(normalizedKey)) continue;
            seen.add(normalizedKey);

            // Parse value
            let parsedValue = this.tryParseNumber(value);

            // Handle quoted values like "['stage1', 'stage2', 'stage3']"
            if (typeof parsedValue === 'string') {
                parsedValue = parsedValue.replace(/^["']|["']$/g, '');
            }

            params[normalizedKey] = parsedValue;
        }

        return params;
    },

    // ==================== Data Section Parser (reworked) ====================

    _parseDataSection(lines, preDetectedHeader) {
        if (lines.length === 0) {
            return { success: false, error: '未找到训练数据区' };
        }

        // Find the header line
        let headerIdx = -1;
        let headerLine = null;

        // If we pre-detected a header line, check if it's in dataLines
        if (preDetectedHeader) {
            const idx = lines.indexOf(preDetectedHeader);
            if (idx >= 0) {
                headerIdx = idx;
                headerLine = preDetectedHeader;
            }
        }

        // Otherwise, auto-detect header from the first few lines
        if (headerIdx < 0) {
            // First pass: look for lines with alphanumeric content
            for (let i = 0; i < Math.min(5, lines.length); i++) {
                if (this._isLikelyHeader(lines[i])) {
                    // Verify the next line is numeric-heavy (confirms this is header, not config)
                    if (i + 1 < lines.length && this._numericScore(lines[i + 1]) >= 0.5) {
                        headerIdx = i;
                        headerLine = lines[i];
                        break;
                    }
                }
            }
        }

        // Fallback: if no clear header found, check if first line is a header or data
        if (headerIdx < 0) {
            if (this._numericScore(lines[0]) < 0.5) {
                // First line is probably a header
                headerIdx = 0;
                headerLine = lines[0];
            } else {
                // First line is data – generate synthetic header
                const fieldCount = this.splitCSVLine(lines[0])
                    .filter(f => f !== '').length;
                const syntheticHeaders = [];
                for (let i = 0; i < fieldCount; i++) {
                    syntheticHeaders.push(i === 0 ? 'epoch' : `col_${i}`);
                }
                headerLine = syntheticHeaders.join(',');
                headerIdx = -2; // special marker: synthetic header
            }
        }

        // Parse header columns
        let columns;
        if (headerIdx === -2) {
            // Synthetic
            columns = headerLine.split(',').map(f => f.trim());
        } else {
            const rawColumns = this.splitCSVLine(headerLine);
            // Remove trailing empty columns
            while (rawColumns.length > 0 && rawColumns[rawColumns.length - 1] === '') rawColumns.pop();
            columns = rawColumns.map(f => this.standardizeColumn(f));
        }

        // Parse data rows
        const dataLines = (headerIdx >= 0) ? lines.slice(headerIdx + 1) : lines;
        const epochs = [];
        const warnings = [];

        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i].trim();
            if (!line) continue;
            // Skip separator lines that might appear inside data
            if (this.isSeparator(line) && /(配置|config)/i.test(line)) continue;
            if (this.isSeparator(line)) continue;
            
            // Skip lines that look like config (e.g., leftover # lines)
            if (/^#\s/.test(line)) continue;

            const fields = this.splitCSVLine(line);
            // Remove trailing empty fields
            while (fields.length > 0 && fields[fields.length - 1] === '') fields.pop();
            
            if (fields.length < 2) continue;

            // Quick check: should be mostly numeric
            const score = this._numericScore(line);
            if (score < 0.3) {
                warnings.push(`跳过非数据行: ${line.substring(0, 60)}`);
                continue;
            }

            const row = {};
            columns.forEach((col, idx) => {
                row[col] = idx < fields.length ? this.tryParseNumber(fields[idx]) : null;
            });

            epochs.push(row);
        }

        if (epochs.length === 0) {
            return { success: false, error: '未能解析出有效的训练数据行' };
        }

        return { success: true, columns, epochs, warnings };
    },

    // ==================== Summary Calculation ====================

    _calculateTrainingSummary(epochs, columns) {
        let bestValAcc = -Infinity;
        let bestEpoch = 0;
        
        const hasValAcc = columns.includes('val_acc');
        const hasEpoch = columns.includes('epoch');

        epochs.forEach(row => {
            if (hasValAcc && row.val_acc !== null && row.val_acc !== undefined) {
                const val = parseFloat(row.val_acc);
                if (!isNaN(val) && val > bestValAcc) {
                    bestValAcc = val;
                    bestEpoch = hasEpoch ? (parseInt(row.epoch) || 0) : 0;
                }
            }
        });

        const totalEpochs = epochs.length;

        return {
            bestValAcc: bestValAcc > -Infinity ? bestValAcc : null,
            bestEpoch: bestValAcc > -Infinity ? bestEpoch : null,
            totalEpochs
        };
    },

    // ==================== Test Result Parser ====================
    
    parseTestResult(text) {
        text = this.preprocess(text);
        const lines = text.split('\n').filter(l => !this.isEmptyLike(l));
        
        if (lines.length === 0) {
            return { success: false, error: '文件为空' };
        }

        const result = {
            predictions: [],
            summary: {},
            confusionMatrix: null
        };

        // Find sections
        const sections = this._identifyTestSections(lines);

        // Parse predictions
        if (sections.predictions.startIdx >= 0) {
            result.predictions = this._parsePredictions(
                lines.slice(sections.predictions.startIdx, sections.predictions.endIdx)
            );
        }

        // Parse summary
        if (sections.summary.startIdx >= 0) {
            result.summary = this._parseTestSummary(
                lines.slice(sections.summary.startIdx, sections.summary.endIdx)
            );
        } else if (result.predictions.length > 0) {
            // Calculate summary from predictions
            result.summary = this._calculateSummaryFromPredictions(result.predictions);
        }

        // Parse confusion matrix
        if (sections.matrix.startIdx >= 0) {
            result.confusionMatrix = this._parseConfusionMatrix(
                lines.slice(sections.matrix.startIdx, sections.matrix.endIdx)
            );
        }

        return {
            success: true,
            ...result,
            rawPreview: lines.slice(0, 15).join('\n')
        };
    },

    _identifyTestSections(lines) {
        const sections = {
            predictions: { startIdx: -1, endIdx: -1 },
            summary: { startIdx: -1, endIdx: -1 },
            matrix: { startIdx: -1, endIdx: -1 }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim().toLowerCase();
            
            if (/test\s*summary|汇总|summary/i.test(lines[i])) {
                if (sections.predictions.startIdx >= 0 && sections.predictions.endIdx < 0) {
                    sections.predictions.endIdx = i;
                }
                sections.summary.startIdx = i + 1;
            } else if (/confusion\s*matrix|混淆矩阵/i.test(lines[i])) {
                if (sections.summary.startIdx >= 0 && sections.summary.endIdx < 0) {
                    sections.summary.endIdx = i;
                }
                sections.matrix.startIdx = i + 1;
            } else {
                // Check if this is a prediction header line
                if (i < 5 && /(file[_\s]?path|actual[_\s]?label|predict[_\s]?label|confidence)/i.test(lines[i])) {
                    sections.predictions.startIdx = i;
                }
            }
        }

        // Close last section
        if (sections.predictions.startIdx >= 0 && sections.predictions.endIdx < 0) {
            sections.predictions.endIdx = sections.summary.startIdx >= 0 ? sections.summary.startIdx : lines.length;
        }
        if (sections.summary.startIdx >= 0 && sections.summary.endIdx < 0) {
            sections.summary.endIdx = sections.matrix.startIdx >= 0 ? sections.matrix.startIdx : lines.length;
        }
        if (sections.matrix.startIdx >= 0 && sections.matrix.endIdx < 0) {
            sections.matrix.endIdx = lines.length;
        }

        // If no specific sections found, try to parse entire content as predictions
        if (sections.predictions.startIdx < 0 && sections.summary.startIdx < 0) {
            const firstLine = this.splitCSVLine(lines[0]);
            if (firstLine.some(f => /(file|path|label|predict|conf)/i.test(f))) {
                sections.predictions = { startIdx: 0, endIdx: lines.length };
            }
        }

        return sections;
    },

    _parsePredictions(lines) {
        if (lines.length < 2) return [];

        // Find header
        let headerIdx = 0;
        for (let i = 0; i < Math.min(3, lines.length); i++) {
            if (/(file|path|actual|predict|label|conf)/i.test(lines[i])) {
                headerIdx = i;
                break;
            }
        }

        const headers = this.splitCSVLine(lines[headerIdx]).map(h => h.toLowerCase().trim());

        // Map columns
        const filePathIdx = headers.findIndex(h => /file|path|image|img/i.test(h));
        const actualIdx = headers.findIndex(h => /actual|true|real|ground/i.test(h));
        const predictIdx = headers.findIndex(h => /predict|pred|output/i.test(h));
        const confIdx = headers.findIndex(h => /conf|score|prob/i.test(h));

        const predictions = [];
        for (let i = headerIdx + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const fields = this.splitCSVLine(line);
            if (fields.length < 2) continue;

            predictions.push({
                filePath: filePathIdx >= 0 ? fields[filePathIdx]?.trim() : fields[0]?.trim(),
                actualLabel: actualIdx >= 0 ? fields[actualIdx]?.trim() : fields[1]?.trim(),
                predictLabel: predictIdx >= 0 ? fields[predictIdx]?.trim() : fields[2]?.trim(),
                confidence: confIdx >= 0 ? parseFloat(fields[confIdx]) || 0 : parseFloat(fields[3]) || 0
            });
        }

        return predictions;
    },

    _parseTestSummary(lines) {
        const summary = {};
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || this.isSeparator(trimmed)) continue;

            const result = this._parseConfigLine(trimmed);
            if (!result) continue;

            const key = result.key.toLowerCase().trim();
            const value = result.value.trim().replace(/%$/, '');
            const numValue = parseFloat(value);

            if (/test.*acc|accuracy/i.test(key)) {
                summary.testAcc = isNaN(numValue) ? value : numValue;
            } else if (/map/i.test(key)) {
                summary.mAP = isNaN(numValue) ? value : numValue;
            } else if (/inference|time|latency/i.test(key)) {
                summary.avgInferenceTime = isNaN(numValue) ? value : numValue;
            } else if (/loss/i.test(key)) {
                summary.testLoss = isNaN(numValue) ? value : numValue;
            }
        }

        return summary;
    },

    _calculateSummaryFromPredictions(predictions) {
        if (predictions.length === 0) return {};

        const correct = predictions.filter(p => p.actualLabel === p.predictLabel).length;
        const testAcc = ((correct / predictions.length) * 100).toFixed(2);

        return {
            testAcc: parseFloat(testAcc),
            mAP: null,
            avgInferenceTime: null,
            testLoss: null
        };
    },

    _parseConfusionMatrix(lines) {
        if (lines.length < 2) return null;

        // Find the header line containing labels
        let headerIdx = 0;
        for (let i = 0; i < Math.min(3, lines.length); i++) {
            if (/actual|predict|混淆/i.test(lines[i]) || i === 0) {
                headerIdx = i;
                break;
            }
        }

        const headerFields = this.splitCSVLine(lines[headerIdx]);
        const labels = headerFields.slice(1).map(l => l.trim()).filter(l => l !== '');

        const matrix = [];
        for (let i = headerIdx + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const fields = this.splitCSVLine(line);
            const row = fields.slice(1).map(f => parseInt(f) || 0);
            matrix.push(row);
        }

        if (labels.length === 0 || matrix.length === 0) return null;

        return { labels, matrix };
    }
};
