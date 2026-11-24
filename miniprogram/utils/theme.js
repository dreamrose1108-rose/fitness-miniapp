const palettes={
 cat:{primary:'#8b613f',light:'#f7ead9',text:'#674a38',secondary:'#795f49',muted:'#7b604a',bg:'#fff8f0',card:'#fffdf9',border:'#ecdcc9',dark:'#755039',radius:'24rpx'},
 wonyoung:{primary:'#a64b70',light:'#f7e7ee',text:'#49343f',secondary:'#765663',muted:'#765663',bg:'#fff7fa',card:'#fffdfd',border:'#ecd9e2',dark:'#863957',radius:'24rpx'},
 forest:{primary:'#2e7d5b',light:'#edf6f0',text:'#203c32',secondary:'#5f7065',muted:'#5f7065',bg:'#f5f5ef',card:'#ffffff',border:'#dfe6dc',dark:'#205b43',radius:'18rpx'}
};
const themeIds=['cat','forest','wonyoung'];
const themeNames=['猫咪奶茶','自然森林','张元英 · 雾粉'];
function read(){try{const value=wx.getStorageSync('homeTheme:v1');return themeIds.includes(value)?value:'cat';}catch(e){return 'cat';}}
function apply(page){
 const theme=read(),p=palettes[theme];
 const tokens={'color-primary':p.primary,'color-primary-light':p.light,'color-text':p.text,'color-text-2':p.secondary,'color-text-3':p.muted,'color-bg':p.bg,'color-card':p.card,'color-border':p.border,'color-primary-dark':p.dark,radius:p.radius};
 const style=Object.keys(tokens).map(k=>'--'+k+':'+tokens[k]).join(';')+';background-color:'+p.bg+';color:'+p.text+';';
 page.setData({theme,themeIndex:themeIds.indexOf(theme),appThemeStyle:style});
 if(wx.setNavigationBarColor)wx.setNavigationBarColor({frontColor:'#000000',backgroundColor:p.bg});
 if(wx.setBackgroundColor)wx.setBackgroundColor({backgroundColor:p.bg,backgroundColorTop:p.bg,backgroundColorBottom:p.bg});
 if(wx.setTabBarStyle)wx.setTabBarStyle({color:p.muted,selectedColor:p.primary,backgroundColor:p.card,borderStyle:'white'});
}
module.exports={read,apply,palettes,themeIds,themeNames};
