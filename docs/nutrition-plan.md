# 每日营养估算 v1

适用：19–78 岁一般健康成年人。用户确认非孕哺期、非治疗饮食及非进食障碍情况。当前体重用于计算，不使用目标体重。BMI <18.5 不生成减脂目标。

- Mifflin–St Jeor 简式：10×kg +6.25×cm −5×年龄 +5（男）/−161（女）。来源 https://pubmed.ncbi.nlm.nih.gov/2305711/
- 日常活动系数 1.2/1.4/1.6 是产品简化假设，明确排除专门锻炼。运动按轻/中/高 3/5/7 MET 粗估，使用 (MET−1)×体重×小时×每周天数/7 的净增加量。不会再加饮食/运动记录消耗，不承诺精确测量。
- 维持/减脂/增肌使用维持估算的 100%/90%/105%，为保守起始方案而非临床处方。下限男1500/女1200，触发时提示确认；大于6000拒绝自动生成。
- 蛋白质25%、碳水45%、脂肪30%，位于成人AMDR范围内，不宣称唯一最优。来源 https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html
- 蛋白和碳水按4 kcal/g，脂肪按9 kcal/g。每日克数取整；分餐用末餐补齐取整余量，确保餐次合计等于日目标。
- 默认三餐30/40/30；加餐时25/35/30/10，比例为可解释的产品安排。
- 仅用户点击应用后，经现有 userProfile update 保存 nutritionGoal/dailyCalorieTarget/proteinTarget/carbTarget/fatTarget。计算资料按 openid 存本机，不生成已摄入记录。失败不标记成功，不覆盖饮水目标。

## 饮食模式选择
- 均衡三餐为默认；旧版已保存资料回退到均衡方案。
- 16:8 仅调整进食窗口和餐次标签，不二次削减热量；需确认额外适用范围。窗口限制在同一自然日，包含所有加餐，不限制饮水。
- 5:2 目前是可选择查看的介绍，不生成/保存低能量日数值，现有云端结构也不具备分日热量目标。禁止将普通每天目标误标为 5:2，或用平均热量覆盖限制日。
- 证据：https://www.bmj.com/content/389/bmj-2024-082007 （99 项随机试验的系统综述）；定义参考 https://www.healthquality.va.gov/guidelines/CD/diabetes/VADOD-Diabetes-CPG_Final_508.pdf 。不宣称轻断食普遍优于持续能量限制。

当前选项仅包含均衡三餐、16:8、5:2，不单列“轻断食”或14:10。
