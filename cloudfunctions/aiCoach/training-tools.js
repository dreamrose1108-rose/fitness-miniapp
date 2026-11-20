const crypto=require('crypto');
const items=require('./training-exercises.json');
const {validate}=require('./training-draft-schema');
const map=new Map(items.map(x=>[x.id,x]));
const tools=[
 {type:'function',function:{name:'search_exercises',description:'查询可用于训练计划的真实动作ID及名称。query用空格分隔关键词（任一匹配），equipment可选器械关键词。空query返回均衡的常用动作。',parameters:{type:'object',properties:{query:{type:'string'},equipment:{type:'string'}},required:[]}}},
 {type:'function',function:{name:'propose_training_plan',description:'生成可保存到日程的计划草稿，不直接保存。只能使用search_exercises查到的动作ID。offset=从用户选择的开始日期起第几天（0开始），不安排的日子视为休息。',parameters:{type:'object',properties:{title:{type:'string'},notes:{type:'string'},days:{type:'array',items:{type:'object',properties:{offset:{type:'integer'},title:{type:'string'},exercises:{type:'array',items:{type:'object',properties:{id:{type:'string'},sets:{type:'integer'},repsMin:{type:'integer'},repsMax:{type:'integer'},restSec:{type:'integer'},eachSide:{type:'boolean'}},required:['id','sets','repsMin','repsMax','restSec']}}},required:['offset','title','exercises']}}},required:['title','days']}}}
];
function search(args){const words=String(args.query||'').trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0,12),equipment=String(args.equipment||'').slice(0,30);const common=['0025','0577','0662','0293','0818','0426','0334','0294','0200','0336','0417','0276','3013','1459','0085','1760','0314','0410','1757','0872'];return items.filter(x=>(!equipment||x.equipment.includes(equipment))&&(words.length?words.some(q=>(x.name+' '+x.body+' '+x.target+' '+x.equipment).toLowerCase().includes(q)):common.includes(x.id))).slice(0,30);}
function propose(input){return {...validate(input,id=>map.get(id)),id:'ai_'+crypto.randomBytes(12).toString('hex')};}
module.exports={tools,search,propose};
