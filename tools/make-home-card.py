"""Builds assets/images/social-card.jpg, the link preview for the homepage,
About and booking page, from tools/social-home-template.html and the
artist photos used on the homepage. Run from the website folder:
    python tools/make-home-card.py
Needs Edge and ffmpeg (both already used by the other tools)."""
import os
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
EDGE = r'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

html = (ROOT / 'tools' / 'social-home-template.html').read_text(encoding='utf-8')
for key, rel in (('LOGO', 'assets/images/logo.png'), ('BURNEY', 'assets/images/burney.jpg'), ('GIBBS', 'assets/images/gibbs.jpg')):
    html = html.replace('{{' + key + '}}', (ROOT / rel).as_uri())

with tempfile.TemporaryDirectory() as tmp:
    page = pathlib.Path(tmp) / 'card.html'
    png = pathlib.Path(tmp) / 'card.png'
    page.write_text(html, encoding='utf-8')
    subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--user-data-dir={tmp}/p',
                    '--window-size=1200,630', '--virtual-time-budget=6000', f'--screenshot={png}', page.as_uri()],
                   capture_output=True, timeout=120)
    out = ROOT / 'assets' / 'images' / 'social-card.jpg'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(png), '-q:v', '3', str(out)], check=True)
    print(f'social-card.jpg  {os.path.getsize(out) // 1024} KB')
