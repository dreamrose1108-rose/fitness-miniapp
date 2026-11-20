"""Convert licensed continuous footage to GIF; never synthesize motion from pose photos."""
import json
import subprocess
from pathlib import Path
import imageio_ffmpeg
from PIL import Image

project = Path(__file__).resolve().parents[1]
source = project / 'reports/exercise-media'
output = project / 'reports/exercise-gif/publish'
output.mkdir(parents=True, exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
results = []
for media in json.loads((source / 'video-matches.json').read_text(encoding='utf-8-sig')):
    action_id = media['localId']
    input_file = source / 'publish' / (action_id + '.mp4')
    destination = output / (action_id + '.gif')
    subprocess.run([
        ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-i', str(input_file),
        '-filter_complex',
        '[0:v]fps=10,scale=240:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
        '-loop', '0', str(destination)
    ], check=True)
    with Image.open(destination) as gif:
        assert gif.format == 'GIF' and gif.n_frames > 30
        duration = 0
        for frame in range(gif.n_frames):
            gif.seek(frame)
            duration += gif.info.get('duration', 0)
        results.append({
            'id': action_id, 'frames': gif.n_frames, 'durationMs': duration,
            'bytes': destination.stat().st_size, 'width': gif.width, 'height': gif.height,
            'source': media['video'], 'author': media['license_author'],
            'license': 'CC BY-SA 4.0',
            'changes': 'Continuous source video converted to silent 10fps GIF; incline bench clip omits opening 3 seconds.'
        })
(output.parent / 'conversion-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps([{k: row[k] for k in ['id','frames','durationMs','bytes']} for row in results]))

