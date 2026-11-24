const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=path.join(root,'shared/food-catalog');
for(const target of ['miniprogram/utils/food-catalog','cloudfunctions/foodLib/food-catalog','cloudfunctions/aiCoach/food-catalog','server/aiCoach/food-catalog']){
 fs.mkdirSync(path.join(root,target),{recursive:true});
 const mini=target.startsWith('miniprogram/');
 fs.writeFileSync(path.join(root,target,'index.js'),fs.readFileSync(path.join(source,'index.js'),'utf8').replace("require('./catalog.json')", mini ? "require('./catalog.js')" : "require('./catalog.json')"));
 const raw=fs.readFileSync(path.join(source,'catalog.json'),'utf8');
 if(mini){fs.writeFileSync(path.join(root,target,'catalog.js'),'module.exports='+raw+';\n');const old=path.join(root,target,'catalog.json');if(fs.existsSync(old))fs.unlinkSync(old);}else fs.writeFileSync(path.join(root,target,'catalog.json'),raw);

}
for(const target of ['cloudfunctions/foodLib','cloudfunctions/aiCoach','server/aiCoach'])fs.copyFileSync(path.join(source,'service.js'),path.join(root,target,'food-service.js'));
console.log('Synchronized catalog:',crypto.createHash('sha256').update(fs.readFileSync(path.join(source,'catalog.json'))).digest('hex'));

for(const target of ['miniprogram/utils','cloudfunctions/aiCoach','server/aiCoach','cloudfunctions/record','server/record']){
 for(const file of ['food-portions.js','food-portion-presets.js','meal-editor.js',...(target.endsWith('aiCoach')?['coach-portions.js']:[])])fs.copyFileSync(path.join(root,'shared/food-portions',file),path.join(root,target,file));
}
