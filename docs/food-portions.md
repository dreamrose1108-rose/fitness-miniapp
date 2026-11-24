# 食物份量选择

默认克（g）；原数据为100ml的饮品默认毫升，不按密度1强行转克。选中食物后显示单位按钮、数量输入、换算重量和热量，支持0.5等小数。确认时统一按每100g/ml换算热量与营养素。份量只是估计，不替换食物库营养数据。

首批严格按食物名称匹配，防止苹果汁套苹果、香蕉干套香蕉等。支持普通带皮苹果、香蕉、普通柑橘的大中小；水煮鸡蛋按大个；普通白面包按片；熟白米饭/糙米饭按参考碗。以毫升计的饮品可选250ml容量杯。未知菜品和个人自定义食品只提供基础单位。

份量参考（2026-11-24核对；这是家用单位换算参考，不是营养库版本更新）：
- Health Canada CNF 苹果可食重量：小149g，中182g，大223g：https://food-nutrition.canada.ca/cnf-fce/serving-portion?id=1696
- 香蕉去皮：小101g，中118g，大136g：https://food-nutrition.canada.ca/cnf-fce/serving-portion?id=1704
- 普通柑橘去皮去籽：小76g，中88g，大120g：https://food-nutrition.canada.ca/cnf-fce/serving-portion?id=1623 。椪柑等按同类粗估，页面明确品种差异。
- 水煮鸡蛋大个去壳50g：https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/table-7-eggs-egg-dishes-nutrient-value-some-common-foods-2008.html
- 白面包普通片35g：https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/fn-an/alt_formats/hpfb-dgpsa/pdf/food-guide-aliment/serving_grain-cereal_portion-eng.pdf
- 香港卫生署学生健康服务，熟白米饭参考碗186g、熟糙米饭195g：https://www.studenthealth.gov.hk/sc_chi/resources/resources_bl/files/caloric_value_common_food.pdf

页面展示每个选项的参考克数、适用描述和来源链接。杯明确容量250ml，不推定用户任意水杯都同样大。重量均按可食部分，品牌、品种及实际大小可造成偏差。

记录新增可选字段amountUnit（g/ml）、portionLabel（最多40字），amount仍为基础单位数值，汇总算法不变。旧记录无amountUnit仍显示g。修改记录基础重量时清除旧份量标签并同比缩放营养素，避免原来的“半个”标签与新重量冲突。

缺测营养素不写入，服务端允许省略但拒绝负数及非有限值。保存失败保留数量，可重试；提交期间禁止重复确认和关闭，取消返回食物列表，不创建记录。

本地及后端模拟测试合计41项通过；猫咪奶茶、森林绿两种主题的份量弹窗已在模拟器检查。record云函数已部署成功；真实云端保存后刷新饮食页，正确读回0.5个（中）、59g、53kcal和蛋白质0.65g。仅本次自动复测创建的记录已清理。


## 常见食物扩展（2026-11-24）

内置2460条中231条支持家用单位；去重后保留的247条原常见食物中219条支持。food-portion-presets.js采用显式名称映射，仅统一空格和中英文括号，不用子串去推断食物，避免干燕麦变熟粥、生米变熟饭、果汁变水果。保留原有水果大小和来源换算优先级。

新增个、片、碗、份、根、块、张、串、只、把、勺等单位，支持小数数量。公开来源只标记其明确提供的份量；其余按产品粗估预设，basis=estimate且无来源链接，页面明确显示“常见份量粗估，并非该食物实测重量”。粗估不能当作标准化份量或食物实测结果，不覆盖原营养库数值。

粗估规则包括：普通中等饺子25g、包子80g；肉类100g可食参考份；个人小份成品菜200g（不是餐厅整盘）；坚果去壳小把25g等。页面同时说明生熟、去骨去皮和容器差异。用户可输入0.5、1.5等数量；克仍默认。未覆盖食物与自定义食物不擅自套用类别平均值；按100g计的饮品不按密度1换算成毫升。

本次仅扩展客户端份量规则，不改云端字段和接口；既有record保存与刷新协议继续使用。
