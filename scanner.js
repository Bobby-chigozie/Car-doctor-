'use strict';
try { window.acdFlags && (window.acdFlags.scan = 1); } catch (e) { /* ignore */ }
/* Bobby Car Doctor — scanner.js
   Android app only. Talks to a Bluetooth OBD-II adapter through the native ObdBluetooth plugin
   (ObdBluetoothPlugin.java): scan codes, clear codes (always asks first), live battery voltage
   (shown at the top right), live data, VIN, emissions readiness and freeze-frame.
   Everything here only READS from the car, except "Clear codes", which asks for confirmation.
   In a normal web browser it only shows a short note. */
(function () {
  const isNative = !!(window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform());
  if (!isNative) return;            // browser / editor: nothing to show, the tiles are hidden by app.js
  const scanMount = document.getElementById('scanMount'), liveMount = document.getElementById('liveMount');
  if (!scanMount || !liveMount) return;
  const card = document.createElement('div');
  card.id = 'scanCard';
  scanMount.appendChild(card);

  card.innerHTML =
    '<div class="row-between"><span class="conn-pill off" id="connPill">Not connected</span></div>' +
    '<div class="field"><label for="adapterSel">Bluetooth adapter</label><select id="adapterSel"><option value="">Looking for devices…</option></select></div>' +
    '<div class="actions"><button class="primary" id="scanBtn" type="button">Scan car</button><button class="secondary" id="connectBtn" type="button">Connect</button></div>' +
    '<div class="actions" style="margin-top:9px"><button class="secondary" id="findBtn" type="button">Find adapter</button><button class="secondary" id="clearCodesBtn" type="button">Clear codes</button></div>' +
    '<p id="scanStatus" class="hint" role="status">Plug in the adapter, turn the ignition ON, then tap Connect.</p>' +
    '<details class="compact-details"><summary>More tools</summary><div class="actions"><button class="secondary" id="testBtn" type="button">Test adapter</button><button class="secondary" id="refreshBtn" type="button">Refresh list</button></div><pre id="scanLog" class="small logbox" style="display:none"></pre></details>';

  // ---------- Live panel: battery, live data, vehicle info ----------
  const live = document.createElement('div');
  live.id = 'livePanel';
  live.innerHTML =
        '<div class="vbox"><div class="vbig"><b id="vBig">—</b><span> V</span></div><div class="vmeta"><strong id="vState">Not connected</strong><span id="vTrend" class="small muted"></span><span id="vMinMax" class="small muted"></span></div></div>' +
    '<svg id="vSpark" class="vspark" viewBox="0 0 300 60" preserveAspectRatio="none" aria-label="Voltage graph"><polyline id="vLine" fill="none" stroke="#35c8ff" stroke-width="2" points=""/></svg>' +
    '<div class="actions"><button class="secondary" id="vFastBtn" type="button">Fast mode: off</button><button class="secondary" id="vSaveBtn" type="button">Save test</button><button class="secondary" id="vCopyBtn" type="button">Copy readings</button><button class="secondary" id="vResetBtn" type="button">Reset</button></div>' +
    '<div id="vList" class="vlist"></div>' +
    '<details class="compact-details"><summary>How to read the voltage</summary><p class="muted small">General guide for a 12 V car battery. Exact values vary by car, battery age and temperature.<br>• Engine off, ignition on: about 12.4–12.9 V is healthy. Below about 12.0 V is weak.<br>• Engine running: about 13.2–14.8 V means the alternator is charging. Below about 13.0 V, check the alternator, belt and connections. Above about 15.0 V is overcharging.<br>• Cranking: use Fast mode and watch the lowest value. A big drop (below about 9.6 V) can mean a weak battery or poor connections.</p></details>' +
    '<div id="vSaved"></div>' +
    '<hr class="sep">' +
    '<div class="actions"><button class="secondary" id="liveBtn" type="button">Start live data</button><button class="secondary" id="infoBtn" type="button">VIN, readiness and freeze-frame</button></div>' +
    '<p id="liveNote" class="hint">Needs ignition ON. Values the car does not support are hidden.</p>' +
    '<div class="telemetry-grid" id="liveGrid"></div>' +
    '<div class="telemetry-info" id="infoBox"><p><b>VIN:</b> <span id="vinValue">Not read</span></p><p><b>Emissions readiness:</b> <span id="readinessValue">Not read</span></p><p><b>Freeze-frame:</b> <span id="freezeValue">Not read</span></p></div>';
  liveMount.appendChild(live);

  const $ = id => document.getElementById(id);
  const sel = $('adapterSel'), btn = $('scanBtn'), statusEl = $('scanStatus'), logEl = $('scanLog');
  const pill = $('voltPill');
  if (pill) pill.hidden = false;
  const Obd = Capacitor.registerPlugin('ObdBluetooth');
  let OBD = window.OBD, busy = false, connectedAddr = null, connectedTr = null, isCan = null;
  let pumpTimer = null, pumpRunning = false, pumpOn = false, liveOn = false, fast = false, voltFails = 0, voltSource = 'adapter';
  let reconnectTries = 0, reconnectTimer = null, wantLink = false, liveIdx = 0, liveMisses = 0, liveBlank = 0;
  const readings = [];
  const lastVals = {};
  const unsupported = {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const BTNS = ['scanBtn', 'connectBtn', 'findBtn', 'clearCodesBtn', 'testBtn', 'refreshBtn', 'liveBtn', 'infoBtn'];
  const setButtons = d => BTNS.forEach(id => { const e = $(id); if (e) e.disabled = d; });
  const say = (t, cls) => { statusEl.textContent = t; statusEl.style.color = cls === 'bad' ? '#ffb4a8' : cls === 'ok' ? '#92f3d7' : ''; };
  const log = t => { logEl.style.display = 'block'; logEl.textContent += t + '\n'; logEl.scrollTop = logEl.scrollHeight; };
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src + ' did not load')); document.head.appendChild(s); });
  const saved = () => { try { return localStorage.getItem('acd_adapter') || ''; } catch (e) { return ''; } };
  const save = a => { try { localStorage.setItem('acd_adapter', a); } catch (e) { /* ignore */ } };
  const savedTr = a => { try { return localStorage.getItem('acd_tr_' + a) || ''; } catch (e) { return ''; } };
  const saveTr = (a, t) => { try { localStorage.setItem('acd_tr_' + a, t); } catch (e) { /* ignore */ } };

  // ---------- one operation at a time on the link ----------
  async function begin(clearLog) {
    if (busy) return false;
    busy = true; setButtons(true);
    if (clearLog !== false) logEl.textContent = '';
    while (pumpRunning) await sleep(40);   // let the background reader finish its command first
    return true;
  }
  function end() { busy = false; setButtons(false); showConn(); }

  async function send(cmd, ms, idleMs, quiet) {
    if (!quiet) log('> ' + cmd);
    let r;
    try { r = await Obd.send({ command: cmd, timeoutMs: ms || 5000, idleMs: idleMs || 0 }); }
    catch (e) { connectedAddr = null; connectedTr = null; throw e; } // link dropped: force a fresh connection next time
    if (!quiet) log('< ' + JSON.stringify(r.response) + (r.hex ? '   [hex ' + r.hex + ']' : ''));
    return r.response || '';
  }

  // ---------- adapter list ----------
  const looksLikeAdapter = d => /^\d{10,14}$/.test(d.name || '') || /obd|elm|vlink|scan|v-?link|icar|veepeak|golo|launch|diag/i.test(d.name || '');

  function fillList(list, keep) {
    const cur = keep || sel.value;
    sel.innerHTML = '';
    list.forEach(d => { const o = new Option((d.name || 'Unnamed') + '  (' + d.address + ')', d.address); o.dataset.type = d.type || 'unknown'; sel.add(o); });
    const want = cur || saved();
    const pick = list.find(d => d.address === want) || list.find(looksLikeAdapter);
    if (pick) sel.value = pick.address;
    return !!pick;
  }

  async function refresh() {
    try {
      const r = await Obd.listPaired();
      const list = r.devices || [];
      if (!list.length) { sel.innerHTML = ''; sel.add(new Option('No paired devices found', '')); say('No paired Bluetooth devices. Tap "Find adapter" to search for the adapter (plug it into the car, ignition ON), or pair it in Android Bluetooth settings.', 'bad'); return false; }
      const picked = fillList(list);
      say(picked ? 'Ready. Tap "Connect" or "Scan car".' : 'Pick your adapter, or tap "Find adapter" to search for it (plug it into the car, ignition ON).', '');
      return picked;
    } catch (e) {
      sel.innerHTML = ''; sel.add(new Option('Bluetooth not available', ''));
      say(e.message || String(e), 'bad');
      return false;
    }
  }

  // Search nearby for Bluetooth LE adapters that are not paired in Android.
  async function findAdapter() {
    if (!(await begin())) return;
    try {
      say('Searching for nearby adapters… (about 6 seconds)', '');
      let paired = [];
      try { paired = (await Obd.listPaired()).devices || []; } catch (e) { /* paired list is optional here */ }
      const r = await Obd.scanLe({ durationMs: 6000 });
      const seen = {}; const all = [];
      paired.concat(r.devices || []).forEach(d => { if (!seen[d.address]) { seen[d.address] = 1; all.push(d); } });
      if (!all.length) { say('Nothing found. Check the adapter is plugged into the car with the ignition ON, turn Bluetooth on, and (Android 11 or older) turn Location on, then try again.', 'bad'); return; }
      const picked = fillList(all);
      say((r.devices || []).length + ' nearby device(s) found. ' + (picked ? 'Adapter selected. Tap "Connect" or "Scan car".' : 'Pick your adapter from the list.'), picked ? 'ok' : '');
    } catch (e) {
      say(e.message || String(e), 'bad');
    } finally { end(); }
  }

  // ---------- connection ----------
  const trName = t => t === 'ble' ? 'Bluetooth LE' : 'Bluetooth Classic';

  function showConn() {
    const cp = $('connPill'), cb = $('connectBtn');
    if (cp) { cp.textContent = connectedAddr ? 'Connected' + (connectedTr ? ' · ' + (connectedTr === 'ble' ? 'BLE' : 'Classic') : '') : 'Not connected'; cp.className = 'conn-pill ' + (connectedAddr ? 'on' : 'off'); }
    if (cb) cb.textContent = connectedAddr ? 'Disconnect' : 'Connect';
    if (!connectedAddr) setVoltUi(null);
  }

  async function ensureConnected(addr, tr) {
    if (connectedAddr === addr && connectedTr === tr) return;
    if (connectedAddr) { try { await Obd.disconnect(); } catch (e) { /* ignore */ } connectedAddr = null; connectedTr = null; }
    say('Connecting to adapter (' + trName(tr) + ')…', '');
    const r = await Obd.connect({ address: addr, transport: tr });
    log('Connected via ' + (r && r.method ? r.method : tr) + (r && r.serial ? ' (serial: ' + r.serial + ')' : ''));
    if (r && r.services) log('Services found:\n' + r.services.trim());
    connectedAddr = addr; connectedTr = tr; save(addr);
  }

  async function connectOrThrow(addr, tr) {
    try { await ensureConnected(addr, tr); }
    catch (e) { connectedAddr = null; connectedTr = null; throw new Error(trName(tr) + ': could not connect (' + (e.message || e) + ')'); }
  }

  // Which Bluetooth types to try, in order. Remembers the one that worked last time.
  function transportOrder(addr) {
    const type = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].dataset.type : 'unknown';
    const order = type === 'classic' ? ['classic', 'ble'] : ['ble', 'classic'];
    const last = savedTr(addr);
    if (last && order.includes(last)) order.sort((a, b) => (a === last ? -1 : b === last ? 1 : 0));
    return order;
  }

  // Facts Android knows about the adapter (evidence for compatibility; sends nothing to the adapter).
  async function describeAdapter(addr) {
    try {
      const i = await Obd.deviceInfo({ address: addr });
      log('Android reports: name=' + i.name + ', type=' + i.type + ', paired=' + i.bonded);
      if (i.ble) log('BLE services:\n' + i.ble.trim());
      log('Advertised service UUIDs: ' + ((i.uuids && i.uuids.length) ? i.uuids.join(', ') : '(none reported)'));
      return i;
    } catch (e) { log('Adapter info unavailable: ' + (e.message || e)); return null; }
  }

  // Connect, check the adapter, then (unless adapterOnly) check the car.
  // Throws a plain-English Error if anything fails.
  async function prepare(adapterOnly) {
    if (!OBD) { await load('obd.js'); OBD = window.OBD; }
    const addr = sel.value;
    if (!addr) throw new Error('Choose your adapter first. Tap "Find adapter" if the list is empty.');

    // 1. Does the ADAPTER answer? Try each Bluetooth type until one replies like an ELM327.
    //    (idleMs: a non-ELM adapter never sends the ">" prompt, so stop waiting once it goes quiet)
    let id = null, last = null;
    const problems = [];
    for (const tr of transportOrder(addr)) {
      try {
        await connectOrThrow(addr, tr);
        say('Checking the adapter (' + trName(tr) + ')…', '');
        let z;
        try { z = OBD.classify(await send('ATZ', 4000, 2500)); }
        catch (e) { // the link may have dropped (some adapters disconnect when idle): reconnect once
          log('Link lost (' + (e.message || e) + '). Reconnecting…');
          connectedAddr = null; connectedTr = null; await connectOrThrow(addr, tr);
          z = OBD.classify(await send('ATZ', 4000, 2500));
        }
        const r = z.kind === 'adapter-id' ? z : OBD.classify(await send('ATI', 3000, 2500));
        if (r.kind === 'adapter-id') { id = r; saveTr(addr, tr); break; }
        last = { tr, z };
        problems.push(trName(tr) + ': connected but ' + (z.kind === 'empty' ? 'no reply' : 'unexpected reply (' + z.text + ')'));
      } catch (e) {
        problems.push(e.message || String(e));
      }
    }
    if (!id) {
      const info = await describeAdapter(addr);
      const kindText = info ? ' Android says this adapter is "' + info.type + '" type.' : '';
      throw new Error((last
        ? 'Connected, but the adapter did not answer like a standard ELM327. It may use its own private protocol (some branded scanners only work with their own app), so this app cannot read it.'
        : 'Could not connect to the adapter. Check it is plugged in with the ignition ON, and that no other app (such as DiagZone) is connected to it.')
        + kindText + ' Details: ' + problems.join(' | ') + ' The full log is below.');
    }
    for (const c of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0']) await send(c, 2500);
    startPump();   // the adapter answers: start the battery voltage display
    showConn();
    if (adapterOnly) return;

    // 2. Does the CAR answer?
    say('Adapter OK. Asking the car… (up to 15 seconds)', '');
    const r0100 = await send('0100', 15000);
    const c0100 = OBD.classify(r0100);
    if (!(c0100.kind === 'data' && /41\s*00/i.test(r0100.replace(/\s+/g, ' ')))) {
      throw new Error(c0100.kind === 'vehicle-error'
        ? 'The adapter works but the car did not answer (' + c0100.text + '). Turn the ignition ON, push the adapter in firmly, and try again.'
        : 'The adapter works but the car gave no clear answer. Turn the ignition ON and try again.');
    }
    const pn = await send('ATDPN', 2500); isCan = OBD.protocolIsCan(pn);
  }

  // ---------- Connect / Disconnect / Test adapter ----------
  async function connectToggle() {
    if (connectedAddr) { await disconnectNow(); return; }
    if (!(await begin())) return;
    wantLink = true; reconnectTries = 0;
    try {
      await prepare(true);
      say('Connected. Battery voltage is shown at the top right. Tap "Scan car" to read codes.', 'ok');
      if (window.acdGet && window.acdGet('autoLive')) {
        try { await prepare(); startLiveNow(); say('Connected. Live data is running (speed, RPM, temperature at the top).', 'ok'); }
        catch (e) { say('Connected to the adapter. The car did not answer yet. Turn the ignition ON, then tap "Start live data" on the Battery screen.', ''); }
      }
    } catch (e) { wantLink = false; say(e.message || String(e), 'bad'); }
    finally { end(); }
  }

  async function disconnectNow() {
    wantLink = false; stopPump(); liveOn = false; setLiveBtn(); clearLiveUi();
    try { await Obd.disconnect(); } catch (e) { /* ignore */ }
    connectedAddr = null; connectedTr = null; showConn();
    say('Disconnected.', '');
  }

  // "Test adapter": connect + identify only. Reads nothing from the car and clears nothing.
  async function testAdapter() {
    if (!(await begin())) return;
    try {
      wantLink = true;
      await prepare(true);
      await describeAdapter(sel.value);
      say('The ADAPTER answered like an ELM327. This does not yet prove the car answers; tap "Scan car" for that.', 'ok');
    } catch (e) {
      say(e.message || String(e), 'bad');
    } finally { end(); }
  }

  // ---------- Scan car ----------
  async function scan() {
    if (!(await begin())) return;
    try {
      wantLink = true;
      await prepare();

      // 3. Read codes (read only; nothing is cleared)
      say('Car answered. Reading trouble codes…', '');
      const rStored = await send('03', 15000);
      if (OBD.classify(rStored).kind === 'vehicle-error') throw new Error('The car stopped answering while reading codes. Try again.');
      const stored = OBD.parseStoredDtcs(rStored, isCan === true);
      let pending = [];
      try { pending = OBD.parsePendingDtcs(await send('07', 10000), isCan === true).filter(c => !stored.includes(c)); } catch (e) { /* optional */ }

      const all = [...stored, ...pending];
      if (!all.length) {
        $('codes').value = '';
        say('Car answered and reports NO stored or pending trouble codes.', 'ok');
        return;
      }
      $('codes').value = all.join(', ');
      say('Scan complete. Stored codes: ' + (stored.join(', ') || 'none') + '. Pending codes: ' + (pending.join(', ') || 'none') + '. Opening the report…', 'ok');
      $('runBtn').click();
    } catch (e) {
      say(e.message || String(e), 'bad');
    } finally { end(); }
  }

  // ---------- Clear codes (OBD service 04). Always asks first. ----------
  async function clearCodes() {
    if (busy) return;
    const ok = window.confirm('Clear trouble codes?\n\n• Write down or scan the codes FIRST. They will be erased.\n• Freeze-frame data is erased and the emissions readiness tests reset.\n• The check-engine light comes back if the fault is still there.\n• Ignition ON, engine OFF, car parked.\n\nClear now?');
    if (!ok) { say('Cancelled. Nothing was cleared.', ''); return; }
    if (!(await begin())) return;
    try {
      wantLink = true;
      await prepare();
      say('Clearing codes…', '');
      const r = await send('04', 10000);
      if (/(^|\s)44(\s|$)/.test(r.replace(/[\r\n>]+/g, ' ').trim() + ' ') || /^44/.test(r.replace(/[\s>]+/g, ''))) {
        say('Done. The car accepted the clear command. Run "Scan car" again to confirm. If a code returns, the fault is still there.', 'ok');
        $('codes').value = '';
      } else {
        throw new Error('The car did not accept the clear command (' + (OBD.classify(r).text || 'no answer') + '). Some cars only allow it with the ignition ON and the engine OFF.');
      }
    } catch (e) {
      say(e.message || String(e), 'bad');
    } finally { end(); }
  }

  // ====================================================================
  //  Battery voltage (top right + Live panel) — read from the adapter with ATRV
  // ====================================================================
  function voltState(v) {
    if (v < 11.0) return { cls: 'red', text: 'Very low' };
    if (v < 12.0) return { cls: 'red', text: 'Low' };
    if (v < 12.4) return { cls: 'amber', text: 'Weak' };
    if (v < 13.0) return { cls: 'green', text: 'Battery OK' };
    if (v < 13.2) return { cls: 'grey', text: 'Surface charge' };
    if (v <= 14.8) return { cls: 'blue', text: 'Charging' };
    if (v <= 15.2) return { cls: 'amber', text: 'High' };
    return { cls: 'red', text: 'Overcharging' };
  }
  const fmtTime = t => new Date(t).toLocaleTimeString([], { hour12: false });

  function setVoltUi(r) {
    const num = pill && pill.querySelector('b'), st = pill && pill.querySelector('small');
    if (window.acdOnVolt) window.acdOnVolt(r ? r.v : null);
    if (!r) {
      if (pill) { pill.className = 'volt-pill off'; num.textContent = '—'; st.textContent = 'No link'; }
      $('vBig').textContent = '—'; $('vState').textContent = 'Not connected'; $('vTrend').textContent = ''; $('vMinMax').textContent = '';
      return;
    }
    const s = voltState(r.v), txt = r.v.toFixed(r.dec);
    if (pill) { pill.className = 'volt-pill ' + s.cls; num.textContent = txt; st.textContent = s.text; }
    $('vBig').textContent = txt; $('vState').textContent = s.text; $('vState').className = 'vs-' + s.cls;
  }

  function drawVolt() {
    const n = readings.length; if (!n) return;
    const last = readings[n - 1];
    const vs = readings.map(r => r.v), mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs);
    $('vMinMax').textContent = 'Lowest ' + mn.toFixed(last.dec) + ' V · Highest ' + mx.toFixed(last.dec) + ' V · ' + n + ' readings';
    const back = readings[Math.max(0, n - 6)];
    const d = last.v - back.v;
    $('vTrend').textContent = n < 3 ? '' : (Math.abs(d) < 0.05 ? 'Steady' : (d > 0 ? '▲ Rising ' : '▼ Falling ') + Math.abs(d).toFixed(2) + ' V');
    // graph (last 150 points)
    const pts = readings.slice(-150), lo = Math.min.apply(null, pts.map(r => r.v)) - 0.2, hi = Math.max.apply(null, pts.map(r => r.v)) + 0.2;
    $('vLine').setAttribute('points', pts.map((r, i) => (pts.length < 2 ? 0 : i * 300 / (pts.length - 1)).toFixed(1) + ',' + (56 - (r.v - lo) / (hi - lo) * 52).toFixed(1)).join(' '));
    // every reading, newest first
    const rows = readings.slice(-12).reverse().map((r, i, a) => {
      const prev = readings[readings.length - 1 - i - 1];
      const dl = prev ? r.v - prev.v : 0;
      return '<div class="vrow"><span>' + fmtTime(r.t) + '</span><b>' + r.v.toFixed(r.dec) + ' V</b><i class="' + (dl > 0.004 ? 'up' : dl < -0.004 ? 'down' : '') + '">' + (prev ? (dl > 0.004 ? '▲ ' : dl < -0.004 ? '▼ ' : '• ') + Math.abs(dl).toFixed(2) : '') + '</i></div>';
    });
    $('vList').innerHTML = rows.join('');
  }

  function addReading(v, dec) {
    const r = { t: Date.now(), v: v, dec: dec };
    readings.push(r);
    if (readings.length > 1500) readings.shift();
    setVoltUi(r); drawVolt();
  }

  async function readVoltage() {
    if (voltSource === 'adapter') {
      const raw = await send('ATRV', 2500, 0, true);
      const v = OBD.parseVoltage(raw);
      if (v !== null) { voltFails = 0; const m = raw.match(/\d+\.(\d+)/); addReading(v, m ? Math.min(2, m[1].length) : 1); return; }
      if (++voltFails >= 3) { voltSource = 'ecu'; voltFails = 0; }   // this adapter has no voltage command: ask the car instead
      return;
    }
    const raw = await send('0142', 2500, 0, true);
    const v = OBD.decodePid(0x42, OBD.pidData(raw, 1, 0x42));
    if (v !== null) addReading(v, 2);
  }

  // ====================================================================
  //  Background reader (pump): battery voltage, plus live data when switched on
  // ====================================================================
  const LIVE_PIDS = [0x0C, 0x0D, 0x05, 0x04, 0x11, 0x06, 0x07, 0x10, 0x0B, 0x0F];

  function tileFor(pid) {
    let t = $('tile' + pid);
    if (!t) {
      const d = OBD.PIDS[pid];
      t = document.createElement('div'); t.className = 'telemetry-card'; t.id = 'tile' + pid;
      t.innerHTML = '<span>' + d.name + '</span><strong>—</strong>';
      $('liveGrid').appendChild(t);
    }
    return t;
  }

  const CORE_PIDS = [0x0C, 0x0D, 0x05];   // RPM, speed, coolant: read every round for the dashboard
  function fmtPid(pid, v) {
    const d = OBD.PIDS[pid];
    if (window.acdFmt) { try { return window.acdFmt(pid, v, d); } catch (e) { /* fall through */ } }
    return { text: v.toFixed(d.dec), unit: d.unit };
  }
  function drawTile(pid) {
    if (lastVals[pid] === undefined) return;
    const f = fmtPid(pid, lastVals[pid]);
    tileFor(pid).querySelector('strong').textContent = f.text + ' ' + f.unit;
  }
  window.acdRedrawTiles = () => { Object.keys(lastVals).forEach(k => { if ($('tile' + k)) drawTile(Number(k)); }); };
  function clearLiveUi() { Object.keys(lastVals).forEach(k => delete lastVals[k]); if (window.acdOnLive) window.acdOnLive(null); }

  async function readLive() {
    const list = LIVE_PIDS.filter(p => !unsupported[p]);
    if (!list.length) return;
    const todo = CORE_PIDS.filter(p => !unsupported[p]), rest = list.filter(p => CORE_PIDS.indexOf(p) < 0);
    if (rest.length) { todo.push(rest[liveIdx % rest.length]); liveIdx++; }
    let got = 0, tried = 0;
    for (const pid of todo) {
      if (busy) return;
      tried++;
      const hex = ('0' + pid.toString(16)).slice(-2).toUpperCase();
      const raw = await send('01' + hex, 3000, 0, true);
      const v = OBD.decodePid(pid, OBD.pidData(raw, 1, pid));
      const d = OBD.PIDS[pid];
      if (v !== null) { got++; unsupported['m' + pid] = 0; lastVals[pid] = v; drawTile(pid); if (window.acdOnLive) window.acdOnLive(pid, v); }
      else if (OBD.classify(raw).kind === 'vehicle-error' || /NO DATA/i.test(raw)) { unsupported['m' + pid] = (unsupported['m' + pid] || 0) + 1; if (unsupported['m' + pid] >= 3 && liveBlank === 0) { /* may just be unsupported */ } }
    }
    if (got === 0 && tried > 0) { liveBlank++; } else { liveBlank = 0; }
    // A PID that never answers while others do is simply not supported by this car: hide it.
    for (const pid of LIVE_PIDS) if ((unsupported['m' + pid] || 0) >= 4 && liveBlank === 0) { unsupported[pid] = true; const t = $('tile' + pid); if (t) t.remove(); }
    if (liveBlank >= 6) {       // nothing answers any more (ignition off?)
      liveOn = false; setLiveBtn(); liveBlank = 0;
      $('liveNote').textContent = 'The car stopped answering, so live data paused. Turn the ignition ON and tap Start live data again.';
    }
  }

  async function pumpTick() {
    if (busy || pumpRunning || !connectedAddr || !OBD) return;
    pumpRunning = true;
    try {
      await readVoltage();
      if (liveOn && !fast && !busy) await readLive();
    } catch (e) {
      linkLost(e);
    } finally { pumpRunning = false; }
  }

  function schedulePump() {
    clearTimeout(pumpTimer);
    if (!pumpOn) return;
    pumpTimer = setTimeout(async () => { await pumpTick(); schedulePump(); }, fast ? 120 : (liveOn ? 350 : 1500));
  }
  function startPump() { if (pumpOn) return; pumpOn = true; voltFails = 0; schedulePump(); }
  function stopPump() { pumpOn = false; clearTimeout(pumpTimer); pumpTimer = null; }

  // The Bluetooth link dropped: show it, and try to come back by itself a few times.
  function linkLost(e) {
    connectedAddr = null; connectedTr = null; showConn(); clearLiveUi();
    say('Bluetooth link lost (' + (e && e.message ? e.message : e) + ').' + (wantLink ? ' Trying to reconnect…' : ''), 'bad');
    clearTimeout(reconnectTimer);
    if (wantLink && reconnectTries < 5) {
      reconnectTries++;
      reconnectTimer = setTimeout(async () => {
        if (busy || connectedAddr || !wantLink) return;
        if (!(await begin(false))) return;
        try { await prepare(true); reconnectTries = 0; say('Reconnected.', 'ok'); }
        catch (err) { linkLost(err); }
        finally { end(); }
      }, 6000);
    } else if (wantLink) {
      stopPump();
      say('Could not reconnect. Check the adapter is plugged in, then tap Connect.', 'bad');
    }
  }

  // ====================================================================
  //  Battery buttons
  // ====================================================================
  function copyText(t) {
    return (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).catch(() => {
      const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select();
      const ok = document.execCommand('copy'); a.remove(); if (!ok) throw new Error('copy failed');
    });
  }
  const readingsText = list => 'Bobby Car Doctor — battery voltage log\n' + list.map(r => fmtTime(r.t) + '  ' + r.v.toFixed(r.dec) + ' V').join('\n');

  const VT_KEY = 'bcd_vtests_v1';
  const readTests = () => { try { return JSON.parse(localStorage.getItem(VT_KEY) || '[]'); } catch (e) { return []; } };
  function renderTests() {
    const list = readTests();
    $('vSaved').innerHTML = list.length ? '<h3 class="vh">Saved tests</h3>' + list.map((x, i) =>
      '<div class="history-entry"><strong>' + new Date(x.t0).toLocaleString() + '</strong><p>' + x.first.toFixed(2) + ' → ' + x.last.toFixed(2) + ' V · lowest ' + x.min.toFixed(2) + ' · highest ' + x.max.toFixed(2) + ' · ' + x.n + ' readings</p><button class="secondary vt-copy" data-i="' + i + '" type="button">Copy</button> <button class="secondary vt-del" data-i="' + i + '" type="button">Delete</button></div>').join('') : '';
  }
  function saveTest() {
    if (readings.length < 2) { say('Not enough readings yet. Connect and wait a few seconds.', 'bad'); return; }
    const vs = readings.map(r => r.v), step = Math.max(1, Math.ceil(readings.length / 150));
    const rec = { t0: readings[0].t, t1: readings[readings.length - 1].t, n: readings.length, first: vs[0], last: vs[vs.length - 1], min: Math.min.apply(null, vs), max: Math.max.apply(null, vs), pts: readings.filter((r, i) => i % step === 0).map(r => [r.t, r.v, r.dec]) };
    try { const l = readTests(); l.unshift(rec); localStorage.setItem(VT_KEY, JSON.stringify(l.slice(0, 10))); say('Battery test saved on this device.', 'ok'); } catch (e) { say('Could not save (storage full or blocked).', 'bad'); }
    renderTests();
  }
  $('vSaveBtn').addEventListener('click', saveTest);
  $('vCopyBtn').addEventListener('click', () => { if (!readings.length) { say('No readings yet.', 'bad'); return; } copyText(readingsText(readings)).then(() => say('Voltage readings copied. Paste them into WhatsApp or notes.', 'ok'), () => say('Copy not available.', 'bad')); });
  $('vResetBtn').addEventListener('click', () => { readings.length = 0; $('vList').innerHTML = ''; $('vLine').setAttribute('points', ''); $('vMinMax').textContent = ''; $('vTrend').textContent = ''; say('Voltage readings cleared.', ''); });
  $('vFastBtn').addEventListener('click', () => { fast = !fast; $('vFastBtn').textContent = 'Fast mode: ' + (fast ? 'on' : 'off'); $('vFastBtn').className = fast ? 'primary' : 'secondary'; schedulePump(); });
  $('vSaved').addEventListener('click', e => {
    const c = e.target.closest('.vt-copy'), d = e.target.closest('.vt-del');
    if (c) { const x = readTests()[+c.dataset.i]; if (x) copyText(readingsText(x.pts.map(p => ({ t: p[0], v: p[1], dec: p[2] })))).then(() => say('Saved test copied.', 'ok'), () => say('Copy not available.', 'bad')); }
    if (d) { const l = readTests(); l.splice(+d.dataset.i, 1); try { localStorage.setItem(VT_KEY, JSON.stringify(l)); } catch (er) { /* ignore */ } renderTests(); }
  });

  // ====================================================================
  //  Live data on/off, VIN / readiness / freeze-frame
  // ====================================================================
  function setLiveBtn() { const b = $('liveBtn'); if (b) { b.textContent = liveOn ? 'Stop live data' : 'Start live data'; b.className = liveOn ? 'primary' : 'secondary'; } }

  function startLiveNow() {
    liveOn = true; liveBlank = 0; liveIdx = 0;
    for (const k of Object.keys(unsupported)) delete unsupported[k];
    $('liveGrid').innerHTML = '';
    setLiveBtn();
    $('liveNote').textContent = 'Live data running. Values the car does not support are hidden.';
  }

  async function toggleLive() {
    if (liveOn) { liveOn = false; setLiveBtn(); $('liveNote').textContent = 'Live data stopped. Last values stay on screen.'; return; }
    if (!(await begin())) return;
    try {
      wantLink = true;
      await prepare();                       // checks the car really answers before we start asking it things
      startLiveNow();
      say('Live data started.', 'ok');
    } catch (e) { say(e.message || String(e), 'bad'); }
    finally { end(); }
  }

  const el = (id, text) => { $(id).textContent = text; };

  async function readVehicleInfo() {
    if (!(await begin())) return;
    try {
      wantLink = true;
      await prepare();
      say('Reading VIN, readiness and freeze-frame… (read only)', '');
      // VIN
      try {
        const vin = OBD.vinFromResponse(await send('0902', 9000, 1000));
        el('vinValue', vin || 'Not supported by this car, or no valid answer');
        if (vin && window.acdVehicleFromVin) window.acdVehicleFromVin(vin);
      } catch (e) { el('vinValue', 'Unavailable'); if (!connectedAddr) throw e; }
      // Readiness
      try {
        const b = OBD.pidData(await send('0101', 6000), 1, 0x01), r = OBD.decodeReadiness(b);
        if (r) el('readinessValue', (r.mil ? 'Warning light ON' : 'Warning light off') + ' · ' + r.count + ' stored code(s) · ' + r.items.map(i => (i.ready ? '✓ ' : '✗ ') + i.name + (i.ready ? '' : ' (not ready)')).join(', '));
        else el('readinessValue', 'Not supported by this car, or no valid answer');
      } catch (e) { el('readinessValue', 'Unavailable'); if (!connectedAddr) throw e; }
      // Freeze-frame (Mode 02, frame 0)
      try {
        const dtc = OBD.freezeDtc(await send('020200', 6000));
        if (!dtc) el('freezeValue', 'No freeze-frame stored (or not supported)');
        else {
          const parts = [];
          for (const pid of [0x0C, 0x05, 0x0D, 0x04, 0x06, 0x07, 0x0B, 0x0F]) {
            const v = OBD.freezeValue(await send('02' + ('0' + pid.toString(16)).slice(-2).toUpperCase() + '00', 4000, 0, true), pid);
            if (v !== null) { const f = fmtPid(pid, v); parts.push(OBD.PIDS[pid].name + ' ' + f.text + ' ' + f.unit); }
          }
          el('freezeValue', 'Caused by ' + dtc + (parts.length ? ' · ' + parts.join(' · ') : ''));
        }
      } catch (e) { el('freezeValue', 'Unavailable'); }
      say('Vehicle information request finished. What the car does not support is shown as not supported. Nothing was changed on the car.', 'ok');
    } catch (e) { say(e.message || String(e), 'bad'); }
    finally { end(); }
  }

  // ---------- wire up ----------
  btn.addEventListener('click', scan);
  $('connectBtn').addEventListener('click', connectToggle);
  $('clearCodesBtn').addEventListener('click', clearCodes);
  $('testBtn').addEventListener('click', testAdapter);
  $('refreshBtn').addEventListener('click', refresh);
  $('findBtn').addEventListener('click', findAdapter);
  $('liveBtn').addEventListener('click', toggleLive);
  $('infoBtn').addEventListener('click', readVehicleInfo);
  setVoltUi(null); renderTests(); showConn();

  (async () => {
    if (!OBD) { try { await load('obd.js'); OBD = window.OBD; } catch (e) { /* loaded on demand later */ } }
    const picked = await refresh();
    // Connect by itself when the adapter used last time is in the list.
    if (picked && saved() && sel.value === saved()) {
      wantLink = true;
      if (await begin(false)) {
        try { say('Connecting to your adapter…', ''); await prepare(true); say('Connected. Battery voltage is shown at the top right. Tap "Scan car" to read codes.', 'ok'); }
        catch (e) { say('Adapter not connected yet. Plug it into the car (ignition ON) and tap Connect. ' + (e.message ? '' : ''), ''); wantLink = false; }
        finally { end(); }
      }
    }
  })();
})();
