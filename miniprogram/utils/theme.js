const palettes={
 cat:{primary:'#8b613f',light:'#f5e5d0',text:'#674a38',secondary:'#846950',muted:'#967d68',bg:'#fff8f0',card:'#fffdf9',border:'#ecdcc9',dark:'#755039',radius:'24rpx'},
 forest:{primary:'#2e7d5b',light:'#e8f3ed',text:'#203c32',secondary:'#5f7065',muted:'#788579',bg:'#f5f5ef',card:'#ffffff',border:'#dfe6dc',dark:'#205b43',radius:'18rpx'}
};
function read(){try{return wx.getStorageSync('homeTheme:v1')==='forest'?'forest':'cat';}catch(e){return 'cat';}}
function apply(page){
 const theme=read(),p=palettes[theme];
 const tokens={'color-primary':p.primary,'color-primary-light':p.light,'color-text':p.text,'color-text-2':p.secondary,'color-text-3':p.muted,'color-bg':p.bg,'color-card':p.card,'color-border':p.border,'color-primary-dark':p.dark,radius:p.radius};
 const style=Object.keys(tokens).map(k=>'--'+k+':'+tokens[k]).join(';')+';background-color:'+p.bg+';color:'+p.text+';';
 page.setData({theme,themeIndex:theme==='forest'?1:0,appThemeStyle:style});
 if(wx.setNavigationBarColor)wx.setNavigationBarColor({frontColor:'#000000',backgroundColor:p.bg});
 if(wx.setBackgroundColor)wx.setBackgroundColor({backgroundColor:p.bg,backgroundColorTop:p.bg,backgroundColorBottom:p.bg});
 if(wx.setTabBarStyle)wx.setTabBarStyle({color:p.muted,selectedColor:p.primary,backgroundColor:p.card,borderStyle:'white'});
}
module.exports={read,apply,palettes};
