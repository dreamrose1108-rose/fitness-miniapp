const cnf=id=>'https://food-nutrition.canada.ca/cnf-fce/serving-portion?id='+id;
function options(food){
 const base=food.unit==='100ml'?'ml':'g';
 const out=[{id:'base',label:base==='g'?'克（g）':'毫升（ml）',unit:base,amount:1,note:''}];
 if(base==='ml'){out.push({id:'cup',label:'杯',unit:'杯',amount:250,note:'按250ml容量杯估算；杯子容量不同，请按实际容量选毫升。'});return out;}
 if(food.source==='custom')return out;
 const n=String(food.name||'').replace(/\s/g,'');
 let sizes,unit='个',source='',note='';
 if(/^(苹果|富士苹果|红富士苹果|青苹果|嘎啦苹果|金冠苹果|苹果\(带皮\)|苹果（带皮）)$/.test(n)){sizes=[['小',149,'直径约6.9cm'],['中',182,'直径约7cm'],['大',223,'直径约8.3cm']];source=cnf(1696);note='带皮、去核后的可食部分';}
 else if(/^(香蕉|北蕉|美人蕉|香蕉\(生\)|香蕉（生）)$/.test(n)){sizes=[['小',101,'长约15～17.5cm'],['中',118,'长约18～20cm'],['大',136,'长约20～22.5cm']];source=cnf(1704);note='去皮后的可食部分';}
 else if(/^(橘子|桔子|橘子（桔子）|椪柑|蜜橘|柑橘|宽皮橘)$/.test(n)){sizes=[['小',76,'直径约5.7cm'],['中',88,'直径约6cm'],['大',120,'直径约6.4cm']];source=cnf(1623);note='按普通柑橘去皮去籽估算，品种会有差异';}
 else if(/^(水煮蛋|水煮鸡蛋|鸡蛋（水煮）|鸡蛋\(水煮\)|鸡蛋（煮）|白煮蛋)$/.test(n)){sizes=[['大',50,'去壳']];source='https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/table-7-eggs-egg-dishes-nutrient-value-some-common-foods-2008.html';note='水煮鸡蛋去壳可食部分';}
 else if(/^(白吐司|白土司|白面包|切片白面包)$/.test(n)){sizes=[['参考',35,'普通切片']];unit='片';source='https://www.canada.ca/content/dam/hc-sc/migration/hc-sc/fn-an/alt_formats/hpfb-dgpsa/pdf/food-guide-aliment/serving_grain-cereal_portion-eng.pdf';note='普通白面包切片参考，厚度及品牌会有差异';}
 else if(/^(米饭|米饭（熟）|米饭\(熟\)|白米饭|白米饭（熟）|白饭|糙米饭|糙米饭（熟）)$/.test(n)){sizes=[['参考',n.includes('糙')?195:186,'普通参考碗']];unit='碗';source='https://www.studenthealth.gov.hk/sc_chi/resources/resources_bl/files/caloric_value_common_food.pdf';note='熟饭参考碗，盛放量与碗大小会有差异';}
 if(sizes)for(const [size,amount,hint] of sizes)out.push({id:size,label:size==='参考'?unit:unit+'（'+size+'）',unit,size,amount,hint,source,note});
 return out;
}
function calculate(food,option,value){
 const raw=String(value||'').trim();if(!/^\d+(\.\d+)?$/.test(raw))return null;
 const quantity=Number(raw),amount=Math.round(quantity*option.amount*100)/100;
 if(!Number.isFinite(amount)||quantity<=0||amount<=0||amount>100000)return null;
 const kcal=Math.round(Number(food.kcal)*amount/100);if(!Number.isFinite(kcal)||kcal<0)return null;
 const macro={};for(const [src,dst] of [['protein','proteinG'],['carb','carbG'],['fat','fatG']])if(food[src]!=null&&Number.isFinite(Number(food[src])))macro[dst]=Math.round(Number(food[src])*amount)/100;
 return {amount,kcal,...macro,amountUnit:food.unit==='100ml'?'ml':'g',portionLabel:option.id==='base'?'':quantity+option.label};
}
module.exports={options,calculate};
