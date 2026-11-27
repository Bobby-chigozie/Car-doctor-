# Bobby Car Doctor — Project README (28 Nov 2026)

Offline-first OBD-II diagnostic app for mechanics in Nigeria/Africa. Built as an
Android app (Capacitor), works fully offline except one button ("Search online").

## What it does

- **Scan a real car** via a Bluetooth ELM327 adapter (generic/standard adapters only —
  Launch, GOLO, DiagZone and similar locked/proprietary adapters are NOT supported).
- **Look up any OBD-II code offline** from a built-in database of 662 codes, with causes,
  checks, and safety urgency.
- **Diagnose from symptoms** — tap-based checklist, no typing required, for mechanics
  who prefer not to type.
- **Keep a vehicle log** — by plate number or owner name, so repeat customers build a
  history beyond the normal 7-day rolling history.
- **Generate a job sheet** — a clean, shareable summary to hand a customer.
- **Demo mode** — a fully simulated car (voltage, RPM, speed, coolant, fuel, and 3
  sample codes) so the app can be shown off with no adapter at all.
- **Search online** — the only feature that needs internet; opens the phone's own
  browser with the vehicle + code already searched.

## What it does NOT do (by design, not a bug)

A generic ELM327 + this app talks to the **engine/powertrain ECU only**, using the
standard OBD-II modes (01 live data, 03/07 trouble codes, 02 freeze frame). It cannot
read **ABS, airbag/SRS, steering, TPMS, body control**, or any other module — those
live on separate ECUs with their own manufacturer-specific protocols, which only
proprietary/dealer-level tools (the Launch/GOLO/DiagZone-type tools, at a cost) can
decode. "No codes stored" from a scan only ever means the engine ECU is clear — it
says nothing about ABS/airbag, which this app never asks about.

## Current state (what's confirmed working on real hardware)

- Protocol auto-detect with fallback — **field-confirmed** on a real ELM327 + real
  car (status line visibly tried protocols A, B, etc. until the car answered).
- Full real scan on a Lexus RX — **confirmed**, returned genuine codes P0017 and P0020.
- Live data (speed/RPM/coolant/fuel) now also starts automatically right after a
  successful scan, not only at connect time.
- Bluetooth paired-device list now refreshes itself when you return to the app from
  Android's Bluetooth settings (previously needed a force-close).
- Scan screen now shows a plain-English connection status card (Adapter connected /
  Adapter responding / Vehicle ECU communication / Live-data PIDs supported) instead
  of raw AT-command text by default. The raw log is still there for troubleshooting,
  behind Settings → "Show raw adapter log" (off by default).
- Screen order: Scan comes before Diagnose. Diagnose auto-scans the car when
  connected and the code box is left blank; typing a code manually still always works.
- Hardware/gesture Back button: fixed to go to the previous screen instead of exiting
  the app — **not yet confirmed on a real phone**, this is the newest change.

## Files in the project

| File | What it's for |
|---|---|
| `index.html` | All screen markup (Home, Scan, Diagnose, Results, Battery, History, Settings, Job sheet, Symptoms, Vehicle log, Fix/Details) |
| `app.js` | App logic: navigation/history, diagnose flow, settings, vehicle log, job sheet, symptom-first lookup, back-button handling |
| `scanner.js` | Everything Bluetooth/OBD: connect, AT commands, protocol fallback, scan, live data, demo mode |
| `obd.js` | OBD-II protocol helpers: PID table, response parsing, DTC decoding |
| `dtc-database.js` | 662 trouble-code entries (code, meaning, causes, checks, urgency) |
| `style.css` | All visual styling |
| `patch.js` | Build-time script — registers the native Bluetooth plugin, Android permissions, app name/icon during the GitHub Actions build |
| `package.json` | Capacitor/Android dependencies |
| `capacitor.config.json` | App ID, name, web folder |
| `.github/workflows/build-apk.yml` | Builds the APK automatically on every push to `main` |

## How updates get to your phone

1. I send a small zip with only the changed file(s) + a `READ_ME_FIRST.txt`.
2. You replace those exact files in your GitHub repo (upload/edit directly in the
   GitHub app — no git commands needed).
3. Commit — GitHub Actions rebuilds the APK by itself. Download it from the Actions
   tab once it finishes, install, test.

## Not yet done / worth re-checking

- The hardware back-button fix (needs `package.json` + `app.js` from today) — please
  confirm on your phone once installed.
- A full regression pass covering every feature at once hasn't been re-run since the
  container that hosts this session was reset a few days ago; each individual change
  since then has been tested on its own, but not all together in one sweep.
- Real-car testing is still limited to 3 vehicles: an old car that never answered on
  any protocol (likely pre-OBD-II or a bad port, not an app problem), a Lexus RX
  (full success), and a school workshop training board (engine ECU reported clear —
  expected, see "What it does NOT do" above for why ABS/airbag never show).

## Known open items from you

- Buying/using an adapter: confirmed a genuine ELM327 works; your current one is
  field-tested and working.
- Business side (pricing, customer outreach, Jumia adapter, Fiverr) — covered in
  chat, not part of the code.
