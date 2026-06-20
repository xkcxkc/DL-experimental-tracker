# DL Experiment Tracker

一个用于管理深度学习实验记录的轻量级 Web 工具。项目包含静态前端、Node.js API 服务和 Nginx 反向代理配置，支持按模型/项目组织实验、导入训练日志和测试结果 CSV、查看曲线图、管理标签，并将数据持久化到服务器端 JSON 文件。

## 功能特性

- 项目与实验管理：创建模型项目、添加实验、重命名、删除和批量管理实验。
- 实验数据记录：维护实验描述、日期、标签、超参数、训练日志和测试结果。
- CSV 导入：支持训练日志 CSV、测试结果 CSV，以及本工具导出的实验 CSV 再导入。
- 图表展示：基于 Chart.js 展示 loss、accuracy 等训练曲线。
- 标签与排序：按标签筛选实验，按时间、验证精度、测试精度或名称排序。
- 数据导入导出：支持导出单个实验 CSV、批量导出实验 CSV、导出/导入全部 JSON 数据。
- 远程持久化：前端通过 `/api/data` 同步到服务端，服务端写入 `/data/state.json`。

## 技术栈

- 前端：原生 HTML、CSS、JavaScript、Chart.js
- 后端：Node.js、Express
- 部署：Docker Compose、Nginx
- 测试：Node.js 内置测试框架

## 目录结构

```text
.
├── data/
│   └── state.json              # 服务端持久化数据
├── frontend/
│   ├── index.html              # 前端入口
│   ├── app.js                  # 页面逻辑和交互
│   ├── data.js                 # 数据层和远程同步适配
│   ├── parser.js               # CSV 解析器
│   ├── sync.js                 # 前后端同步逻辑
│   └── styles.css              # 样式
├── nginx/
│   ├── default.conf            # 示例 Nginx 配置
│   └── default.conf.template   # Docker 部署使用的 Nginx 模板
├── server/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js               # Express API 服务
├── tests/
│   └── csv-parser.test.js      # CSV 解析器测试
├── .env.example                # 部署环境变量示例
├── docker-compose.yml
└── README.md
```

## 快速开始

### 1. 安装后端依赖

```bash
cd server
npm install
```

### 2. 启动 API 服务

```bash
npm start
```

服务默认监听 `3000` 端口，并读写 `/data/state.json`。如果直接在本机运行后端，需要确保 `/data` 路径可写，或根据需要修改 `server/server.js` 中的 `DATA_FILE`。

### 3. 访问前端

前端是静态文件，入口为 `frontend/index.html`。当前前端默认使用远程模式，会请求相对路径 `/api/data`，因此本地开发时建议使用带 API 代理的静态服务，或使用 Docker/Nginx 统一提供前端和 API。

## Docker 部署

先复制环境变量示例：

```bash
cp .env.example .env
```

然后在 `.env` 中填写自己的域名和证书目录：

```text
TRACKER_DOMAIN=your-domain.example.com
TRACKER_HTTP_PORT=80
TRACKER_HTTPS_PORT=8443
LETSENCRYPT_DIR=/etc/letsencrypt
NGINX_HTPASSWD_FILE=./secrets/.htpasswd
```

创建访问密码文件。这个文件只放在 VPS，不提交到 GitHub：

```bash
mkdir -p secrets
openssl passwd -apr1
```

复制输出的哈希值，写入 `secrets/.htpasswd`，格式如下：

```text
admin:这里替换为openssl输出的哈希值
```

启动服务：

```bash
docker compose up -d --build
```

端口映射：

- `TRACKER_HTTP_PORT`：HTTP 入口，会跳转到 HTTPS
- `TRACKER_HTTPS_PORT`：HTTPS 入口

真实域名不应直接提交到仓库；请只写在本机或 VPS 的 `.env` 文件中。

当前 Nginx 配置默认启用 Basic Auth。没有 `NGINX_HTPASSWD_FILE` 或密码文件不存在时，容器不应正常启动；这是为了避免管理面板意外裸露在公网。

## 紧急加固

如果发现管理面板已经暴露在公网，优先按这个顺序处理：

1. 在 VPS 防火墙上临时关闭入口端口，或只允许你的固定 IP/VPN 网段访问。
2. 创建 `secrets/.htpasswd`，在 `.env` 中配置 `NGINX_HTPASSWD_FILE=./secrets/.htpasswd`。
3. 重新部署容器：`docker compose up -d --build`。
4. 用无痕窗口访问面板，确认浏览器弹出用户名/密码框。
5. 检查 `data/state.json` 是否存在异常数据，必要时从备份恢复。

## 数据存储

后端将完整状态保存到：

```text
/data/state.json
```

在 Docker Compose 中，该路径通过卷映射到仓库的 `data/` 目录：

```yaml
volumes:
  - ./data:/data
```

主要数据集合包括：

- `MODELS`：模型项目
- `EXPERIMENTS`：实验基础信息
- `HYPERPARAMS`：超参数
- `TRAINING_LOGS`：训练日志
- `TEST_RESULTS`：测试结果、预测明细和混淆矩阵
- `TAGS`：标签

前端会把数据暂存到浏览器 `localStorage`，用于刷新前后的本地恢复；远程模式下会继续把更新推送到服务端。测试结果明细可能比较大，因此应以服务端 JSON 文件为准，不应依赖浏览器缓存。

## CSV 导入格式

### 训练日志

训练日志至少需要包含表头和数值行。解析器会自动识别常见字段别名，例如 `epoch`、`train_loss`、`val_loss`、`train_acc`、`val_acc`、`lr` 等。

```csv
epoch,train_loss,train_acc,val_loss,val_acc,learning_rate
1,0.9,60.1,0.8,62.3,0.001
2,0.5,78.4,0.4,80.2,0.001
```

也支持带配置段的 CSV，配置项可使用 `key,value`、`key=value` 或 `key: value` 等形式。

### 测试结果

测试结果支持预测明细、测试摘要和混淆矩阵。只有预测明细时，系统会尝试自动计算测试准确率和混淆矩阵。

```csv
file_path,actual_label,predict_label,confidence
/data/test/0/a.png,0,0,0.95
/data/test/0/b.png,0,1,0.88
/data/test/1/c.png,1,1,0.91

Test Summary
Test ACC,66.67%
Test Loss,0.1234

Confusion Matrix
actual/predict,0,1
0,1,1
1,0,1
```

## API 接口

### 健康检查

```http
GET /api/health
```

返回：

```json
{ "status": "ok" }
```

### 全量数据

```http
GET /api/data
POST /api/data
```

`GET` 返回完整状态，`POST` 用请求体覆盖保存完整状态。

### 单实体 CRUD

```http
GET    /api/data/:entity
POST   /api/data/:entity
PUT    /api/data/:entity/:id
DELETE /api/data/:entity/:id
```

允许的 `entity`：

```text
MODELS
EXPERIMENTS
HYPERPARAMS
TRAINING_LOGS
TEST_RESULTS
TAGS
```

## 架构判断

当前架构适合个人或小团队低频使用：前端面板通过 Nginx 访问，后端 API 写入 VPS 本地 JSON 文件，部署简单、成本低、备份也直观。

它的边界也很明确：

- 适合：个人实验记录、内网/VPN/受保护入口访问、数据量不大、并发编辑很少。
- 不适合：多人同时频繁编辑、预测明细长期快速增长、需要审计日志、权限系统、复杂查询或高可靠备份。

如果只是你自己使用，VPS 本地 JSON 文件可以继续用，但建议定期备份 `data/state.json`。如果后续数据明显变大或多人使用，再迁移到数据库更稳妥。

可选升级路线：

- SQLite：最适合下一步升级，仍然部署在 VPS 上，结构化、可靠、维护成本低。
- Postgres：适合多人协作、复杂查询和更长期的数据管理。
- Upstash Redis：适合轻量键值状态或缓存，不是实验记录这种结构化长期数据的首选。
- 对象存储：适合保存很大的原始 CSV、图片或模型文件，JSON/数据库只保存索引和摘要。

## 测试

```bash
node --test tests/csv-parser.test.js
```

## 开发注意事项

- `frontend/data.js` 当前会始终启用远程模式，请确保访问前端时 `/api/data` 能正确代理到后端。
- `server/server.js` 使用排队式写入，避免并发保存时互相覆盖。
- `nginx/default.conf.template` 通过 `.env` 注入域名和 HTTPS 端口，不要把真实域名提交到仓库。
- 部分现有源码注释可能存在编码显示异常，修改相关文件时建议统一使用 UTF-8。
