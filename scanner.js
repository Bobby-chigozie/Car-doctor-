'use strict';
/* AI Car Doctor — scanner.js
   "Scan car" for the Android app. Talks to a paired Bluetooth OBD-II adapter through the
   native ObdBluetooth plugin (ObdBluetoothPlugin.java), reads stored + pending trouble codes,
   then fills the code box and runs the normal diagnosis.
   In a normal browser (no native plugin) it only shows a short note. */
(function () {
  const isNative = !!(window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform());
  const firstCard = document.querySelector('section.card');
  if (!firstCard) return;

  const card = document.createElement('section');
  card.className = 'card';
  card.id = 'scanCard';
  firstCard.parentNode.insertBefore(card, firstCard);

  if (!isNative) {
    card.innerHTML = '<h2>Scan car</h2><p class="muted" style="margin:0">Car scanning works only in the AI Car Doctor Android app. In a web browser you can still type codes below.</p>';
    return;
  }

  card.innerHTML =
    '<h2>Scan car</h2>' +
    '<div class="field"><label for="adapterSel">Bluetooth adapter (paired, or found with "Find adapter")</label><select id="adapterSel"><option value="">Looking for paired devices…</option></select></div>' +
    '<div class="actions"><button class="primary" id="scanBtn" type="button">Scan car</button><button class="secondary" id="testBtn" type="button">Test adapter</button><button class="secondary" id="clearCodesBtn" type="button">Clear codes</button><button class="secondary" id="findBtn" type="button">Find adapter</button><button class="secondary" id="refreshBtn" type="button">Refresh list</button></div>' +
    '<p id="scanStatus" class="hint" role="status">Plug the adapter into the car and turn the ignition ON (engine can be off). Keep the car parked.</p>' +
    '<pre id="scanLog" class="small" style="display:none;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto;background:#091625;border:1px solid #3a536d;border-radius:10px;padding:8px;margin:8px 0 0"></pre>';

  const $ = id => document.getElementById(id);
  const sel = $('adapterSel'), btn = $('scanBtn'), statusEl = $('scanStatus'), logEl = $('scanLog');
  const Obd = Capacitor.registerPlugin('ObdBluetooth');
  let OBD = window.OBD, busy = false, connectedAddr = null, connectedTr = null, isCan = null;

  const setButtons = d => { btn.disabled = d; $('clearCodesBtn').disabled = d; $('testBtn').disabled = d; $('findBtn').disabled = d; };
  const say = (t, cls) => { statusEl.textContent = t; statusEl.style.color = cls === 'bad' ? '#ffb4a8' : cls === 'ok' ? '#92f3d7' : ''; };
  const log = t => { logEl.style.display = 'block'; logEl.textContent += t + '\n'; logEl.scrollTop = logEl.scrollHeight; };
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src + ' did not load')); document.head.appendChild(s); });
  const saved = () => { try { return localStorage.getItem('acd_adapter') || ''; } catch (e) { return ''; } };
  const save = a => { try { localStorage.setItem('acd_adapter', a); } catch (e) { /* ignore */ } };
  const savedTr = a => { try { return localStorage.getItem('acd_tr_' + a) || ''; } catch (e) { return ''; } };
  const saveTr = (a, t) => { try { localStorage.setItem('acd_tr_' + a, t); } catch (e) { /* ignore */ } };

  async function send(cmd, ms, idleMs) {
    log('> ' + cmd);
    let r;
    try { r = await Obd.send({ command: cmd, timeoutMs: ms || 5000, idleMs: idleMs || 0 }); }
    catch (e) { connectedAddr = null; connectedTr = null; throw e; } // link dropped: force a fresh connection next time
    log('< ' + JSON.stringify(r.response) + (r.hex ? '   [hex ' + r.hex + ']' : ''));
    return r.response || '';
  }

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
      if (!list.length) { sel.innerHTML = ''; sel.add(new Option('No paired devices found', '')); say('No paired Bluetooth devices. Tap "Find adapter" to search for the adapter (plug it into the car, ignition ON), or pair it in Android Bluetooth settings.', 'bad'); return; }
      const picked = fillList(list);
      say(picked ? 'Ready. Tap "Scan car".' : 'Pick your adapter, or tap "Find adapter" to search for it (plug it into the car, ignition ON).', '');
    } catch (e) {
      sel.innerHTML = ''; sel.add(new Option('Bluetooth not available', ''));
      say(e.message || String(e), 'bad');
    }
  }

  // Search nearby for Bluetooth LE adapters that are not paired in Android.
  async function findAdapter() {
    if (busy) return;
    busy = true; setButtons(true);
    try {
      say('Searching for nearby adapters… (about 6 seconds)', '');
      let paired = [];
      try { paired = (await Obd.listPaired()).devices || []; } catch (e) { /* paired list is optional here */ }
      const r = await Obd.scanLe({ durationMs: 6000 });
      const seen = {}; const all = [];
      paired.concat(r.devices || []).forEach(d => { if (!seen[d.address]) { seen[d.address] = 1; all.push(d); } });
      if (!all.length) { say('Nothing found. Check the adapter is plugged into the car with the ignition ON, turn Bluetooth on, and (Android 11 or older) turn Location on, then try again.', 'bad'); return; }
      const picked = fillList(all);
      say((r.devices || []).length + ' nearby device(s) found. ' + (picked ? 'Adapter selected. Tap "Test adapter" or "Scan car".' : 'Pick your adapter from the list.'), picked ? 'ok' : '');
    } catch (e) {
      say(e.message || String(e), 'bad');
    } finally {
      busy = false; setButtons(false);
    }
  }

  const trName = t => t === 'ble' ? 'Bluetooth LE' : 'Bluetooth Classic';

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
    if (!addr) throw new Error('Choose your adapter first. If the list is empty, pair it in Android Bluetooth settings, then tap Refresh list.');

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

  // "Test adapter": connect + identify only. Reads nothing from the car and clears nothing.
  async function testAdapter() {
    if (busy) return;
    busy = true; setButtons(true); logEl.textContent = '';
    try {
      await prepare(true);
      await describeAdapter(sel.value);
      say('The ADAPTER answered like an ELM327. This does not yet prove the car answers; tap "Scan car" for that.', 'ok');
    } catch (e) {
      say(e.message || String(e), 'bad');
    } finally {
      busy = false; setButtons(false);
    }
  }

  async function scan() {
    if (busy) return;
    busy = true; setButtons(true); logEl.textContent = '';
    try {
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
      say('Scan complete. Stored codes: ' + (stored.join(', ') || 'none') + '. Pending codes: ' + (pending.join(', ') || 'none') + '. Report below.', 'ok');
      $('runBtn').click();
    } catch (e) {
      say(e.message || String(e), 'bad');
    } finally {
      busy = false; setButtons(false);
    }
  }

  // Clear codes (OBD service 04). Always asks first.
  async function clearCodes() {
    if (busy) return;
    const ok = window.confirm('Clear trouble codes?\n\n• Write down or scan the codes FIRST. They will be erased.\n• Freeze-frame data is erased and the emissions readiness tests reset.\n• The check-engine light comes back if the fault is still there.\n• Ignition ON, engine OFF, car parked.\n\nClear now?');
    if (!ok) { say('Cancelled. Nothing was cleared.', ''); return; }
    busy = true; setButtons(true); logEl.textContent = '';
    try {
      await prepare();
      say('Clearing codes…', '');
      const r = await send('04', 10000);
      if (/(^|\s)44(\s|$)/.test(r.replace(/[\r\n>]+/g, ' ').trim() + ' ')) {
        say('Done. The car accepted the clear command. Run "Scan car" again to confirm. If a code returns, the fault is still there.', 'ok');
        $('codes').value = '';
      } else {
        throw new Error('The car did not accept the clear command (' + (OBD.classify(r).text || 'no answer') + '). Some cars only allow it with the ignition ON and the engine OFF.');
      }
    } catch (e) {
      say(e.message || String(e), 'bad');
    } finally {
      busy = false; setButtons(false);
    }
  }

  btn.addEventListener('click', scan);
  $('clearCodesBtn').addEventListener('click', clearCodes);
  $('testBtn').addEventListener('click', testAdapter);
  $('refreshBtn').addEventListener('click', refresh);
  $('findBtn').addEventListener('click', findAdapter);
  refresh();
})();
