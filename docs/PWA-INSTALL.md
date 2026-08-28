# Install and launch: manifest, icons, and the splash screen

What an installed Croft PWA looks like between the tap and the first frame, and
what you have to supply to control it.

Written 2026-08-28 after getting it wrong out loud. The short version, if you
read nothing else: **the splash screen you actually control is a page you write,
not a manifest field.**

## The three things people call "the splash screen"

They are different mechanisms with different inputs, and conflating them is how
you end up commissioning art nothing will ever display.

### 1. The platform splash — Android composes it, you cannot supply an image

Chrome on Android shows a splash for an installed PWA. It **generates** it:

| Manifest field | What it becomes |
|---|---|
| `background_color` | the fill behind everything |
| `icons` (a large raster one) | the centred image |
| `name` | the text beneath it |

There is **no manifest member that takes a splash image**. If you have seen a
handsome Android PWA splash, you have seen either this composition or the trick
in §2 — not a picture handed to Chrome.

So on Android your **icon is your splash art**, and `background_color` is the
only other lever. Get those two right and Android is done.

> Verify rather than trust this table on the exact icon Chrome picks: the size
> threshold and raster-vs-SVG behaviour have moved between versions. **This repo
> currently ships an SVG-only icon set** (`manifest.webmanifest` → `icons`), which
> is a plausible way to end up with no image on the generated splash at all.
> Nobody here has checked it on a device. That check is worth doing before
> anything is concluded from it.

### 2. The splash page — `start_url` pointing at a page you wrote

This is the one that gives you a designed splash, and it works on **every**
platform because it is not a platform feature at all:

```json
{ "start_url": "/splash.html" }
```

The installed app launches into an ordinary HTML page. It shows whatever you
want — full-bleed art, a logo, a loading state, a version string — and then hands
off:

```js
setTimeout(() => { location.href = "index.html"; }, 3000);
document.addEventListener("click",   () => { location.href = "index.html"; });
document.addEventListener("keydown", () => { location.href = "index.html"; });
```

Three rules, each earned:

- **`background_color` must match the splash page's background.** Chrome still
  paints its generated splash (§1) for a beat before your page renders. Mismatch
  them and every launch flashes white into a dark page.
- **Always dismissible.** Three seconds is a long time on the fiftieth launch.
  Tap and key both skip it.
- **Remember it is also a URL.** `start_url` is where the *installed* app opens,
  but a plain web visitor who follows that link gets the splash too. Keep the
  real entry point separately reachable.

Reference: `chasemp/blockdoku_pwa` does exactly this — `start_url: "/splash.html"`,
a 1024² transparent-background logo centred on a themed gradient, version in the
corner, dismiss on tap or key. It even re-reads the theme from `localStorage` so
the splash matches the theme you last chose.

### 3. iOS startup images — the only place you supply pictures

Safari wants `apple-touch-startup-image`, one `<link>` per device class, at
**exact pixel sizes**, portrait *and* landscape:

```html
<link rel="apple-touch-startup-image"
      media="(device-width: 393px) and (device-height: 852px)
             and (-webkit-device-pixel-ratio: 3)
             and (orientation: portrait)"
      href="/splash/iphone-15-portrait.png">
```

Miss a device and that device gets a blank flash. This is the highest-effort
path for the narrowest gain, and **§2 makes it largely unnecessary** — a splash
page renders on iOS too.

## What to commission

Given the above, the order that actually pays:

1. **A square raster icon, 512² or larger.** Doubles as the home-screen icon and
   the Android splash image. This is the one asset that is never wasted.
2. **A `background_color` per app**, sampled from that icon. A dark-art app
   defaulting to white flashes white on every launch.
3. **A splash page** (§2), if the launch moment matters. Art for it can be any
   shape, because you are laying it out with CSS.
4. **iOS startup images**, only if you want the last few frames polished on one
   platform and are willing to maintain a per-device table.

Portrait "splash art" is worth commissioning for §3 and §4, and for nothing else.
It buys you nothing on Android.

## Where this repo stands

`manifest.webmanifest` here declares `name`, `short_name`, `description`,
`start_url: index.html`, `scope`, `display: standalone`, `orientation`,
`theme_color`, `background_color` and one SVG icon.

Two gaps, named so they are not mistaken for decisions:

- **No splash page.** `start_url` goes straight to `index.html`, so the launch is
  whatever Chrome composes.
- **SVG-only icons**, with the caveat in §1 unverified.

Neither is urgent for a reference app that is mostly read rather than installed.
Both are the first things to fix if it is ever used as a launch-experience
exemplar, because a reference that has not exercised the path cannot demonstrate
it.
