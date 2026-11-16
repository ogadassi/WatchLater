// Builds the Chrome Web Store images (screenshots + promo tiles) as HTML, then renders them to PNG.
// Run from the project folder:  node store/build-store-images.mjs
// Rendering uses the logo-design skill's render_png.py (headless Chrome).
//
// All content is invented: abstract thumbnails, made-up titles and channels. No YouTube branding.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'listing', 'src');
const OUT = join(HERE, 'listing');
const RENDER = 'C:/Users/Administrator/.claude/skills/logo-design/scripts/render_png.py';
mkdirSync(SRC, { recursive: true });

const LOGO = readFileSync(join(HERE, 'logo', 'final-symbol.svg'), 'utf8');

// --- Icons (same paths the extension uses) ---
const I = {
  clock: '<svg viewBox="0 0 24 24"><path d="M14.97 16.95 10 13.87V7h2v5.76l4.03 2.49-1.06 1.7zM12 3c-4.96 0-9 4.04-9 9s4.04 9 9 9 9-4.04 9-9-4.04-9-9-9m0-1c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M11 17H9V8h2v9zm4-9h-2v9h2V8zm4-4v1h-1v16H6V5H5V4h4V3h6v1h4zm-2 1H7v15h10V5z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 14 3.23z"/></svg>',
  cc: '<svg viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1z"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1l-.4-2.7h-4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.7h4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
  cursor: '<svg viewBox="0 0 24 24" class="cursor"><path d="M5 2l14 13h-7.5l4.2 7.6-2.8 1.4-4.2-7.7L5 21z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>',
};

// Abstract thumbnails: gradient + simple shapes (no real content)
const THUMBS = [
  'background:linear-gradient(135deg,#f7b267 0%,#f4845f 55%,#c8553d 100%)',
  'background:linear-gradient(160deg,#1d3557 0%,#457b9d 60%,#a8dadc 100%)',
  'background:linear-gradient(135deg,#2a9d8f 0%,#264653 100%)',
  'background:linear-gradient(135deg,#8338ec 0%,#3a0ca3 100%)',
  'background:linear-gradient(135deg,#ffbe0b 0%,#fb5607 100%)',
  'background:linear-gradient(160deg,#606c38 0%,#283618 100%)',
];
const SHAPES = [
  '<div class="sh" style="width:38%;height:62%;left:12%;bottom:0;border-radius:50% 50% 0 0;background:rgba(255,255,255,.22)"></div><div class="sh" style="width:22%;aspect-ratio:1;right:14%;top:18%;border-radius:50%;background:rgba(255,240,200,.85)"></div>',
  '<div class="sh" style="left:0;right:0;bottom:0;height:38%;background:rgba(10,20,40,.55);clip-path:polygon(0 60%,18% 20%,36% 55%,55% 5%,76% 50%,100% 25%,100% 100%,0 100%)"></div><div class="sh" style="width:14%;aspect-ratio:1;left:20%;top:16%;border-radius:50%;background:#fff3"></div>',
  '<div class="sh" style="width:56%;height:10%;left:22%;top:30%;border-radius:8px;background:#ffffff40"></div><div class="sh" style="width:40%;height:10%;left:30%;top:48%;border-radius:8px;background:#ffffff2a"></div>',
  '<div class="sh" style="width:44%;aspect-ratio:1;left:28%;top:10%;border-radius:50%;border:10px solid #ffffff44"></div>',
  '<div class="sh" style="width:30%;height:70%;left:35%;bottom:0;background:#ffffff35;border-radius:12px 12px 0 0"></div>',
  '<div class="sh" style="width:70%;height:24%;left:15%;bottom:16%;border-radius:40px;background:#ffffff26"></div><div class="sh" style="width:18%;aspect-ratio:1;left:41%;top:14%;border-radius:50%;background:#fefae0bb"></div>',
];

const VIDEOS = [
  { t: 'Building a standing desk from one plank of oak', c: 'Workshop Notes', a: '#e76f51', v: '214K views', d: '3 days ago', len: '18:42' },
  { t: 'Why bridges hum in the wind', c: 'Structures', a: '#457b9d', v: '1.2M views', d: '2 weeks ago', len: '12:07' },
  { t: 'Learn shortcuts in 10 minutes', c: 'Desk Setup', a: '#2a9d8f', v: '86K views', d: '1 day ago', len: '10:15' },
  { t: 'The quietest room on Earth, explained', c: 'Field Sound', a: '#8338ec', v: '640K views', d: '5 days ago', len: '21:30' },
  { t: 'Sourdough at 3,000 metres', c: 'High Kitchen', a: '#fb5607', v: '92K views', d: '1 week ago', len: '15:58' },
  { t: 'A week of slow travel by train', c: 'Rail Days', a: '#606c38', v: '410K views', d: '4 days ago', len: '27:11' },
];

const thumb = (i, extra = '') =>
  `<div class="thumb" style="${THUMBS[i]}">${SHAPES[i]}<span class="len">${VIDEOS[i].len}</span>${extra}</div>`;

// state: 'add' | 'add-hover' | 'saved' | 'remove-hover'
function wlButton(state, tip) {
  const icon = state === 'saved' ? I.check : state === 'remove-hover' ? I.x : I.clock;
  return `<div class="wl ${state}">${icon}${tip ? `<span class="tip">${tip}</span>` : ''}${state.endsWith('hover') ? I.cursor : ''}</div>`;
}

function card(i, state = 'add', tip = '', extraClass = '') {
  const v = VIDEOS[i];
  return `<div class="card ${extraClass}">
    ${thumb(i)}
    <div class="meta">
      <div class="av" style="background:${v.a}">${v.c[0]}</div>
      <div class="txt"><div class="title">${v.t}</div><div class="sub">${v.c} · ${v.v} · ${v.d}</div></div>
      <div class="btns">${wlButton(state, tip)}<div class="dots">${I.dots}</div></div>
    </div>
  </div>`;
}

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:W;height:H;overflow:hidden}
body{font-family:"Segoe UI","Roboto",system-ui,sans-serif;color:#f1f1f1;
  background:radial-gradient(120% 90% at 50% 0%,#1d6b45 0%,#0f3a26 45%,#08160f 100%);position:relative}
.head{position:absolute;left:0;right:0;top:56px;text-align:center}
.head h1{font-size:50px;font-weight:700;letter-spacing:-.5px;color:#fff}
.head p{margin-top:12px;font-size:22px;color:#cfe8da;font-weight:400}
.brand{position:absolute;left:40px;top:34px;display:flex;align-items:center;gap:10px;font-size:15px;color:#cfe8da;font-weight:600;opacity:.9}
.brand svg{width:28px;height:28px}
.frame{position:absolute;left:80px;right:80px;bottom:0;height:540px;background:#0f0f0f;border-radius:18px 18px 0 0;
  box-shadow:0 -10px 60px rgba(0,0,0,.45);border:1px solid #ffffff14;border-bottom:none;overflow:hidden}
.grid{display:flex;gap:22px;padding:40px 44px}
.card{width:330px;flex:none}
.thumb{position:relative;width:100%;aspect-ratio:16/9;border-radius:12px;overflow:hidden}
.sh{position:absolute}
.len{position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.8);font-size:13px;font-weight:600;padding:2px 5px;border-radius:4px}
.meta{display:flex;gap:12px;margin-top:12px;position:relative}
.av{width:36px;height:36px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:700;font-size:16px;color:#fff}
.txt{flex:1;min-width:0;padding-right:66px}
.title{font-size:16px;font-weight:600;line-height:22px;color:#f1f1f1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sub{font-size:14px;color:#aaa;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.btns{position:absolute;right:-10px;top:-6px;display:flex}
.dots,.wl{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;position:relative}
.dots svg,.wl>svg:not(.cursor){width:24px;height:24px;fill:#aaa}
.dots svg{fill:#f1f1f1}
.wl.add-hover{background:rgba(255,255,255,.12)}
.wl.add-hover>svg:not(.cursor){fill:#fff}
.wl.saved>svg:not(.cursor){fill:#2ecc71}
.wl.remove-hover{background:rgba(255,255,255,.12)}
.wl.remove-hover>svg:not(.cursor){fill:#e74c3c}
.cursor{position:absolute;width:30px;height:30px;left:22px;top:20px;z-index:5}
.tip{position:absolute;bottom:48px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#f1f1f1;color:#0f0f0f;
  font-size:14px;font-weight:600;padding:8px 12px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.4)}
.ring{position:absolute;border:3px solid #2ecc71;border-radius:50%;box-shadow:0 0 0 8px rgba(46,204,113,.18)}
.callout{position:absolute;background:#2ecc71;color:#06210f;font-weight:700;font-size:16px;padding:10px 16px;border-radius:999px;white-space:nowrap}
.dim{opacity:.45}
`;

function page(w, h, body, extraCss = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS.replace('W', w + 'px').replace('H', h + 'px')}${extraCss}</style></head><body>${body}</body></html>`;
}

const brand = `<div class="brand">${LOGO}<span>Watch Later Manager</span></div>`;

const shots = {};

// 1. Hero: one click to save
shots['screenshot-1-one-click'] = page(1280, 800, `${brand}
<div class="head"><h1>Watch Later in one click</h1><p>A clock button on every video. Click it and it's saved. No menus.</p></div>
<div class="frame"><div class="grid">
  ${card(0, 'add', '', 'dim')}
  ${card(1, 'add-hover', 'Add to Watch Later')}
  ${card(2, 'add', '', 'dim')}
</div>
<div class="grid" style="padding-top:0">
  ${card(3, 'add', '', 'dim')}${card(4, 'saved', '', 'dim')}${card(5, 'add', '', 'dim')}
</div></div>`);

// 2. Saved state + one-click remove
shots['screenshot-2-saved'] = page(1280, 800, `${brand}
<div class="head"><h1>See what's already saved</h1><p>A green check marks videos in your list. Hover it to remove in one click.</p></div>
<div class="frame"><div class="grid" style="justify-content:center;gap:60px;padding-top:56px">
  <div style="position:relative">${card(3, 'saved')}<div class="callout" style="left:352px;top:312px">Saved</div></div>
  <div style="position:relative">${card(4, 'remove-hover', 'Remove from Watch Later')}</div>
</div></div>`, '.frame .card{width:440px}');

// 3. Player button
shots['screenshot-3-player'] = page(1280, 800, `${brand}
<div class="head"><h1>Save right from the player</h1><p>The same button sits in the player controls, next to captions and settings.</p></div>
<div class="frame" style="padding:34px 44px">
  <div class="player">
    ${thumb(1)}
    <div class="bar">
      <div class="prog"><div class="done"></div><div class="knob"></div></div>
      <div class="ctl">
        <div class="l">${I.play}${I.next}${I.vol}<span class="time">4:12 / 12:07</span></div>
        <div class="r"><div class="pwl">${I.clock}<span class="tip">Add to Watch Later</span>${I.cursor}</div>${I.cc}${I.gear}${I.full}</div>
      </div>
    </div>
  </div>
</div>`, `
.player{position:relative;width:100%;border-radius:12px;overflow:hidden}
.player .thumb{border-radius:0;aspect-ratio:auto;height:470px}
.player .len{display:none}
.bar{position:absolute;left:0;right:0;bottom:0;padding:0 18px 10px;background:linear-gradient(transparent,rgba(0,0,0,.75))}
.prog{position:relative;height:5px;background:#ffffff40;border-radius:3px;margin-bottom:10px}
.prog .done{position:absolute;left:0;top:0;bottom:0;width:34%;background:#2ecc71;border-radius:3px}
.prog .knob{position:absolute;left:34%;top:50%;width:14px;height:14px;border-radius:50%;background:#2ecc71;transform:translate(-50%,-50%)}
.ctl{display:flex;justify-content:space-between;align-items:center;height:52px}
.ctl svg{width:34px;height:34px;fill:#fff}
.ctl .l,.ctl .r{display:flex;align-items:center;gap:18px}
.time{font-size:17px;color:#fff;margin-left:4px}
.pwl{position:relative;width:52px;height:52px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.14);outline:3px solid #2ecc71;outline-offset:2px}
.pwl .tip{bottom:64px}
.pwl .cursor{left:30px;top:28px}
`);

// 4. Watch Later page cleanup
const row = (i, idx, hover = false, leaving = false) => {
  const v = VIDEOS[i];
  return `<div class="row ${leaving ? 'leaving' : ''}"><span class="n">${idx}</span>
    <div class="rt">${thumb(i)}</div>
    <div class="rtxt"><div class="title">${v.t}</div><div class="sub">${v.c} · ${v.v} · ${v.d}</div></div>
    <div class="trash ${hover ? 'hov' : ''}">${I.trash}${hover ? `<span class="tip">Remove from Watch Later</span>${I.cursor}` : ''}</div><div class="dots">${I.dots}</div></div>`;
};
shots['screenshot-4-cleanup'] = page(1280, 800, `${brand}
<div class="head"><h1>Clean up your list fast</h1><p>On your Watch Later page, one click on the trash button removes a video.</p></div>
<div class="frame" style="padding:30px 60px">
  ${row(0, 1)}${row(5, 2, true)}${row(2, 3, false, true)}${row(4, 4)}
</div>`, `
.row{display:flex;align-items:center;gap:16px;padding:10px 12px;border-radius:12px}
.row .n{width:20px;color:#aaa;font-size:15px;text-align:center}
.rt{width:200px;flex:none}.rt .thumb{border-radius:10px}
.rtxt{flex:1;min-width:0}.rtxt .title{font-size:18px}
.trash{position:relative;width:44px;height:44px;border-radius:50%;display:grid;place-items:center}
.trash>svg:not(.cursor){width:26px;height:26px;fill:#f1f1f1;opacity:.75}
.trash.hov{background:rgba(255,255,255,.12)}.trash.hov>svg:not(.cursor){opacity:1}
.row:has(.trash.hov){background:#ffffff0d}
.leaving{opacity:.35;transform:translateX(-24px)}
.tip{bottom:54px}
`);

// Promo tiles
const promoCss = `
body{display:flex;align-items:center}
.pl{display:flex;align-items:center;gap:GAPpx;padding-left:PADpx}
.pl .mark svg{width:MARKpx;height:MARKpx;display:block;filter:drop-shadow(0 10px 30px rgba(0,0,0,.35))}
.pl h1{font-size:NAMEpx;font-weight:700;color:#fff;letter-spacing:-.5px;line-height:1.05}
.pl p{font-size:TAGpx;color:#cfe8da;margin-top:10px}
`;
const promo = (w, h, mark, name, tag, gap, pad, extra = '') =>
  page(w, h, `<div class="pl"><div class="mark">${LOGO}</div><div><h1>Watch Later<br>Manager</h1><p>One-click Watch Later for YouTube</p></div></div>${extra}`,
    promoCss.replace('GAP', gap).replace('PAD', pad).replace(/MARK/g, mark).replace('NAME', name).replace('TAG', tag));

shots['promo-small-440x280'] = promo(440, 280, 96, 34, 15, 22, 34);
const marqueeCards = `<div style="position:absolute;right:-30px;top:70px;transform:rotate(-4deg);display:flex;flex-direction:column;gap:18px;background:#0f0f0f;padding:26px;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.5)">
  <div style="display:flex;gap:18px">${card(1, 'add-hover', 'Add to Watch Later')}${card(3, 'saved')}</div></div>`;
shots['promo-marquee-1400x560'] = promo(1400, 560, 170, 64, 24, 40, 90, marqueeCards);

const sizes = {
  'screenshot-1-one-click': [1280, 800], 'screenshot-2-saved': [1280, 800], 'screenshot-3-player': [1280, 800],
  'screenshot-4-cleanup': [1280, 800], 'promo-small-440x280': [440, 280], 'promo-marquee-1400x560': [1400, 560],
};

for (const [name, html] of Object.entries(shots)) {
  const src = join(SRC, `${name}.html`);
  writeFileSync(src, html);
  const [w, h] = sizes[name];
  execFileSync('python', [RENDER, src, '-o', join(OUT, `${name}.png`), '--width', String(w), '--height', String(h)], { stdio: 'inherit' });
}
