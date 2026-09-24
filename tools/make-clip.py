"""Turns a video into a homepage clip: vertical 9:16, muted, a few MB, plus a poster image.

Run from the website folder:
    python tools/make-clip.py <video> <name> [start] [length]

    python tools/make-clip.py "C:/Users/me/Videos/nooduitgang.mov" gibbs-nooduitgang 0:12 12

This writes assets/video/clips/<name>.mp4 and assets/video/clips/<name>.jpg.
start = where the clip begins (seconds or m:ss, default 0), length in seconds (default 12).
Landscape videos are cropped to the middle. Needs ffmpeg.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'video', 'clips')


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src, name = sys.argv[1], sys.argv[2]
    start = sys.argv[3] if len(sys.argv) > 3 else '0'
    length = sys.argv[4] if len(sys.argv) > 4 else '12'
    os.makedirs(OUT, exist_ok=True)
    mp4 = os.path.join(OUT, name + '.mp4')
    jpg = os.path.join(OUT, name + '.jpg')
    # crop the middle to 9:16, 540x960, no audio, small and quick to start
    vf = "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=540:960,fps=30"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', start, '-t', length, '-i', src,
                    '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27',
                    '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp4, '-frames:v', '1', '-q:v', '4', jpg], check=True)
    print(f'{name}.mp4  {os.path.getsize(mp4) / 1048576:.1f} MB,  poster {name}.jpg')


if __name__ == '__main__':
    main()
