'use strict';
/* AI Car Doctor — obd.js
   Small helpers for ELM327-style adapters: classify replies and decode Mode 03 (stored DTC) replies.
   Used by bluetooth_test.html. Works in a browser and in Node (for testing). */
(function (root) {
  const ELM_ERRORS = ['UNABLE TO CONNECT', 'NO DATA', 'BUS INIT', 'CAN ERROR', 'BUS BUSY', 'BUS ERROR', 'DATA ERROR', 'FB ERROR', 'LV RESET', 'STOPPED', 'ERROR'];

  function lines(raw) {
    return String(raw).replace(/>/g, '').split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
  }

  // Returns {kind, text}. kind: 'empty' | 'unknown-command' | 'adapter-id' | 'searching' | 'vehicle-error' | 'data'
  function classify(raw) {
    const ls = lines(raw);
    if (!ls.length) return { kind: 'empty', text: 'No reply from the adapter.' };
    const joined = ls.join(' ').toUpperCase();
    if (/ELM3\d\d|ELM\s?327|OBDII|OBD II/.test(joined) && !/^[0-9A-F ]+$/.test(joined)) return { kind: 'adapter-id', text: ls.join(' ') };
    for (const e of ELM_ERRORS) if (joined.includes(e)) return { kind: 'vehicle-error', text: e + ' (the adapter answered, but the vehicle did not)' };
    if (ls.length === 1 && ls[0] === '?') return { kind: 'unknown-command', text: 'Adapter did not understand the command.' };
    if (/^OK$/.test(joined)) return { kind: 'ok', text: 'OK' };
    if (/SEARCHING/.test(joined) && ls.every(l => /SEARCHING|^[\.\s]*$/i.test(l))) return { kind: 'searching', text: 'Adapter is searching for a protocol.' };
    return { kind: 'data', text: ls.join(' / ') };
  }

  function bytesOfLine(l) {
    const hex = l.replace(/[^0-9A-Fa-f]/g, '');
    const out = [];
    for (let i = 0; i + 1 < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
    return out;
  }

  // Splits a multi-line reply into messages (handles "0:", "1:" continuation lines of CAN multi-frame replies).
  function messages(raw) {
    const msgs = [];
    let cur = null;
    for (const l of lines(raw)) {
      if (!/^[0-9A-Fa-f: ]+$/.test(l)) continue; // skip text lines such as SEARCHING...
      const m = l.match(/^([0-9A-Fa-f]{1,2}):\s*(.*)$/);
      if (m) {
        if (!cur) { cur = []; msgs.push(cur); }
        cur.push(...bytesOfLine(m[2]));
      } else if (/^[0-9A-Fa-f]{3}$/.test(l)) {
        cur = []; msgs.push(cur); // length line of a multi-frame reply
      } else {
        cur = null; msgs.push(bytesOfLine(l));
      }
    }
    return msgs.filter(m => m.length);
  }

  function decodeDtc(a, b) {
    return ['P', 'C', 'B', 'U'][a >> 6] + ((a >> 4) & 3) + (a & 15).toString(16).toUpperCase() + b.toString(16).toUpperCase().padStart(2, '0');
  }

  // isCan: true for ISO 15765 (CAN) protocols, where a count byte follows 0x43.
  function parseDtcs(raw, isCan, header) {
    const found = [];
    for (const msg of messages(raw)) {
      const i = msg.indexOf(header);
      if (i < 0) continue;
      let p = msg.slice(i + 1);
      if (isCan && p.length > 0) {
        // ISO 15765-4 (CAN): first byte after the service ID is the number of codes.
        // Use it (not odd/even length), because ECUs often pad replies with 00 bytes.
        const n = p[0];
        p = p.slice(1, 1 + 2 * n);
      }
      for (let k = 0; k + 1 < p.length; k += 2) {
        if (p[k] === 0 && p[k + 1] === 0) continue;
        found.push(decodeDtc(p[k], p[k + 1]));
      }
    }
    return [...new Set(found)];
  }
  function parseStoredDtcs(raw, isCan) { return parseDtcs(raw, isCan, 0x43); }
  function parsePendingDtcs(raw, isCan) { return parseDtcs(raw, isCan, 0x47); }

  // Protocol number from ATDPN reply, e.g. "A6" -> 6
  function protocolIsCan(atdpn) {
    const m = String(atdpn).replace(/[^0-9A-Fa-f]/g, '').match(/([0-9A-Fa-f])$/);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return n >= 6 && n <= 9; // ELM327 protocols 6-9 are ISO 15765-4 CAN
  }

  // ---------- Live data helpers (work with spaces on or off, and multi-line CAN replies) ----------
  // Returns the data bytes that follow "<mode+0x40> <pid>" in a reply, or null when the car did not answer that PID.
  function pidData(raw, mode, pid) {
    const rm = mode + 0x40;
    for (const msg of messages(raw)) {
      for (let i = 0; i + 1 < msg.length; i++) if (msg[i] === rm && msg[i + 1] === pid) return msg.slice(i + 2);
    }
    return null;
  }

  // Standard Mode 01 PIDs we show. need = bytes required.
  const PIDS = {
    0x04: { name: 'Engine load', unit: '%', need: 1, dec: 0, fn: b => b[0] * 100 / 255 },
    0x05: { name: 'Coolant temp', unit: '°C', need: 1, dec: 0, fn: b => b[0] - 40 },
    0x06: { name: 'Short fuel trim', unit: '%', need: 1, dec: 1, fn: b => (b[0] - 128) * 100 / 128 },
    0x07: { name: 'Long fuel trim', unit: '%', need: 1, dec: 1, fn: b => (b[0] - 128) * 100 / 128 },
    0x0B: { name: 'Intake pressure', unit: 'kPa', need: 1, dec: 0, fn: b => b[0] },
    0x0C: { name: 'Engine RPM', unit: 'rpm', need: 2, dec: 0, fn: b => (b[0] * 256 + b[1]) / 4 },
    0x0D: { name: 'Speed', unit: 'km/h', need: 1, dec: 0, fn: b => b[0] },
    0x0F: { name: 'Intake air temp', unit: '°C', need: 1, dec: 0, fn: b => b[0] - 40 },
    0x10: { name: 'Air flow (MAF)', unit: 'g/s', need: 2, dec: 1, fn: b => (b[0] * 256 + b[1]) / 100 },
    0x11: { name: 'Throttle', unit: '%', need: 1, dec: 0, fn: b => b[0] * 100 / 255 },
    0x42: { name: 'Module voltage', unit: 'V', need: 2, dec: 2, fn: b => (b[0] * 256 + b[1]) / 1000 }
  };
  function decodePid(pid, bytes) {
    const d = PIDS[pid];
    if (!d || !bytes || bytes.length < d.need) return null;
    return d.fn(bytes);
  }

  // Reply to ATRV, e.g. "12.4V" or "12.40". Returns volts or null.
  function parseVoltage(raw) {
    const t = String(raw).replace(/>/g, ' ').replace(/ATRV/ig, ' ').trim();
    const m = t.match(/(\d{1,2}(?:\.\d{1,2})?)\s*V?\b/i);
    if (!m) return null;
    const v = parseFloat(m[1]);
    return (v >= 3 && v <= 40) ? v : null;
  }

  // Mode 09 PID 02. Works for CAN (one multi-line message) and older protocols (one line per 4 characters).
  function vinFromResponse(raw) {
    let chars = '';
    for (const msg of messages(raw)) {
      const i = msg.findIndex((x, k) => x === 0x49 && msg[k + 1] === 0x02);
      if (i < 0) continue;
      for (const x of msg.slice(i + 3)) if (x >= 48 && x <= 90) chars += String.fromCharCode(x); // skip the count/sequence byte
    }
    const m = chars.match(/[A-HJ-NPR-Z0-9]{17}/);
    return m ? m[0] : null;
  }

  // Mode 01 PID 01: warning light, DTC count and emissions monitor readiness.
  function decodeReadiness(b) {
    if (!b || b.length < 4) return null;
    const diesel = !!(b[1] & 0x08), items = [];
    [['Misfire', 0], ['Fuel system', 1], ['Components', 2]].forEach(([n, i]) => { if (b[1] & (1 << i)) items.push({ name: n, ready: !(b[1] & (1 << (i + 4))) }); });
    const spark = ['Catalyst', 'Heated catalyst', 'EVAP system', 'Secondary air', 'A/C refrigerant', 'Oxygen sensor', 'O2 sensor heater', 'EGR system'];
    const comp = ['NMHC catalyst', 'NOx / SCR', null, 'Boost pressure', null, 'Exhaust gas sensor', 'Particulate filter', 'EGR / VVT'];
    const names = diesel ? comp : spark;
    for (let i = 0; i < 8; i++) if ((b[2] & (1 << i)) && names[i]) items.push({ name: names[i], ready: !(b[3] & (1 << i)) });
    return { mil: !!(b[0] & 0x80), count: b[0] & 0x7f, diesel, items };
  }

  // Mode 02 PID 02: the code that caused the freeze frame (or null).
  function freezeDtc(raw) {
    const d = pidData(raw, 2, 0x02);
    if (!d || d.length < 3) return null;
    if (d[1] === 0 && d[2] === 0) return null;
    return decodeDtc(d[1], d[2]);
  }
  // Mode 02 value of another PID in frame 0.
  function freezeValue(raw, pid) {
    const d = pidData(raw, 2, pid);
    return d && d.length >= 2 ? decodePid(pid, d.slice(1)) : null;
  }

  const api = { classify, parseStoredDtcs, parsePendingDtcs, decodeDtc, messages, protocolIsCan, lines, pidData, PIDS, decodePid, parseVoltage, vinFromResponse, decodeReadiness, freezeDtc, freezeValue };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OBD = api;
})(typeof window !== 'undefined' ? window : globalThis);
