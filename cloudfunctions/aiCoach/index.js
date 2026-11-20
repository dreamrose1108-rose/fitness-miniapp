// 云函数 aiCoach — AI 教练对话（流式增强版，PG 版）
// 安全与合规要点：
//  1. 密钥只存云函数环境变量，绝不下发前端、绝不写死在代码里
//  2. 用户输入与模型输出均经过内容安全检查（msgSecCheck）
//     ——即使流式模式，也是在服务端收齐全文、检查通过后才返回给前端，合规不打折
//  3. 系统提示词内置免责声明：非医疗建议，不替代专业医师/营养师诊断
//  4. 大模型 API 地址/格式为占位模板，须按你实际选用的服务商官方文档核实后替换
//     ——若你的服务商不支持 stream:true，设环境变量 LLM_STREAM=off，自动退回非流式
const cloud = require('wx-server-sdk');
const https = require('https');
const { one, str, jsonb, newId } = require('./fitdb');
cloud.init({ env: 'everyday-rose-d0gihszbt1940f4d1' });

// 环境变量（在云开发控制台 → 云函数 → aiCoach → 配置 中设置）
// 默认已适配智谱 GLM Coding Plan（专属端点 + 套餐内模型，2026-11-17 实测通过）
// 注意：Coding Plan Key 必须走 /api/coding/paas/v4 端点和套餐内模型（glm-4.6/glm-4.5-air/glm-4.5），
//       用普通端点或 glm-4-flash 会报 1309/1113（以智谱官方文档为准）
const LLM_API_HOST = process.env.LLM_API_HOST || 'open.bigmodel.cn';
const LLM_API_PATH = process.env.LLM_API_PATH || '/api/coding/paas/v4/chat/completions';
const LLM_API_KEY = process.env.LLM_API_KEY;        // 智谱 API Key（必填，控制台环境变量注入）
const LLM_MODEL = process.env.LLM_MODEL || 'glm-4.5-air'; // 套餐内轻量模型；可换 glm-4.6
const LLM_STREAM = process.env.LLM_STREAM !== 'off'; // 默认开启流式

const SYSTEM_PROMPT = [
  '你是一名专业的健身与营养顾问，帮助用户制定科学的饮食和运动计划。',
  '回答要求：简洁、可执行、用中文、分点说明。',
  '重要：你提供的建议仅为一般性健康参考，不构成医疗诊断或治疗建议。',
  '如用户描述疼痛、疾病或特殊身体状况，请建议其咨询专业医师或注册营养师。',
  '不要推荐任何药物、保健品品牌或极端节食方案。'
].join('');

// 内容安全检查（结果需以官方 msgSecCheck 返回为准）
async function checkText(content, openid) {
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      content, version: 2, scene: 2, openid
    });
    return res.result && res.result.suggest === 'pass';
  } catch (err) {
    console.error('msgSecCheck error:', err);
    // 检查服务异常时保守拦截，避免违规内容外泄
    return false;
  }
}

// 非流式调用（兜底路径）
function callLLM(messages) {
  return new Promise((resolve, reject) => {
    if (!LLM_API_HOST || !LLM_API_KEY) {
      return reject(new Error('大模型服务未配置，请在云函数环境变量设置 LLM_API_HOST / LLM_API_KEY'));
    }
    const body = JSON.stringify({
      model: LLM_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 800
    });
    const req = https.request({
      hostname: LLM_API_HOST,
      path: LLM_API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const content = json.choices && json.choices[0] && json.choices[0].message.content;
          resolve({ full: content || '', chunks: content ? [content] : [] });
        } catch (e) {
          reject(new Error('模型返回解析失败'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(new Error('模型请求超时')); });
    req.write(body);
    req.end();
  });
}

// 流式调用：请求 stream:true，服务端解析 SSE，收齐后返回 {full, chunks}
// chunk 粒度：直接按模型分片返回，前端按片渲染即为打字机效果
function callLLMStream(messages) {
  return new Promise((resolve, reject) => {
    if (!LLM_API_HOST || !LLM_API_KEY) {
      return reject(new Error('大模型服务未配置，请在云函数环境变量设置 LLM_API_HOST / LLM_API_KEY'));
    }
    const body = JSON.stringify({
      model: LLM_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 800,
      stream: true
    });
    const req = https.request({
      hostname: LLM_API_HOST,
      path: LLM_API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${LLM_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      // 非 200 或非 SSE：降级走非流式解析
      if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', c => { errData += c; });
        res.on('end', () => reject(new Error('模型服务返回 ' + res.statusCode)));
        return;
      }

      let buffer = '';      // SSE 半包缓冲
      const chunks = [];
      let full = '';

      res.on('data', (chunk) => {
        buffer += chunk;
        // SSE 事件以空行分隔
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          // 解析 data: 行
          const dataLines = rawEvent.split('\n')
            .filter(l => l.startsWith('data:'))
            .map(l => l.slice(5).trim());
          if (!dataLines.length) continue;
          const payload = dataLines.join('');
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            // OpenAI 兼容流式结构：choices[0].delta.content（字段名需按服务商核实）
            const delta = json.choices && json.choices[0] &&
              (json.choices[0].delta || {}) && json.choices[0].delta.content;
            if (delta) {
              full += delta;
              chunks.push(delta);
            }
          } catch (e) { /* 忽略无法解析的行 */ }
        }
      });

      res.on('end', () => {
        if (full) resolve({ full, chunks });
        else reject(new Error('模型未返回内容'));
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('模型请求超时')); });
    req.write(body);
    req.end();
  });
}

// 统一入口：优先流式，异常自动降级非流式
async function callModel(messages) {
  if (LLM_STREAM) {
    try {
      return await callLLMStream(messages);
    } catch (err) {
      console.warn('流式调用失败，降级非流式:', err.message);
    }
  }
  return await callLLM(messages);
}

exports.main = async (event, context) => {
  const { question } = event;
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { code: -1, msg: '登录态缺失，请从小程序内调用' };

  if (!question || !question.trim()) {
    return { code: -1, msg: '问题不能为空' };
  }
  if (question.length > 500) {
    return { code: -1, msg: '问题过长，请控制在500字内' };
  }

  try {
    // 1. 输入安全检查
    const inputSafe = await checkText(question, openid);
    if (!inputSafe) {
      return { code: -1, msg: '内容包含不适宜信息，请修改后重试' };
    }

    // 2. 读取最近 10 条对话作为上下文（PG）
    const historyRow = await one(
      `SELECT COALESCE(jsonb_agg(jsonb_build_object('role', data->>'role', 'content', data->>'content') ORDER BY (data->>'createdAt')::bigint ASC), '[]'::jsonb)::text
       FROM (SELECT data FROM public.fit_coach_chats WHERE data->>'openid'=${str(openid)}
             ORDER BY (data->>'createdAt')::bigint DESC LIMIT 10) t`
    );
    const contextMessages = historyRow ? JSON.parse(historyRow[0]) : [];

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...contextMessages,
      { role: 'user', content: question }
    ];

    // 3. 调用大模型（流式优先，服务端收齐全文）
    const { full, chunks } = await callModel(messages);
    if (!full) throw new Error('模型未返回内容');

    // 4. 输出安全检查（全文检查通过才下发）
    const outputSafe = await checkText(full, openid);
    let answer = full;
    if (!outputSafe) {
      answer = '抱歉，该问题我暂时无法回答。如有健康方面的疑虑，建议咨询专业医师或营养师。';
    }

    // 5. 对话落库（PG）
    const now = Date.now();
    await one(
      `INSERT INTO public.fit_coach_chats (id, data) VALUES
        (${str(newId('c'))}, ${jsonb({ openid, role: 'user', content: question, createdAt: now })}),
        (${str(newId('c'))}, ${jsonb({ openid, role: 'assistant', content: answer, createdAt: now + 1 })})`
    );

    // 6. 返回：answer 全文（兜底）+ chunks 分片（打字机用）
    return {
      code: 0,
      data: {
        answer,
        chunks: outputSafe ? chunks : [answer],
        disclaimer: '以上建议仅供参考，不构成医疗诊断'
      },
      msg: 'ok'
    };
  } catch (err) {
    console.error('aiCoach error:', err);
    return { code: -1, msg: err.message || '服务异常，请稍后重试' };
  }
};
