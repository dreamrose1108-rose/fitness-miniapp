const library=require('./exercise-library');
const plain={
 '3294':{name:'左右侧重俯卧撑',hint:'左右交替，将重心移向一侧完成俯卧撑。'},
 '1399':{name:'双手后撑，弯曲伸直手臂',hint:'双手在身后支撑身体，通过弯曲和伸直手臂完成动作。'},
 '3168':{name:'抓住支点，蹲下再拉起身体',hint:'需要牢固支点或悬挂训练器，抓稳后从蹲姿向上拉起身体。'},
 '0003':{name:'仰卧交替收膝转体',hint:'躺下后左右交替，让肘部靠近对侧膝盖。'}
};
const parts={'chest':'胸部','upper arms':'手臂','lower arms':'前臂','back':'背部','waist':'腹部','upper legs':'腿部','lower legs':'小腿','shoulders':'肩部','cardio':'心肺','neck':'颈部'};
function exercise(x){const item=library.get(x.id),alias=plain[x.id];return {...x,plainName:alias?alias.name:x.name||(item&&item.displayName)||'训练动作',originalName:x.name||(item&&item.displayName)||'',explanation:alias?alias.hint:'',bodyLabel:item?(parts[item.body]||item.bodyLabel):'',equipmentLabel:item?item.equipmentLabel:''};}
function session(row){const labels=[...new Set(row.exercises.map(x=>{const item=library.get(x.id);return item&&(parts[item.body]||item.bodyLabel);}).filter(Boolean))];return labels.length?labels.join('、')+'训练':row.title;}
module.exports={exercise,session};
