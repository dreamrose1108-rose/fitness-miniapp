# 卡路喵日记 · ZCode 侧交接说明

> 交接时间：2026-11-20 ｜ 交接方：ZCode（后端架构/Agent/数据层）→ 接手方：WorkBuddy 或任何 AI/开发者
> 本文档与《交接说明-客户端源码与接口契约.md》互补，那篇讲前端契约，这篇讲**后端架构、踩坑记录和协作规则**。

---

## 一、架构总览（为什么不是 wx.cloud）

```
小程序 (wx.request, 90s超时)
   │  POST https://everyday-rose-d0gihszbt1940f4d1-1518355204.ap-shanghai.app.tcloudbase.com/fit-*
   ▼
HTTP 网关（6 条路由，upstreamResourceType=SCF, auth=false）
   │  /fit-login /fit-user /fit-record /fit-food /fit-coach /fit-init
   ▼
云函数（HMAC token 鉴权，wx.login code → code2session → openid）
   │  @cloudbase/manager-node 5.9.3（勿用 v4，无 executePGSql）
   ▼
PostgreSQL（public.fit_* 六张表，EZ 同款 id+data jsonb 模式）
```

**历史原因**：环境是腾讯云个人版 PG-only（无文档数据库），小程序 AppID 与环境授权（-601034）在个人版下走不通，九次尝试后放弃 wx.cloud，改 HTTP 网关直连。**不要再回头试 wx.cloud**。

## 二、关键资源清单

| 资源 | 值 |
|---|---|
| 小程序 AppID | wxf34ff7e4492d44f9（个人主体·邹梦薇） |
| mp 后台登录 | 15720626617@163.com |
| CloudBase 环境 | everyday-rose-d0gihszbt1940f4d1（个人版，注意资源点用量） |
| 网关域名 | `...-1518355204.ap-shanghai.app.tcloudbase.com`（已在 request 合法域名） |
| 云函数目录 | 仓库 `cloudfunctions/` = 部署源（D:\文档\ChatGPT\fitness-backend 为工作副本） |
| 凭证 | 全在云函数环境变量：FIT_TOKEN_SECRET / FIT_WX_APP_SECRET / LLM_API_KEY（智谱 Coding Plan）。**代码里零密钥，保持下去** |

## 三、数据层约定

- 六张表：fit_users / fit_diet_records / fit_exercise_records / fit_body_records / fit_coach_chats / fit_foods（+ 你的 water 等迁移）
- 所有表 `id text PK + data jsonb`；openid 一律存 data 里、服务端强制隔离
- SQL 参数化：`fitdb.js` 的 str()/jsonb()（base64 传输防注入），**禁止字符串拼接用户输入**
- 食物库 267 种含 protein/carb/fat（30 真实值 + 237 按类别估算，macroEst 标记）
- 饮食记录携带 proteinG/carbG/fatG；summary 按 `sum((data->>'proteinG')::numeric)` 聚合

## 四、AI 教练（Agent 架构）

- 智谱 GLM（glm-4.5-air）+ function calling，最多 4 轮工具调用
- 5 个只读工具：今日汇总/近期记录/体重趋势/食物库搜索/用户档案（全部 openid 隔离）
- 输入输出双向 msgSecCheck（REST 版，access_token 模块级缓存）
- 排版约束：提示词明确禁用 Markdown（气泡是纯文本），客户端 fmtContent 兜底清洗
- 返回 `{answer, chunks:[answer], toolsUsed}`，chunks 单元素让打字机自动降级整段显示

## 五、踩坑记录（血泪，务必读）

1. **Git Bash 路径转换**：mcporter 传 `/fit-login` 这类参数会被转成 `C:/Program Files/Git/fit-login`——**网关路径必须走 JSON 参数文件**（`--args "$(cat file.json)"`）
2. **Windows 命令行 8KB 限制**：大 SQL 直接传参会静默截断——**批量插入按 8 行/文件 分批**
3. **DevTools 编译缓存**：改了 js/wxml 模拟器可能跑旧代码——验证前 `cli quit` + 删 `~\AppData\Local\微信开发者工具\User Data\*\Default\.ide` + `cli auto` 全重启
4. **微信原生 button 默认宽 184px**：class 设 width 无效，**内联 style 强压**
5. **record 字段白名单事件**（2026-11-20）：一方加字段、另一方白名单没同步 → 数据静默丢失。**改数据结构时必须同步检查 add 分支的 fields/numeric 白名单**
6. aiCoach 等慢函数：云函数超时 60s、客户端 90s；流式已弃用（Agent 多轮不适合）
7. mcporter 偶发 `transport_retirement_failed`：重试一次即恢复

## 六、协作规则（两个 AI 并行开发的教训）

1. **部署前先拉**：`mcporter call cloudbase.queryFunctions action=getFunctionDownloadUrl` 下载线上版 diff，有分歧先合并（record 事件就是这么发现的）
2. **git 是唯一真相源**：改完即 commit+push，push 前先 pull
3. **改 record.add 时**：fields 白名单 + numeric 校验清单 + 0 值放行清单，三处都要看
4. 云端操作统一走 mcporter（配置在 EZ-ELEMENT/config/mcporter.json，共享设备登录态）

## 七、待办

- [ ] ICP 备案（发布上线前必须）
- [ ] 正式发布前：project.config.json urlCheck 改回 true
- [ ] 照片打卡：wx.cloud.uploadFile 不可用，需 base64 或直传方案
- [ ] 智谱 Key 建议换正式计费（现为 Coding Plan）
- [ ] 资源点监控（个人版 4 万点/月，已出现过按量计费）

## 八、快速验证（接手后第一件事）

```bash
curl -sS -X POST https://everyday-rose-d0gihszbt1940f4d1-1518355204.ap-shanghai.app.tcloudbase.com/fit-init -d '{}'
# 期待 {"code":0,...,"msg":"表结构就绪"}
```

模拟器全流程：开发者工具打开本仓库 → 自动化端口 9420（`cli auto --project . --auto-port 9420`）→ miniprogram-automator 连接（注意 callMethod 不可靠，用 getCurrentPages() 或真实元素 tap）。
