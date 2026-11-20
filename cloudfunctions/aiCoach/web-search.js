// Official Coding Plan MCP, Node 16 compatible. Credentials remain server-side.
const https = require('https');
const ENDPOINT = 'https://open.bigmodel.cn/api/mcp/web_search_prime/mcp';
function rpc(message, state, deadline) {
  return new Promise((resolve, reject) => {
    const key = process.env.SEARCH_API_KEY || process.env.LLM_API_KEY;
    if (!key) return reject(Error('搜索服务未配置'));
    const body = JSON.stringify(message);
    let finished = false, buffer = '', bytes = 0;
    const done = (err, value) => { if (finished) return; finished = true; clearTimeout(timer); err ? reject(err) : resolve(value); };
    const headers = {'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+key,'Content-Length':Buffer.byteLength(body)};
    if (state.session) headers['Mcp-Session-Id'] = state.session;
    if (state.version) headers['MCP-Protocol-Version'] = state.version;
    const req = https.request(ENDPOINT, {method:'POST',headers}, res => {
      if (res.headers['mcp-session-id']) state.session = res.headers['mcp-session-id'];
      if (res.statusCode < 200 || res.statusCode >= 300) { res.resume(); return done(Error('搜索服务返回 '+res.statusCode)); }
      if (!message.id && res.statusCode === 202) { res.resume(); return done(null, {}); }
      const accept = raw => {
        let value; try { value=JSON.parse(raw); } catch (_) { return; }
        if (value.id !== message.id) return;
        if (value.error) done(Error('搜索请求失败')); else done(null,value.result);
        res.destroy();
      };
      const sse = String(res.headers['content-type']||'').includes('text/event-stream');
      res.setEncoding('utf8');
      res.on('data', chunk => {
        bytes += Buffer.byteLength(chunk); if (bytes>512*1024) { done(Error('搜索响应过大'));res.destroy();return; }
        buffer += chunk;
        if (sse) { buffer=buffer.replace(/\r\n/g,'\n'); let end; while((end=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);accept(event.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n'));} }
      });
      res.on('end',()=>{if(!sse)accept(buffer);if(!finished)done(Error('搜索响应格式无效'));});
      res.on('error',()=>done(Error('搜索连接中断')));
    });
    const timer = setTimeout(()=>{done(Error('搜索超时，请稍后重试'));req.destroy();},Math.max(1,deadline-Date.now()));
    req.on('error',()=>done(Error('搜索连接失败')));req.end(body);
  });
}
function normalize(result) {
  if (!result || result.isError) throw Error('搜索服务暂不可用');
  const rows=[];
  const visit=(value,depth=0)=>{
    if(depth>8||!value)return;
    if(typeof value==='string'){try{visit(JSON.parse(value),depth+1);}catch(_){}return;}
    if(Array.isArray(value)){value.slice(0,50).forEach(x=>visit(x,depth+1));return;}
    if(typeof value!=='object')return;
    const link=value.link||value.url;
    if(link && value.title){
      try{const url=new URL(link);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return;
        if(!rows.some(x=>x.url===url.href))rows.push({title:String(value.title).slice(0,160),url:url.href,site:String(value.media||value.site_name||url.hostname).slice(0,100),date:String(value.publish_date||value.date||'').slice(0,40),snippet:String(value.content||value.snippet||value.summary||'').slice(0,900)});
      }catch(_){}return;
    }
    for(const k of ['search_result','search_results','results','data','structuredContent','content','text'])if(value[k])visit(value[k],depth+1);
  };
  visit(result);
  return rows.slice(0,5).map((x,i)=>({...x,id:i+1}));
}
async function search(query) {
  query=String(query||'').trim().replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'').replace(/\b1[3-9]\d{9}\b/g,'').slice(0,120);
  if(!query)throw Error('搜索关键词不能为空');
  const state={},deadline=Date.now()+16000;
  const init=await rpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'kalumiao-coach',version:'1.0.0'}}},state,deadline);
  if(!['2024-11-05','2025-03-26','2025-06-18'].includes(init.protocolVersion))throw Error('搜索协议不兼容');
  state.version=init.protocolVersion;
  await rpc({jsonrpc:'2.0',method:'notifications/initialized'},state,deadline);
  const list=await rpc({jsonrpc:'2.0',id:2,method:'tools/list'},state,deadline);
  const tool=(list.tools||[]).find(x=>typeof x.name==='string'&&/search/i.test(x.name)&&x.inputSchema&&['search_query','searchQuery','query'].some(k=>x.inputSchema.properties&&x.inputSchema.properties[k]));
  if(!tool)throw Error('搜索工具暂不可用');
  const properties=tool.inputSchema&&tool.inputSchema.properties||{};
  const field=['search_query','searchQuery','query'].find(x=>properties[x]);
  if(!field)throw Error('搜索参数不兼容');
  const args={[field]:query};
  if(properties.content_size)args.content_size='medium';
  const result=await rpc({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:tool.name,arguments:args}},state,deadline);
  return normalize(result);
}
module.exports={search,normalize,rpc};
