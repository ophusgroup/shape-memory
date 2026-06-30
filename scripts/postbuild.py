"""Post-build HTML tweaks for the static site.

Default to LIGHT mode: the MyST book-theme picks the color scheme from
localStorage ("myst:theme"), falling back to the visitor's OS preference, and
offers no config for a default. We inject a tiny script into <head> (so it runs
before the theme bundle, no flash) that sets light as the default for first-time
visitors while preserving the choice of anyone who has toggled the theme.

Run after `myst build --html`. Idempotent.
"""
import sys
from pathlib import Path

MARK = "light-default"
SNIPPET = (
    '<script data-id="%s">try{var k="myst:theme";'
    'if(!localStorage.getItem(k))localStorage.setItem(k,"light");'
    'var t=localStorage.getItem(k);var h=document.documentElement;'
    'h.classList.remove("light","dark");h.classList.add(t);}catch(e){}</script>'
) % MARK


def main(root: str) -> None:
    n = 0
    for f in Path(root).rglob("*.html"):
        text = f.read_text(encoding="utf-8")
        if MARK in text or "</head>" not in text:
            continue
        f.write_text(text.replace("</head>", SNIPPET + "</head>", 1), encoding="utf-8")
        n += 1
    print(f"post-build: light-default injected into {n} html files under {root}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "_build/html")
