"""Build TFND 2025 UPDATE1 from two public mirrors. Requires opencc-python-reimplemented.
Usage: python scripts/import-food-2025.py primary.json corroboration.json
Raw downloads are kept outside Git; hashes and acquisition URLs are in catalog.meta.
"""
import json,re,hashlib,sys
from pathlib import Path
from opencc import OpenCC
root=Path(__file__).resolve().parents[1];primary=Path(sys.argv[1]);secondary=Path(sys.argv[2]);cc=OpenCC('t2s')
a=json.loads(primary.read_text(encoding='utf-8'));b={r['id']:r for r in json.loads(secondary.read_text(encoding='utf-8'))}
assert len(a)==2213 and set(r['id'] for r in a)==set(b)
for r in a:assert abs(r['calories']-float(b[r['id']]['values']['熱量']))<=.51,r['name']
old=json.loads((root/'shared/food-catalog/catalog.json').read_text(encoding='utf-8'))
legacy=[f for f in old['foods'] if f.get('origin')=='existing']
for f in legacy:f['sourceLabel']='原有参考值（版本未注明）'
cats={'穀物類':'主食','澱粉類':'主食','魚貝類':'蛋白','肉類':'蛋白','蛋類':'蛋白','豆類':'蛋白','乳品類':'饮品','蔬菜類':'果蔬','水果類':'果蔬','菇類':'果蔬','藻類':'果蔬','堅果及種子類':'坚果','油脂類':'脂肪','糕餅點心類':'零食','糖類':'调味','調味料及香辛料類':'调味','加工調理食品及其他類':'快餐','飲料類':'饮品'}
foods=[];chars={};rejected=[]
for r in a:
 name=cc.convert(r['name']);aliases=list(dict.fromkeys(cc.convert(s.strip()) for s in re.split('[,，、;；]',r.get('alias') or '') if s.strip()))
 f={'_id':'tfda2025_'+r['id'],'name':name,'cat':cats[r['category']],'unit':'100g','source':'official','origin':'tfda2025','sourceLabel':'TFND 2025 UPDATE1','detail':cc.convert(r['desc'])}
 if aliases:f['aliases']=aliases
 for out,field in {'kcal':'calories','protein':'protein','fat':'fat','carb':'carbs','fiber':'fiber','sodium':'sodium'}.items():
  v=r[field]
  if v is None:continue
  if not isinstance(v,(int,float)) or v<0 or (out in ['protein','fat','carb','fiber'] and v>100):rejected.append({'id':r['id'],'field':out,'value':v});continue
  f[out]=round(v,2) if out=='kcal' else round(v,3)
 assert 'kcal' in f
 for c in r['name']+(r.get('alias') or ''):
  s=cc.convert(c)
  if len(s)==1 and s!=c:chars[c]=s
 foods.append(f)
meta={'version':'2026-11-24-tfda2025-update1-v2','sourceVersion':'2025 UPDATE1','provider':'卫生福利部食品药物管理署','sourceUrl':'https://data.gov.tw/dataset/8543','downloadUrl':'https://m-calc.com/data/tfnd-veggies.json','versionDeclarationUrl':'https://m-calc.com/veggie-nutrition','corroborationUrl':'https://tools.vege.club/food-calories/foods.json','licenseUrl':'https://data.gov.tw/license','retrievedAt':'2026-11-24','sourceCount':len(a),'count':len(foods)+len(legacy),'rawSha256':hashlib.sha256(primary.read_bytes()).hexdigest(),'corroborationSha256':hashlib.sha256(secondary.read_bytes()).hexdigest(),'crossCheck':{'matchedIds':len(a),'caloriesWithinRounding':len(a)},'rejectedFields':rejected,'note':'2025 UPDATE1官方数据的公开镜像，编号和热量经第二镜像交叉核对；官方直连不可用，未声称官方最新版本。'}
(root/'shared/food-catalog/catalog.json').write_text(json.dumps({'meta':meta,'foods':foods+legacy,'characters':chars},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('new',len(foods),'legacy',len(legacy),'rejected',len(rejected),'bytes',(root/'shared/food-catalog/catalog.json').stat().st_size)
