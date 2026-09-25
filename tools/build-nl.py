"""Builds the Dutch pages in nl/ from the English pages.

Run from the website folder after changing an English page (it also refreshes
sitemap.xml):
    python tools/build-nl.py

The English pages are the source. This script copies each one, swaps in the Dutch
texts from tools/nl/translations.py, points links to the /nl/ pages and fixes the
paths to images and styles (the Dutch pages live one folder deeper).

It then lists:
  - translations it could no longer find (the English text changed: update the entry)
  - English-looking text that has no translation yet
Never edit the files in nl/ by hand: the next run overwrites them.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, 'nl'))
import translations as T  # noqa: E402

SITE = 'https://boons-agency.nl'
PAGES = {  # file -> English URL
    'index.html': '/', 'gibbs.html': '/gibbs', 'burney.html': '/burney',
    'about.html': '/about', 'book.html': '/book', 'terms.html': '/terms', 'thanks.html': '/thanks',
}
ARTIST_PAGES = {'gibbs.html', 'burney.html'}


def nl_url(url):
    return '/nl/' if url == '/' else '/nl' + url


def pattern(en):
    """Literal text -> regex that ignores differences in line breaks/indentation."""
    if en.startswith('re:'):
        return re.compile(en[3:], re.S)
    return re.compile(r'\s+'.join(re.escape(part) for part in en.split()), re.S)


def apply(html, entries, strict, page, missing):
    for en, nl in entries:
        rx = pattern(en)
        if en.startswith('re:'):
            html, n = rx.subn(nl, html)
        else:
            html, n = rx.subn(lambda m, nl=nl: nl, html)
        if strict and n == 0:
            missing.append((page, en))
    return html


def localise(html, page):
    url = PAGES[page]
    html = html.replace('<html lang="en">', '<html lang="nl">', 1)
    # canonical + og:url point to the Dutch page
    html = re.sub(r'(<link rel="canonical" href=")' + re.escape(SITE + url) + '"',
                  lambda m: m.group(1) + SITE + nl_url(url) + '"', html)
    html = re.sub(r'(<meta property="og:url" content=")' + re.escape(SITE + url) + '"',
                  lambda m: m.group(1) + SITE + nl_url(url) + '"', html)
    html = re.sub(r'(<meta property="og:type"[^>]*>)', r'\1\n<meta property="og:locale" content="nl_NL">', html, count=1)
    # form: Dutch thank-you page
    html = html.replace('value="' + SITE + '/thanks"', 'value="' + SITE + '/nl/thanks"')
    # links to pages -> /nl/ versions (assets and absolute URLs untouched)
    html = re.sub(r'href="/(?!nl/|assets/|css/|js/)([^"]*)"', lambda m: 'href="/nl/' + m.group(1) + '"', html)
    # form actions (the date check on the artist pages) -> Dutch pages too
    html = re.sub(r'action="/(?!nl/)([^"]*)"', lambda m: 'action="/nl/' + m.group(1) + '"', html)
    # relative paths to files: one folder deeper now
    html = re.sub(r'((?:href|src|poster)=")((?:assets|css|js)/)', r'\1../\2', html)
    html = re.sub(r'srcset="([^"]*)"',
                  lambda m: 'srcset="' + re.sub(r'(^|,\s*)assets/', r'\1../assets/', m.group(1)) + '"', html)
    # language switch: EN points back to the English page, NL is the current one
    html = re.sub(r'<nav class="lang-switch"[^>]*>.*?</nav>',
                  '<nav class="lang-switch" aria-label="Taal"><a href="' + url + '" lang="en" hreflang="en">EN</a>'
                  '<a href="' + nl_url(url) + '" lang="nl" aria-current="true">NL</a></nav>', html, flags=re.S)
    return html


def english_leftovers(en_html, nl_html):
    """Text that is still identical to the English page and looks like English."""
    def texts(h):
        h = re.sub(r'<(script|style)\b.*?</\1>', ' ', h, flags=re.S)
        h = re.sub(r'<!--.*?-->', ' ', h, flags=re.S)
        return {re.sub(r'\s+', ' ', t).strip() for t in re.split(r'<[^>]+>', h)}
    english = re.compile(r"\b(the|and|your|you|with|our|for|of|to|is|are|we|this|that|it's|don't)\b", re.I)
    same = texts(en_html) & texts(nl_html)
    return sorted(t for t in same if len(t) > 3 and english.search(t))


def write_sitemap():
    """sitemap.xml with both languages; lastmod = when the English page last changed."""
    import datetime
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for lang_url in (lambda u: u, nl_url):
        for page, url in PAGES.items():
            if page == 'thanks.html':
                continue  # not a page people should land on from Google
            day = datetime.date.fromtimestamp(os.path.getmtime(os.path.join(ROOT, page))).isoformat()
            lines.append(f'  <url><loc>{SITE}{lang_url(url)}</loc><lastmod>{day}</lastmod></url>')
    lines.append('</urlset>')
    with open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8', newline=chr(10)) as f:
        f.write(chr(10).join(lines) + chr(10))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    os.makedirs(os.path.join(ROOT, 'nl'), exist_ok=True)
    missing, leftovers = [], {}
    for page in PAGES:
        with open(os.path.join(ROOT, page), encoding='utf-8') as f:
            en_html = f.read()
        html = en_html
        for region_page, start, end, fname in T.REGIONS:
            if region_page != page:
                continue
            with open(os.path.join(HERE, 'nl', fname), encoding='utf-8') as f:
                block = f.read().rstrip('\n')
            i = html.find(start)
            j = html.find(end, i)
            if i < 0 or j < 0:
                missing.append((page, 'region ' + start))
            else:
                html = html[:i] + block + html[j + len(end):]
        html = apply(html, T.PAGES.get(page, []), True, page, missing)
        if page in ARTIST_PAGES:
            html = apply(html, T.ARTIST, False, page, missing)
        html = apply(html, T.COMMON, False, page, missing)
        html = localise(html, page)
        with open(os.path.join(ROOT, 'nl', page), 'w', encoding='utf-8', newline='\n') as f:
            f.write(html)
        left = english_leftovers(en_html, html)
        if left:
            leftovers[page] = left

    write_sitemap()
    print('Dutch pages written to nl/ (' + ', '.join(PAGES) + '), sitemap.xml updated')
    if missing:
        print('\nNo longer found on the English page (update tools/nl/translations.py):')
        for page, en in missing:
            print('  ' + page + ': ' + en[:90])
    if leftovers:
        print('\nStill English on the Dutch pages (add a translation if needed):')
        for page, items in leftovers.items():
            for t in items:
                print('  ' + page + ': ' + t[:100])
    if not missing and not leftovers:
        print('All texts translated.')


if __name__ == '__main__':
    main()
