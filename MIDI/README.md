# iPad MIDI Surface

A wireless MIDI control surface for **MainStage 3**. It runs in **Safari on an iPad**
and sends MIDI to a Mac over the venue's local wifi — no internet required.

## Why this architecture

Safari on iOS does **not** support the Web MIDI API, and every browser on iPadOS is
WebKit underneath (Chrome, Firefox, etc. are no different). The iPad therefore cannot
send MIDI directly. The signal path is:

```
iPad Safari  ──WebSocket (local wifi)──▶  Node server on the Mac
                                          ──easymidi──▶  IAC / virtual MIDI port
                                                          ──▶  MainStage
```

Do **not** try to use `navigator.requestMIDIAccess()` in the browser — it does not exist
on iOS and never has.

## Files

| File             | Purpose                                                        |
|------------------|----------------------------------------------------------------|
| `server.js`      | Node server: serves the page, runs the WebSocket + MIDI bridge |
| `package.json`   | Declares dependencies (`ws`, `easymidi`)                        |
| `public/index.html` | The control surface UI (self-contained, no build step)       |
| `README.md`      | This file                                                       |

There is **no build step, no bundler, and no framework**. Plain Node, plain HTML/CSS/JS.

---

## 1. Enable the IAC Driver on the Mac

The IAC Driver is macOS's built-in virtual MIDI cable. The server normally creates its
own virtual port (`iPad Surface`), but if that ever fails it falls back to IAC, so IAC
should be turned on regardless.

1. Open **Audio MIDI Setup** (in `/Applications/Utilities`, or Spotlight it).
2. From the menu bar choose **Window ▸ Show MIDI Studio**.
3. Double-click **IAC Driver**.
4. Tick **"Device is online"**.
5. Close the window.

You should now see an **IAC Driver Bus 1** port in any MIDI app.

---

## 2. Install and start the server

You need [Node.js](https://nodejs.org) installed on the Mac (version 18 or newer).
Open **Terminal** and run:

```bash
cd /path/to/this/folder
npm install
npm start
```

`npm install` downloads the two dependencies the first time (this needs internet **once**;
after that the server runs fine with no internet). `npm start` launches the server.

---

## 3. Find the URL and open it on the iPad

When the server starts it prints a banner. **The most important line** looks like this:

```
    >>>  http://192.168.1.42:3000   <<<
```

- Use the address that matches the wifi network the iPad is on.
- On the iPad, open **Safari** and type that URL exactly (including `http://` and `:3000`).
- If you see no address in the banner, the Mac isn't on a network — join the venue wifi
  and restart with `npm start`.

The page shows a connection status light at the top:

- **Green "Connected"** — talking to the Mac.
- **Red "Disconnected — retrying"** — the iPad will keep trying to reconnect forever.
  Your fader positions are remembered and re-sent automatically.

---

## 4. Add it to the iPad home screen (fullscreen)

For hands-on, distraction-free use:

1. In Safari, tap the **Share** button (square with an arrow).
2. Tap **Add to Home Screen**.
3. Name it (e.g. "MIDI Surface") and tap **Add**.

Now launch it from the home screen icon. Because of the
`<meta name="apple-mobile-web-app-capable" content="yes">` tag, it opens fullscreen with
no Safari toolbars and the screen stays awake.

---

## 5. Wire it up in MainStage 3

1. In MainStage, go to **Layout** mode (the first mode).
2. Add the **Screen Controls** you want (faders / buttons), or just map existing ones.
3. For each control: click it, then click **Learn** (or use the MIDI Learn window) and
   move/send the corresponding control on the iPad.
4. MIDI arrives on **channel 16** from a port named either **"iPad Surface"** (the
   virtual port the server creates) or the **IAC bus** (the fallback). Select that port
   as the input in MainStage's MIDI input preferences.

### Default mapping

| Control         | Type              | CC / Message | Channel |
|-----------------|-------------------|--------------|---------|
| PITCH wheel     | pitch bend        | pitch (0–16383, 8192 = center) | 16 |
| MOD wheel       | vertical wheel    | 1 (mod wheel) | 16 |
| QUAD pad (X)    | XY pad            | pitch (same as PITCH wheel) | 16 |
| QUAD pad (Y)    | XY pad            | CC 1 (same as MOD wheel) | 16 |
| Faders F1–F8    | vertical fader    | 20–27 | 16   |
| Knobs K1–K8     | rotary knob       | 30–37 | 16   |
| Patch Vol 1–8   | vertical fader    | 80–87 | 16   |
| Reverb ON/OFF   | toggle button     | 90 | 16   |
| Reverb DRY      | vertical fader    | 91 | 16   |
| Reverb WET      | vertical fader    | 95 | 16   |
| Reverb SIZE     | vertical fader    | 92 | 16   |
| Reverb DAMP     | vertical fader    | 93 | 16   |
| Reverb PREDELAY | vertical fader    | 94 | 16   |
| Reverb DECAY    | rotary knob       | 96 | 16   |
| Reverb TONE     | rotary knob       | 97 | 16   |
| Reverb WIDTH    | rotary knob       | 98 | 16   |
| Reverb DIFF     | rotary knob       | 99 | 16   |
| Reverb MOD      | rotary knob       | 100 | 16   |
| EQ ON/OFF       | toggle button     | 101 | 16   |
| EQ LOW Gain     | vertical fader    | 102 | 16   |
| EQ LO-MID Gain  | vertical fader    | 103 | 16   |
| EQ HI-MID Gain  | vertical fader    | 104 | 16   |
| EQ HIGH Gain    | vertical fader    | 105 | 16   |
| EQ LOW Freq     | rotary knob       | 106 | 16   |
| EQ LO-MID Freq  | rotary knob       | 107 | 16   |
| EQ HI-MID Freq  | rotary knob       | 108 | 16   |
| EQ HIGH Freq    | rotary knob       | 109 | 16   |
| EQ LOW Q        | rotary knob       | 111 | 16   |
| EQ LO-MID Q     | rotary knob       | 112 | 16   |
| EQ HI-MID Q     | rotary knob       | 113 | 16   |
| EQ HIGH Q       | rotary knob       | 114 | 16   |
| F1–F8 Mute (M)  | toggle button     | 50–57 | 16   |
| F1–F7 Solo (S)  | toggle button     | 70–76 | 16   |
| Buttons B1–B8   | Note On/Off (trigger) | 60–67 (C5–G5) | 16   |
| PANIC           | button            | 123 | all 16  |

The **PANIC** button sends **CC 123 value 0 on all 16 channels** — the standard
"all notes off / reset" message — so a stuck drone is instantly silenced.

> The piano plays on channel 1; everything from the iPad is deliberately on channel 16
> so the two never collide.

---

## 6. Troubleshooting

**No MIDI port appears / MainStage can't see the input**
- Confirm the IAC Driver is online (Section 1).
- Check the server's startup log. It prints which port it bound to, e.g.
  `Created virtual output "iPad Surface"` or `Falling back to existing IAC output "IAC Driver Bus 1"`.
- If you see `No MIDI output available. Exiting.`, enable IAC and restart `npm start`.
- In MainStage ▸ Preferences ▸ MIDI, make sure the **iPad Surface** or **IAC** port is
  enabled as an input.

**The iPad can't reach the server**
- Both devices must be on the **same wifi network**.
- Many venue/event networks are **guest networks with client isolation** (devices can
  reach the internet but not each other). This will not work on such a network. Use a
  normal network, or create a local hotspot from the Mac and join that with the iPad.
- Make sure the Mac's firewall allows incoming connections on port 3000, or temporarily
  disable the firewall for the test.
- Double-check the IP in the banner matches the iPad's wifi IP (Settings ▸ Wi-Fi ▸ the
  network's info ▸ IP Address).

**The page loads but controls do nothing**
- The status light should be green. If red, see above — it's a network/reachability issue,
  not a code issue. The server logs every message it receives to the Terminal, so you can
  confirm there whether the iPad is getting through.

**I changed the HTML and it didn't update**
- The server sends `Cache-Control: no-store`, but Safari may cache anyway. Reload with a
  fresh load (home-screen app: close and reopen; Safari: pull-to-refresh won't work since
  scrolling is disabled — quit and relaunch Safari).

---

## Stopping the server

In the Terminal where it's running, press **Control-C**. To run it permanently during a
session, just leave that Terminal window open.
