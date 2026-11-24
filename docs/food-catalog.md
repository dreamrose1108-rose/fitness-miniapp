# 食物库来源与同步

当前内置公共库为 2,460 条去重条目：2025 UPDATE1 的 2,213 条源记录与 298 条原有补充记录合并去重。运行时另合并数据库公共增量和当前账号自定义食物，实际数量可能更多。

## 版本、来源与限制

- 2026-11-24 获取 TFND 2025 UPDATE1 公开镜像，替换此前的 2015 历史数据。
- 官方提供者：卫生福利部食品药物管理署。官方入口 https://data.gov.tw/dataset/8543 ，政府资料开放授权条款第1版 https://data.gov.tw/license 。本项目进行了简体转换、分类、字段选择与去重，不代表机构认可。
- 版本声明 https://m-calc.com/veggie-nutrition ，下载 https://m-calc.com/data/tfnd-veggies.json 。官方直连下载本次不可用，因此明确标注公开镜像，不宣称已验证官方最新版本。
- 交叉核对 https://tools.vege.club/food-calories/foods.json ：2,213 个编号全部匹配，全部热量数值在 0.51 kcal 舍入差内一致。另一站的页面更新时间不能代替源数据版本。
- 两份原始文件的 SHA-256、获取日期、核对数量记录在 shared/food-catalog/catalog.json 的 meta 中。
- 保留样品说明（生熟、去皮、处理方式等）。来源按每100克可食部分；原有每100毫升条目保留原单位，不擅自换算。
- 使用来源热量、蛋白质、脂肪、碳水字段，不重新用4/4/9推导热量；缺测保持缺失。调合植物油脂肪100.3005g/100g超范围，该字段不采用，meta.rejectedFields留痕。
- 298条原有补充参考值单独标注版本未注明。食品配方和品牌存在差异，不保证覆盖所有食物，不把AI估算作为公共事实入库。

## 重建与同步

先下载上述两个JSON到 reports/tfnd-2025.json 和 reports/tfnd-2026-mirror.json，然后运行：

```powershell
python scripts/import-food-2025.py reports/tfnd-2025.json reports/tfnd-2026-mirror.json
node scripts/sync-food-catalog.cjs
node --test tests/food-catalog.test.cjs tests/food-cache.test.cjs tests/diet.test.cjs tests/coach.test.cjs
```

Python导入器依赖opencc-python-reimplemented。shared/food-catalog是唯一公共源，生成小程序、foodLib、aiCoach与server/aiCoach副本。小程序使用显式JS模块，避免目录/JSON require兼容问题。更新后部署foodLib、aiCoach并重新生成预览。

当前源覆盖同名同单位的旧缓存和未注明版本公共数据；丢弃tfda2015来源条目。个人自定义以ID单独保留，不覆盖公共事实。数据库公共增量保留；个人数据查询强制账号隔离。数据库故障仍返回内置公共数据。

AI search_food共用同一服务，返回单位、来源、版本及样品说明。旧饮食记录不重算，历史热量不随食物库升级变化。

客户端完整目录保存在页面实例而非setData，每次只渲染100条。账号缓存采用每200条一块，全部写入后发布manifest，避免单项存储超限。兼容旧快照读取，经过新版合并后迁移；失败保留上次完整快照，缺块回退内置库。迟到响应不能覆盖后一次同步或其他账号数据。

明确提到库内食物时，AI服务先提取最长匹配的食物名称/别名（最多3个），主动执行当前账号search_food查询，再生成回答，防止模型漏调工具或沿用旧聊天结论。其余问题仍可通过工具查询。

## 本轮验证

21项食物库、缓存、饮食及教练相关测试通过。云端和模拟器均返回2025 UPDATE1；实测账号2511条、2015来源0条。大麦仁每100g为364.62 kcal，样品为生、已去壳。缓存分块和旧快照迁移测试通过，历史饮食记录未改写。

真实AI复测已正确回答大麦仁364.62 kcal/100g、蛋白质8.56g、生且去壳、TFND 2025 UPDATE1，并区分烘烤大麦仁粉。
