const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
module.exports=function(wx={showModal(){}}){const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/utils/feedback.js'),'utf8'),{module,wx,Date});return module.exports;};
