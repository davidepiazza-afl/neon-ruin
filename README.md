# Neon Ruin — Kazinczy 14 (browser FPS prototype)

Mobile-first first-person shooter set in a Szimpla-Kert-style ruin-bar courtyard (Budapest, Kazinczy utca 14).
Three.js r160 is vendored in `vendor/` (MIT, see `vendor/THREE_LICENSE`); all geometry and textures are procedural — no external assets.

## Run
    cd ruinbar-fps && python3 -m http.server 8000
Open http://localhost:8000 (or http://<your-LAN-IP>:8000 on a phone on the same Wi-Fi).
URL flags: `?touch=1` / `?touch=0` force touch / desktop controls.

## Controls
Desktop: WASD move · mouse look (pointer lock) · click/hold shoot · Space jump · Shift sprint · R reload · Q cycle quality · M mute · Esc/P pause
Phone (landscape): left thumb = floating joystick (push to the edge to sprint) · right half drag = look · FIRE (hold; drag on it to aim while firing) · JUMP · R reload · II pause

## Quality
Auto (phone → Medium, desktop → High; drops a level if FPS < 38 for 3 s), Low (no bloom, 1.0x pixel ratio, 4 lights, cheap additive halos), Medium (half-res bloom, 1.25x), High (bloom, 1.5x, 8 lights).

## Layout
Ground courtyard (bar, Trabant, plant rack with lifebuoy) → wooden stairs on the east side → 1st-floor ring balcony → narrow brick stairwell (west) → 2nd-floor north balcony.
