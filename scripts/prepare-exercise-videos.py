import json,os,subprocess,imageio_ffmpeg
root='reports/exercise-media';ff=imageio_ffmpeg.get_ffmpeg_exe()
for v in json.load(open(root+'/video-matches.json')):
 id=v['localId'];chunks=[]
 try:
  for i in range((v['size']+65535)//65536):
   b=open(root+'/chunks/'+id+'-'+str(i),'rb').read()
   assert len(b)==min(65536,v['size']-i*65536)
   chunks.append(b)
 except: continue
 source=root+'/original-videos/'+id+'-complete.mov';open(source,'wb').write(b''.join(chunks))
 subprocess.run([ff,'-y','-hide_banner','-loglevel','error','-ss',('3' if id=='0047' else '0'),'-i',source,'-vf','scale=640:-2','-c:v','libx264','-preset','fast','-crf','25','-pix_fmt','yuv420p','-an','-movflags','+faststart',root+'/publish/'+id+'.mp4'],check=True)
 subprocess.run([ff,'-y','-hide_banner','-loglevel','error','-ss','1','-i',root+'/publish/'+id+'.mp4','-frames:v','1',root+'/'+id+'-video-check.jpg'],check=True)
 print(id,os.path.getsize(root+'/publish/'+id+'.mp4'))
