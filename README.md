# JSplayer

A music player with a live audio visualizer. Vanilla JS, no build step, no dependencies.

Tracks, cover art and synced lyrics are streamed from free public APIs, so there are no media files in the repo.

![JSplayer](docs/screenshots/bars.png)

## Visualizer modes

Switch with the buttons in the bottom right corner or the `V` key.

| Bars | Wave |
|---|---|
| ![Bars](docs/screenshots/bars.png) | ![Wave](docs/screenshots/wave.png) |
| **Radial** | **Sparks** |
| ![Radial](docs/screenshots/radial.png) | ![Sparks](docs/screenshots/sparks.png) |

The player card keeps its original design. Everything around it is new.

## Features

- **Four visualizer modes**: smooth spectrum silhouette, layered waves, radial ring and a spark fountain
- **Colors from the album art**: the scene re-tints itself for every track
- **Beat detection**: the background pulses on bass hits, sparks fly on the beat
- **Search** across millions of tracks and a trending list
- **Synced lyrics** (karaoke style) when a match exists
- Shuffle, drag-to-seek, volume wheel, keyboard shortcuts, OS media keys
- Responsive: works on phones

## Run

No build and no install. The code uses ES modules, so serve the folder with any static server (opening `index.html` from disk will not work):

```bash
python3 -m http.server 8000
```

Open http://localhost:8000.

Music starts only after a click: browsers block autoplay with sound.

## Data sources

| Source | What for | Key |
|---|---|---|
| [Audius](https://audius.co) | tracks, covers, search | not needed |
| [LRCLIB](https://lrclib.net) | synced lyrics | not needed |
| [Jamendo](https://developer.jamendo.com) (optional) | Creative Commons tracks | free `client_id` |

Jamendo is wired in but **off by default**: its audio server does not send CORS headers, so the browser can play those tracks but cannot analyse them, and the visualizer would stay silent. Audius works fully. To try Jamendo anyway, put your `client_id` into `config.js`.

## Keyboard

| Key | Action |
|---|---|
| `Space` | play / pause |
| `←` `→` | seek 5 s |
| `↑` `↓` or wheel over the speaker icon | volume |
| `N` / `P` | next / previous |
| `S` | shuffle |
| `M` | mute |
| `V` | next visualizer mode |
| `/` | focus search |

## Project structure

```
index.html
css/
  layout.css      page, scene and card position
  player.css      the player card
  panels.css      track list and lyrics panels
  widgets.css     mode switcher, toast, small elements
js/
  main.js         entry point, wires everything together
  player.js       playback engine: queue, volume, audio analyser (no DOM)
  player-ui.js    binds the engine to the card
  track-list.js   track list, search, mobile drawer
  controls.js     mode switcher, keyboard, media keys
  lyrics.js       synced lyrics from LRCLIB
  dom.js          every DOM lookup in one place
  music/          one module per service, merged in index.js
  visualizer/     canvas scene: analysis, palette, one file per mode
assets/           fonts and icons
docs/screenshots/ README images
```

## How it works

- The audio element feeds a Web Audio `AnalyserNode`. `visualizer/` turns the spectrum into 72 log-spaced bands, smooths them, detects beats from bass jumps and hands drawing to the selected mode.
- The dominant hue of the cover art (`visualizer/palette.js`) becomes the scene palette.
- Every music service returns tracks in one shape, so adding a source means adding one file in `js/music/`.
- The Web Audio analyser needs CORS-enabled audio, which is why the audio source matters.

## Performance notes

The scene is drawn on a 1x canvas even on Retina screens and avoids `shadowBlur` and `backdrop-filter`: both were measured to drop the frame rate noticeably.

## Credits

Music streamed from Audius (artists keep their rights, check each track's terms). Lyrics by LRCLIB.
