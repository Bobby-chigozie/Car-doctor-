'use strict';
try { window.acdFlags && (window.acdFlags.app = 1); } catch (e) { /* ignore */ }
/* =========================================================
   Bobby Car Doctor — app.js (screens, settings, reports)
   The OBD-II code database lives in dtc-database.js. Edit codes there.
   ========================================================= */
/* The screen starts at once. The big database loads in the background, so a slow connection
   never freezes the app. obd.js and scanner.js are loaded only inside the Android app. */
(function () {
  const isNative = !!(window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform());
  function say(msg) { const s = document.getElementById('status'); if (s) s.textContent = msg; }
  function load(src, ok, bad) {
    const sc = document.createElement('script');
    sc.src = src; if (ok) sc.onload = ok; if (bad) sc.onerror = bad;
    document.head.appendChild(sc);
  }
  function dbReady() { if (window.acdOnDb) window.acdOnDb(); }
  startApp();
  if (typeof DTC_DATABASE !== 'undefined') dbReady();
  else load('dtc-database.js', dbReady, () => say('Database file dtc-database.js did not load. Put it in the same folder as index.html.'));
  let demoQ = false; try { demoQ = new URLSearchParams(location.search).get('demo') === '1'; } catch (e) { /* ignore */ }
  if (isNative || demoQ) load('obd.js', () => load('scanner.js'), () => load('scanner.js'));
})();

function startApp() {
const VEHICLES = {"Acura":["CL","ILX","Integra","MDX","NSX","RDX","RL","RLX","RSX","TL","TLX","TSX","ZDX"],"Alfa Romeo":["Giulia","Stelvio","Tonale","4C"],"Audi":["A1","A3","A4","A5","A6","A7","A8","Q2","Q3","Q5","Q7","Q8","TT"],"BAIC":["BJ40","X35","X55"],"Bentley":["Bentayga","Continental GT","Flying Spur"],"BMW":["1 Series","2 Series","3 Series","4 Series","5 Series","6 Series","7 Series","8 Series","X1","X2","X3","X4","X5","X6","X7","Z4"],"Buick":["Encore","Envision","Enclave","Regal"],"BYD":["Atto 3","Dolphin","Han","Seal","Tang"],"Cadillac":["ATS","CT4","CT5","CTS","Escalade","XT4","XT5","XT6"],"Changan":["Alsvin","CS35","CS55","CS75","UNI-K"],"Chery":["Arrizo 5","Tiggo 4","Tiggo 7","Tiggo 8"],"Chevrolet":["Aveo","Blazer","Camaro","Captiva","Colorado","Cruze","Equinox","Malibu","Silverado","Spark","Suburban","Tahoe","Trailblazer"],"Chrysler":["200","300","Pacifica","Voyager"],"Citroën":["Berlingo","C3","C4","C5 Aircross"],"Daewoo":["Espero","Lanos","Leganza","Matiz","Nubira"],"Daihatsu":["Boon","Charade","Mira","Rocky","Terios"],"Dodge":["Challenger","Charger","Durango","Journey","Ram"],"Dongfeng":["AX7","Rich","T5"],"Fiat":["500","Doblo","Panda","Tipo"],"Ford":["Bronco","EcoSport","Edge","Escape","Everest","Explorer","F-150","Fiesta","Focus","Fusion","Kuga","Mondeo","Mustang","Ranger","Transit"],"GAC Motor":["GS3","GS4","GS5","GS8","Empow"],"Geely":["Coolray","Emgrand","Monjaro","Okavango"],"Genesis":["G70","G80","G90","GV70","GV80"],"GMC":["Acadia","Canyon","Savana","Sierra","Terrain","Yukon"],"Great Wall":["Cannon","Hover H3","Hover H5","Wingle"],"Haval":["H2","H6","H9","Jolion","Dargo"],"Honda":["Accord","City","Civic","CR-V","CR-Z","Element","Fit","HR-V","Insight","Jazz","Odyssey","Pilot","Ridgeline"],"Hyundai":["Accent","Azera","Creta","Elantra","Getz","Grand i10","Kona","Santa Fe","Sonata","Tucson","Venue"],"Infiniti":["EX","FX","G","Q30","Q50","QX50","QX60","QX80"],"Isuzu":["D-Max","MU-X","N-Series","Trooper"],"Jaguar":["E-Pace","F-Pace","F-Type","I-Pace","XE","XF","XJ"],"Jeep":["Cherokee","Compass","Gladiator","Grand Cherokee","Renegade","Wrangler"],"Kia":["Carens","Cerato/Forte","EV6","K5/Optima","Morning/Picanto","Rio","Sorento","Soul","Sportage","Seltos"],"Land Rover":["Defender","Discovery","Discovery Sport","Freelander","Range Rover","Range Rover Evoque","Range Rover Sport","Velar"],"Lexus":["CT","ES","GS","GX","IS","LC","LS","LX","NX","RC","RX","UX"],"Lincoln":["Aviator","Continental","Corsair","MKC","MKX","Navigator"],"Mahindra":["Scorpio","Thar","XUV300","XUV500","XUV700"],"Maserati":["Ghibli","Grecale","GranTurismo","Levante","Quattroporte"],"Mazda":["Mazda 2","Mazda 3","Mazda 5","Mazda 6","CX-3","CX-30","CX-5","CX-9","BT-50"],"Mercedes-Benz":["A-Class","B-Class","C-Class","CLA","CLS","E-Class","G-Class","GLA","GLB","GLC","GLE","GLS","S-Class","SL","Sprinter","Vito"],"MG":["3","5","6","HS","ZS","RX5"],"Mini":["Clubman","Cooper","Countryman","Paceman"],"Mitsubishi":["ASX","L200","Lancer","Mirage","Montero/Pajero","Outlander","Xpander"],"Nissan":["370Z","Almera","Altima","Frontier/Navara","Juke","March/Micra","Maxima","Murano","Pathfinder","Patrol","Qashqai","Rogue","Sentra","Sunny","Tiida","X-Trail"],"Opel":["Astra","Corsa","Insignia","Mokka","Zafira"],"Peugeot":["2008","206","207","208","3008","301","307","308","407","408","5008","508","Partner"],"Porsche":["718 Boxster/Cayman","911","Cayenne","Macan","Panamera","Taycan"],"Proton":["Gen-2","Iriz","Persona","Saga","X50","X70"],"Renault":["Captur","Duster","Kangoo","Koleos","Logan","Megane","Sandero"],"Rolls-Royce":["Cullinan","Ghost","Phantom","Wraith"],"Saab":["9-3","9-5"],"Seat":["Arona","Ateca","Ibiza","Leon"],"Škoda":["Fabia","Karoq","Kodiaq","Octavia","Superb"],"Smart":["ForTwo","ForFour"],"SsangYong / KGM":["Actyon","Korando","Musso","Rexton","Tivoli"],"Subaru":["BRZ","Crosstrek/XV","Forester","Impreza","Legacy","Outback","WRX"],"Suzuki":["Alto","Baleno","Celerio","Dzire","Ertiga","Grand Vitara","Jimny","Swift","Vitara"],"Tata":["Harrier","Nexon","Safari","Tiago"],"Tesla":["Model 3","Model S","Model X","Model Y","Cybertruck"],"Toyota":["4Runner","Avalon","Avensis","C-HR","Camry","Corolla","Corolla Cross","Fortuner","GR86","HiAce","Highlander","Hilux","Land Cruiser","Prado","Prius","RAV4","Rush","Sequoia","Sienna","Venza","Yaris"],"Vauxhall":["Astra","Corsa","Grandland","Insignia","Mokka"],"Volkswagen":["Amarok","Arteon","Atlas/Teramont","Golf","Jetta","Passat","Polo","T-Cross","Tiguan","Touareg","Transporter"],"Volvo":["C30","S40","S60","S80","S90","V40","V60","V90","XC40","XC60","XC90"],"Wuling":["Air EV","Almaz","Confero"],"Other / not listed":["Other"]};

const $ = id => document.getElementById(id);
const make = $('make'), model = $('model'), codeInput = $('codes'), statusBox = $('status'), report = $('reportContent');
const isNative = !!(window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform());
let demoParam = false; try { demoParam = new URLSearchParams(location.search).get('demo') === '1'; } catch (e) { /* ignore */ }
const appMode = isNative || demoParam;   // scanner screens exist in the installed app (or in a browser with ?demo=1)
document.body.classList.toggle('native', appMode);
const APP_VERSION = '4.3.1';

function opt(label, value = label) { const o = document.createElement('option'); o.textContent = label; o.value = value; return o; }
Object.keys(VEHICLES).sort().forEach(m => make.appendChild(opt(m)));
make.addEventListener('change', () => {
  model.innerHTML = '';
  model.appendChild(opt(VEHICLES[make.value] ? 'Select model' : 'Make first', ''));
  (VEHICLES[make.value] || []).forEach(m => model.appendChild(opt(m)));
  model.disabled = !make.value;
});

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* Offline, tap-first workshop observations. These describe what was noticed, not confirmed causes. */
const SYMPTOM_GROUPS = {
  misfire: [['shaking','Engine shakes / misfires'],['rough_idle','Rough or uneven idle'],['weak_power','Weak acceleration / loss of power'],['hard_start','Hard starting'],['stalling','Engine stalls'],['flashing_light','Flashing check-engine light']],
  mixture: [['rough_idle','Rough or uneven idle'],['weak_power','Weak acceleration'],['high_fuel','High fuel consumption'],['black_smoke','Black exhaust smoke'],['hard_start','Hard starting'],['stalling','Engine stalls']],
  exhaust: [['warning_light','Check-engine light'],['weak_power','Weak acceleration'],['high_fuel','High fuel consumption'],['exhaust_smell','Unusual exhaust smell'],['rattle','Rattling noise']],
  evap: [['fuel_smell','Fuel smell around vehicle'],['hard_start','Hard starting after refuelling'],['warning_light','Check-engine light'],['rough_idle','Rough idle']],
  oxygen: [['high_fuel','High fuel consumption'],['rough_idle','Rough or uneven idle'],['weak_power','Weak acceleration'],['warning_light','Check-engine light']],
  transmission: [['hard_shift','Hard or delayed gear changes'],['slipping','Gear slipping / RPM rises without matching speed'],['no_drive','Vehicle does not move normally'],['warning_light','Transmission warning light']],
  network: [['warning_light','Several warning lights at once'],['electrical','Intermittent electrical problems'],['no_start','Vehicle will not start'],['no_communication','Scanner cannot communicate with a module']],
  chassis: [['abs_light','ABS / brake warning light'],['steering_light','Steering warning light'],['handling','Change in handling or braking']],
  body: [['airbag_light','Airbag warning light'],['electrical','Electrical or body-system problem'],['lighting','Lighting problem']],
  cooling: [['overheat','Temperature too high / overheating'],['coolant_loss','Coolant level keeps dropping'],['heater','Cabin heater not working normally']],
  charging: [['battery_light','Battery / charging warning light'],['slow_crank','Slow engine cranking'],['electrical','Electrical problems']],
  general: [['rough_idle','Rough or uneven idle'],['hard_start','Hard starting'],['no_start','Engine will not start'],['weak_power','Weak acceleration / loss of power'],['stalling','Engine stalls'],['high_fuel','High fuel consumption'],['warning_light','Warning light on'],['noise','Unusual noise or vibration']]
};
const SYMPTOM_LABELS = {};
Object.keys(SYMPTOM_GROUPS).forEach(g => SYMPTOM_GROUPS[g].forEach(x => SYMPTOM_LABELS[x[0]] = x[1]));
let selectedSymptoms = [];
function symptomGroupFor(code) {
  if (/^P03[0-9A-C]|^P031[0-9A-C]/.test(code)) return 'misfire';
  if (/^P017[0-5]|lean|rich|fuel trim/i.test(code + ' ' + (DB()[code] && DB()[code].title || ''))) return 'mixture';
  if (/^P042[0-9]|catalyst/i.test(code + ' ' + (DB()[code] && DB()[code].title || ''))) return 'exhaust';
  if (/^P044[0-9]|^P045[0-9]|evap|purge/i.test(code + ' ' + (DB()[code] && DB()[code].title || ''))) return 'evap';
  if (/^P013|^P014|^P015|^P016|oxygen sensor|air.?fuel/i.test(code + ' ' + (DB()[code] && DB()[code].title || ''))) return 'oxygen';
  if (/^P07|transmission/i.test(code + ' ' + (DB()[code] && DB()[code].title || ''))) return 'transmission';
  if (/^U/.test(code)) return 'network';
  if (/^C/.test(code)) return 'chassis';
  if (/^B/.test(code)) return 'body';
  if (/^P01(1[5-9]|2[5-8])|coolant|temperature/i.test(code + ' ' + (DB()[code] && DB()[code].title || ''))) return 'cooling';
  if (/^P056|voltage|charging/i.test(code + ' ' + (DB()[code] && DB()[code].title || ''))) return 'charging';
  return 'general';
}
function renderSymptomPicker() {
  const box = $('symptomPicker'); if (!box) return;
  const codes = (codeInput.value.toUpperCase().match(/[PBCU][0-3][0-9A-F]{3}/g) || []);
  const groups = []; (codes.length ? codes : ['']).forEach(c => { const g = symptomGroupFor(c); if (groups.indexOf(g) < 0) groups.push(g); });
  const options = [], seen = {};
  groups.forEach(g => SYMPTOM_GROUPS[g].forEach(x => { if (!seen[x[0]]) { seen[x[0]] = 1; options.push(x); } }));
  selectedSymptoms = selectedSymptoms.filter(id => !!SYMPTOM_LABELS[id]);
  box.innerHTML = '<p class="muted small symptom-hint">Tap anything you notice. You can select more than one. This helps Smart Fix focus its guidance; it does not confirm a cause.</p><div class="symptom-grid">' + options.map(x => '<label class="symptom-option' + (selectedSymptoms.indexOf(x[0]) >= 0 ? ' selected' : '') + '"><input type="checkbox" data-symptom="' + esc(x[0]) + '"' + (selectedSymptoms.indexOf(x[0]) >= 0 ? ' checked' : '') + '><span>' + esc(x[1]) + '</span></label>').join('') + '</div><p class="symptom-count" id="symptomCount">' + selectedSymptoms.length + ' selected</p>';
}


/* ---------- what the code NUMBER itself tells us (SAE J2012 structure) ---------- */
function codeStructure(code) {
  const letter = code[0], d1 = code[1], d2 = code[2];
  const prefix = { P: 'Powertrain', B: 'Body', C: 'Chassis', U: 'Network/communication' }[letter];
  let kind = 'unknown', kindText = '';
  if (letter === 'P') {
    const n = parseInt(code.slice(1), 16);
    if (d1 === '0' || d1 === '2' || (d1 === '3' && n >= 0x3400)) kind = 'generic';
    else kind = 'manufacturer';
  } else {
    kind = d1 === '0' ? 'generic' : (d1 === '3' ? 'unknown' : 'manufacturer');
  }
  if (kind === 'generic') kindText = 'The first digits mark this as a generic (SAE-defined) code range, so the basic meaning should be the same on all makes, but this app has no verified entry for it.';
  else if (kind === 'manufacturer') kindText = 'The first digits mark this as a manufacturer-specific code range: the meaning depends on make, model, year and engine, so it must be looked up for the exact vehicle.';
  else kindText = 'This code falls in a reserved or unclear range; confirm the meaning with a trusted diagnostic database.';
  let system = '';
  if (letter === 'P') {
    if (code.slice(1, 3) === '0A') system = 'Hybrid propulsion system';
    else if (d1 === '0' || d1 === '1') {
      system = { '0': 'Fuel and air metering, auxiliary emission controls', '1': 'Fuel and air metering', '2': 'Fuel and air metering (injector circuits)', '3': 'Ignition system or misfire', '4': 'Auxiliary emission controls', '5': 'Vehicle speed, idle control and auxiliary inputs', '6': 'Computer and output circuits', '7': 'Transmission', '8': 'Transmission', '9': 'Transmission' }[d2] || '';
    }
  } else if (letter === 'U') system = 'Vehicle network / module communication';
  else if (letter === 'C') system = 'Chassis (brakes, steering, suspension)';
  else if (letter === 'B') system = 'Body (airbags, lighting, comfort systems)';
  return { prefix, kind, kindText, system };
}

function fallback(code) {
  const s = codeStructure(code);
  return {
    title: 'Code not found in the installed offline database.',
    causes: 'Bobby Car Doctor has no verified definition for ' + code + ', so it will not guess a cause. ' + s.kindText + ' Do not infer a failed part from the code alone.',
    symptoms: 'Unknown without the exact definition.' + (s.system ? ' From the code range, this is in the "' + s.system + '" area.' : ''),
    checks: 'Look up the exact definition for this make, model, year and engine in OEM service information or a trusted diagnostic database. Record freeze-frame data before clearing anything, check for related codes, and check for technical service bulletins.',
    repair: 'No repair direction is given until the definition is verified.',
    prevention: 'Follow the manufacturer maintenance schedule and repair confirmed faults promptly.',
    note: s.prefix + ' code. Do not guess; confirm with vehicle service information.',
    type: s.kind
  };
}
const DB = () => (typeof DTC_DATABASE !== 'undefined' ? DTC_DATABASE : {});
const dbReady = () => typeof DTC_DATABASE !== 'undefined';
function getCode(c) { return DB()[c] || fallback(c); }

/* Severity is set by code range (curated), not by guessing from words in the notes. */
function urgencyFor(c, d) {
  const n = parseInt(c.slice(1), 16);
  if (/^C/.test(c) || /^B0/.test(c) || c === 'P0217' || /^P05(2[0-4])$/.test(c) || /^P0A/.test(c))
    return {label:'Stop and check', cls:'high', text:'This can affect safety (brakes, steering, airbags, overheating, oil pressure or hybrid system). If the car behaves badly or a red warning light is on, park safely and get qualified help.'};
  if (/^P03[0-3]/.test(c) || /^P011[5-9]$/.test(c) || /^P012[5-8]$/.test(c) || /^P017[0-5]$/.test(c) || /^P04[23]\d$/.test(c) || /^P056/.test(c) || /^P07/.test(c) || /^U/.test(c) || /^P0A/.test(c))
    return {label:'Check soon', cls:'medium', text:'Not an emergency by itself, but do not ignore it. Avoid hard driving, and stop if the check-engine light flashes or the car shakes badly.'};
  return {label:'Test before replacing', cls:'normal', text:'Use symptoms and test results to confirm the cause before replacing parts.'};
}
function smartSteps(c, d) {
  const t = String(d.title || '');
  if (/^P030[0-9A-C]$/.test(c) || /^P031[0-9A-C]$/.test(c) || /misfire/i.test(t)) return [
    ['Severity first', 'Flashing check-engine light or heavy shaking: stop driving. Unburnt fuel can overheat and destroy the catalytic converter.'],
    ['Write it down', 'Record all stored and pending codes. Check for fuel-trim, injector or crank/cam codes too.'],
    ['Look before you buy', 'Engine off and cool: check that cylinder’s spark plug, coil, connector and wiring, and look for oil or water around the plug. Confirm which cylinder is No. 1 on this engine.'],
    ['Swap test', 'If the service procedure allows, swap that cylinder’s coil with a neighbour (one change at a time, mark the parts). If the misfire follows the coil, the coil is the cause. Do the same with the spark plug.'],
    ['If ignition is fine', 'Check injector, air leaks, fuel pressure, then compression and timing. Some of these need proper equipment.'],
    ['Finish', 'Repair only the confirmed cause, clear the codes, drive, and rescan.']];
  if (/fuel trim|system too (lean|rich)/i.test(t) || /^P017[0-5]$/.test(c)) return /\brich\b/i.test(t) ? [
    ['Write it down', 'Record freeze-frame data and fuel trims at idle and at raised RPM.'],
    ['Check the simple things', 'Dirty air filter, leaking or stuck-open injector, fuel pressure too high, stuck-open purge valve.'],
    ['Check the sensors', 'Airflow (MAF) reading and coolant temperature reading against the service specification. Do not assume the sensor is bad.'],
    ['Finish', 'Repair the confirmed cause, clear the codes, and recheck fuel trims.']] : [
    ['Write it down', 'Record freeze-frame data and fuel trims at idle and at raised RPM.'],
    ['Look for air leaks first', 'Check intake pipes, vacuum hoses and the PCV hose for splits and loose joints. Trims that are worse at idle often point to a leak.'],
    ['Airflow and fuel', 'Check MAF or MAP readings against the specification, and fuel pressure. Do not assume the sensor is bad.'],
    ['Finish', 'Fix the confirmed cause, clear the codes, and recheck fuel trims.']];
  if (/catalyst|catalytic/i.test(t) || /^P04[23]\d$/.test(c)) return [
    ['Do not start with the converter', 'Fix misfires, mixture faults, oil or coolant burning and exhaust leaks first. They can cause this code.'],
    ['Check the exhaust', 'Look for leaks or damage once everything is cool.'],
    ['Confirm before replacing', 'Use the specified test (live data or back-pressure). A converter is expensive; replace it only after the test confirms it.'],
    ['Finish', 'Clear the codes, complete the drive cycle, and rescan.']];
  if (/oxygen sensor|O2 sensor|air.?fuel ratio/i.test(t) || /^P01[3-6]\d$/.test(c)) return [
    ['Related codes first', 'Check for misfire, mixture codes and exhaust leaks. They can make a good sensor read wrong.'],
    ['Wiring', 'Check the connector and harness for damage, heat and contamination.'],
    ['Test the signal', 'Compare live data, heater operation and circuit readings with the service specification. Do not replace the sensor from the code title alone.'],
    ['Finish', 'Repair the confirmed cause, clear the codes, and recheck live data.']];
  if (/evap|evaporative|fuel tank|purge/i.test(t) || /^P04[4-5]\d$/.test(c)) return [
    ['Fuel cap first', 'Check the fuel cap is on tight and its seal is not cracked. A loose or bad cap is the most common cause and costs the least.'],
    ['Check hoses and canister', 'Look for cracked or disconnected EVAP hoses and a damaged canister.'],
    ['Test the valves', 'Test the purge and vent valves as the service procedure says. A smoke test finds small leaks.'],
    ['Finish', 'Clear the codes, drive, and rescan. EVAP checks can take a few drive cycles to finish.']];
  if (/^U/.test(c)) return [
    ['Battery first', 'Check battery and charging voltage (the voltage at the top right helps here). Weak voltage often causes false communication codes.'],
    ['Power and ground', 'Check fuses, grounds and connectors of the module that is not answering.'],
    ['Find the silent module', 'Scan all modules and see which one is not responding. Do not replace a module until power, ground and wiring are proven good.']];
  if (/circuit|range|performance|input|signal|voltage/i.test(t)) return [
    ['Write it down', 'Record freeze-frame data and any related codes.'],
    ['Check the wiring', 'Look at the connector, wiring, ground and fuse for that circuit before touching the part.'],
    ['Measure', 'Check the reference voltage, ground and signal with a multimeter or live data, and compare with the specification.'],
    ['Finish', 'Repair the confirmed cause, clear the codes, and rescan.']];
  return [
    ['Write it down', 'Record freeze-frame data, related codes and when the fault happens.'],
    ['Inspect and test', 'Do the checks listed under Details and follow the service manual. Do not replace parts from the code alone.'],
    ['Finish', 'Repair the confirmed cause, clear the codes, and rescan.']];
}
function detailsMarkup(d) {
  return `<div class="section"><h3>Possible causes</h3><p>${esc(d.causes)}</p></div><div class="section"><h3>Possible symptoms</h3><p>${esc(d.symptoms)}</p></div><div class="section"><h3>Recommended checks</h3><p>${esc(d.checks)}</p></div>${d.repair ? `<div class="section"><h3>Repair direction</h3><p>${esc(d.repair)}</p></div>` : ''}<div class="section"><h3>Prevention</h3><p>${esc(d.prevention)}</p></div><div class="section warn"><h3>Precautions / verification</h3><p>${esc(d.note)}</p></div>`;
}
/* ---------- vehicle details from a VIN (called by scanner.js). Fills only blank fields. ---------- */
const WMI = [['JTH','Lexus'],['JTJ','Lexus'],['2T2','Lexus'],['JT','Toyota'],['4T','Toyota'],['5T','Toyota'],['2T','Toyota'],['SB1','Toyota'],['19U','Acura'],['19V','Acura'],['JH4','Acura'],['JH','Honda'],['1HG','Honda'],['2HG','Honda'],['19X','Honda'],['SHH','Honda'],['JN','Nissan'],['1N4','Nissan'],['3N1','Nissan'],['5N1','Nissan'],['KM','Hyundai'],['5NP','Hyundai'],['5NM','Hyundai'],['KN','Kia'],['5XY','Kia'],['3KP','Kia'],['1FA','Ford'],['1FT','Ford'],['1FM','Ford'],['3FA','Ford'],['WF0','Ford'],['1G1','Chevrolet'],['1GC','Chevrolet'],['KL1','Chevrolet'],['WBA','BMW'],['WBS','BMW'],['WBY','BMW'],['5UX','BMW'],['WDB','Mercedes-Benz'],['WDC','Mercedes-Benz'],['WDD','Mercedes-Benz'],['W1K','Mercedes-Benz'],['4JG','Mercedes-Benz'],['WVW','Volkswagen'],['WVG','Volkswagen'],['3VW','Volkswagen'],['1VW','Volkswagen'],['WAU','Audi'],['WA1','Audi'],['JM','Mazda'],['JA3','Mitsubishi'],['JA4','Mitsubishi'],['JMB','Mitsubishi'],['JF1','Subaru'],['JF2','Subaru'],['4S3','Subaru'],['4S4','Subaru'],['JS','Suzuki'],['TSM','Suzuki']];
function vinYear(vin) {
  const i = 'ABCDEFGHJKLMNPRSTVWXY123456789'.indexOf(vin[9]);
  if (i < 0) return '';
  const y2 = 2010 + i, y1 = 1980 + i, max = new Date().getFullYear() + 1;
  return String(y2 <= max ? y2 : y1);
}
window.acdVehicleFromVin = function (vin) {
  try {
    vin = String(vin || '').toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return '';
    const got = [];
    if (!make.value) {
      const hit = WMI.find(w => vin.indexOf(w[0]) === 0);
      if (hit && VEHICLES[hit[1]]) { make.value = hit[1]; make.dispatchEvent(new Event('change')); got.push(hit[1]); }
    }
    if (!$('year').value.trim()) { const y = vinYear(vin); if (y) { $('year').value = y; got.push(y + ' (check)'); } }
    return got.join(', ');
  } catch (e) { return ''; }
};


function vehicleLine() {
  return [make.value, model.value, $('year').value.trim(), $('engine').value.trim()].filter(Boolean).join(' ');
}

/* ======================= SETTINGS (colours, text, font) ======================= */
const SKEY = 'bcd_settings_v42';
const DEF = { theme: 'dark', size: 'normal', color: 'auto', font: 'default', tips: false, safety: true, motion: true, speedU: 'kmh', tempU: 'c', pressU: 'kpa', autoLive: true, strip: true };
let showApp = appMode; try { showApp = appMode || new URLSearchParams(location.search).get('debug') === '1' || localStorage.getItem('bcd_debug') === '1'; } catch (e) { /* ignore */ }
const THEMES = [
  ['dark', 'Dark blue', '#0d2035', '#35c8ff'], ['black', 'Pure black', '#000000', '#35c8ff'], ['light', 'Light', '#ffffff', '#0a6fb4'],
  ['sand', 'Sand', '#fffaf0', '#b36b00'], ['forest', 'Forest', '#0d241a', '#43dd8c'], ['purple', 'Purple', '#1c1233', '#b98cff'],
  ['crimson', 'Crimson', '#261015', '#ff6b7d'], ['amber', 'Amber', '#261a0b', '#ffb347'], ['teal', 'Teal', '#0c2a2c', '#3de0d0'],
  ['slate', 'Slate', '#1f252c', '#8fb8ff'], ['contrast', 'High contrast', '#000000', '#ffe600']
];
const SIZES = { small: ['Small', '14px'], normal: ['Normal', '16px'], large: ['Large', '18px'], xl: ['Extra large', '20px'] };
const COLORS = [['auto', 'Auto', ''], ['white', 'White', '#ffffff'], ['yellow', 'Warm', '#ffe9a8'], ['green', 'Mint', '#c9f7d8'], ['blue', 'Sky', '#cfe8ff'], ['black', 'Black', '#000000']];
const FONTS = [
  ['default', 'Default', 'system-ui,Roboto,Arial,sans-serif'], ['clear', 'Clear', 'Verdana,Tahoma,"DejaVu Sans",sans-serif'],
  ['condensed', 'Compact', 'sans-serif-condensed,"Roboto Condensed","Arial Narrow",sans-serif'], ['serif', 'Serif', 'Georgia,"Noto Serif",serif'],
  ['casual', 'Casual', '"Comic Sans MS",casual,cursive'], ['mono', 'Typewriter', 'ui-monospace,"Droid Sans Mono",monospace']
];
function loadSettings() { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return Object.assign({}, DEF); } }
let S = loadSettings();
function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) { /* optional */ } }
function applySettings() {
  const r = document.documentElement;
  r.setAttribute('data-theme', S.theme);
  r.style.fontSize = (SIZES[S.size] || SIZES.normal)[1];
  const f = FONTS.find(x => x[0] === S.font) || FONTS[0]; r.style.setProperty('--font', f[2]);
  const c = COLORS.find(x => x[0] === S.color);
  if (c && c[2]) r.style.setProperty('--text', c[2]); else r.style.removeProperty('--text');
  r.setAttribute('data-motion', S.motion ? 'on' : 'off');
  document.body.classList.toggle('hide-safety', !S.safety);
  $('homeTips').hidden = !S.tips;
  if (typeof refreshLiveUi === 'function') refreshLiveUi();
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) { const t = THEMES.find(x => x[0] === S.theme); if (t) meta.setAttribute('content', t[2]); }
}
function renderSettings() {
  const pressed = v => ' aria-pressed="' + v + '"';
  const opts = '<div class="set-group"><h3>Options</h3>' +
    [['tips', 'Tips on Home', 'Show a short tip on the Home screen'], ['safety', 'Safety reminder', 'Show the short reminder under reports'], ['motion', 'Animations', 'Slide effect between screens']]
      .map(r => `<div class="row"><div>${r[1]}<small>${r[2]}</small></div><label class="switch"><input type="checkbox" data-sw="${r[0]}"${S[r[0]] ? ' checked' : ''}><span></span></label></div>`).join('') + '</div>';
  const seg = (key, items) => '<div class="seg">' + items.map(i => `<button type="button" data-set="${key}:${i[0]}"${pressed(S[key] === i[0])}>${i[1]}</button>`).join('') + '</div>';
  const appOpts = showApp ? '<div class="set-group"><h3>Car scanner</h3>' +
    [['autoLive', 'Start live data when connected', 'Shows speed, RPM and temperature at the top'], ['strip', 'Show readings at the top', 'Speed, RPM and temperature under the title']]
      .map(r => `<div class="row"><div>${r[1]}<small>${r[2]}</small></div><label class="switch"><input type="checkbox" data-sw="${r[0]}"${S[r[0]] ? ' checked' : ''}><span></span></label></div>`).join('') + '</div>' +
    '<div class="set-group"><h3>Units</h3><p class="muted small" style="margin:0 2px 6px">Speed</p>' + seg('speedU', [['kmh', 'km/h'], ['mph', 'mph']]) +
    '<p class="muted small" style="margin:10px 2px 6px">Temperature</p>' + seg('tempU', [['c', '°C'], ['f', '°F']]) +
    '<p class="muted small" style="margin:10px 2px 6px">Pressure</p>' + seg('pressU', [['kpa', 'kPa'], ['psi', 'psi']]) + '</div>' : '';
  const look =
    '<div class="set-group"><h3>Colour theme</h3><div class="swatches">' + THEMES.map(t => `<button class="sw" type="button" data-set="theme:${t[0]}"${pressed(S.theme === t[0])}><i style="background:linear-gradient(90deg,${t[2]} 60%,${t[3]} 60%)"></i>${t[1]}</button>`).join('') + '</div></div>' +
    '<div class="set-group"><h3>Text size</h3><div class="seg">' + Object.keys(SIZES).map(k => `<button type="button" data-set="size:${k}"${pressed(S.size === k)}>${SIZES[k][0]}</button>`).join('') + '</div></div>' +
    '<div class="set-group"><h3>Text colour</h3><div class="seg">' + COLORS.map(c => `<button type="button" data-set="color:${c[0]}"${pressed(S.color === c[0])}>${c[1]}</button>`).join('') + '</div></div>' +
    '<div class="set-group"><h3>Font</h3><div class="seg">' + FONTS.map(f => `<button type="button" style="font-family:${f[2]}" data-set="font:${f[0]}"${pressed(S.font === f[0])}>${f[1]}</button>`).join('') + '</div></div>';
  $('settingsBody').innerHTML = opts + appOpts +
    '<div class="actions"><button class="secondary" id="tourAgainBtn" type="button">Show the tour again</button></div>' +
    '<h3 class="set-title">Appearance</h3>' + look +
    '<div class="actions"><button class="secondary" id="resetSetBtn" type="button">Reset to default</button></div>' +
    '<p class="muted small center" style="margin-top:16px">Bobby Car Doctor ' + APP_VERSION + ' · <span id="aboutCount"></span></p>';
  showCount();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-set]');
  if (b) { const [k, v] = b.getAttribute('data-set').split(':'); S[k] = v; saveSettings(); applySettings(); renderSettings(); return; }
  if (e.target.closest('#resetSetBtn')) { S = Object.assign({}, DEF); saveSettings(); applySettings(); renderSettings(); return; }
  if (e.target.closest('#tourAgainBtn')) { startTour(); return; }
});
document.addEventListener('change', e => {
  const sw = e.target.closest('[data-sw]');
  if (sw) { S[sw.getAttribute('data-sw')] = sw.checked; saveSettings(); applySettings(); }
});

/* ======================= CODE CARDS ======================= */
const doneSteps = {};
function card(c) {
  const known = !!DB()[c], d = getCode(c), s = codeStructure(c), kind = d.type || s.kind, urg = urgencyFor(c, d);
  const v = vehicleLine();
  let ctx = '';
  if (known && v && (kind === 'manufacturer' || /bank|sensor|cylinder/i.test(d.title))) ctx = `<p class="muted small" style="margin:6px 0 0">${esc(v)}: confirm bank, sensor and cylinder numbering for this exact engine.</p>`;
  return `<article class="rcard"><div class="fault-head"><div><span class="code">${esc(c)}</span>${kind === 'manufacturer' ? '<span class="tag">Vehicle-specific</span>' : ''}</div><span class="severity ${urg.cls}">${esc(urg.label)}</span></div>` +
    `<div class="title">${esc(d.title)}</div><p class="muted small" style="margin:0">${known ? esc(s.system || 'Offline reference') : 'Not in the database — needs a verified lookup'}</p>${ctx}` +
    `<div class="card-actions"><button class="smart" type="button" data-go="fix/${esc(c)}"><strong>🔧 Smart Fix</strong><span>›</span></button><button type="button" data-go="details/${esc(c)}"><strong>📋 Details</strong><span>›</span></button></div></article>`;
}
function codeHead(c, d) {
  const urg = urgencyFor(c, d);
  return `<div class="rcard"><div class="fault-head"><span class="code">${esc(c)}</span><span class="severity ${urg.cls}">${esc(urg.label)}</span></div><div class="title">${esc(d.title)}</div></div><div class="note-box">${esc(urg.text)}</div>`;
}
function renderFix(c) {
  c = (c || '').toUpperCase(); const d = getCode(c), steps = smartSteps(c, d), done = doneSteps[c] || (doneSteps[c] = {});
  const k = steps.filter((_, i) => done[i]).length;
  const observed = lastReport && lastReport.codes.indexOf(c) >= 0 ? (lastReport.symptoms || []) : [];
  const observedBox = observed.length ? `<div class="section observed-box"><h3>Mechanic's observations</h3><p>${observed.map(x => esc(SYMPTOM_LABELS[x] || x)).join(' · ')}</p><p class="muted small">Use these observations to choose which checks to perform first. They do not prove the cause.</p></div>` : '';
  $('fixBody').innerHTML = codeHead(c, d) + observedBox +
    `<p class="prog" id="fixProg">${k} of ${steps.length} steps done${k === steps.length ? ' — now rescan to confirm the repair' : ''}</p><div class="progbar"><i style="width:${Math.round(100 * k / steps.length)}%"></i></div>` +
    steps.map((st, i) => `<div class="smart-step${done[i] ? ' done' : ''}" data-i="${i}"><h4>${i + 1}. ${esc(st[0])}</h4><p>${esc(st[1])}</p><div class="smart-controls"><button type="button" class="secondary smart-done">${done[i] ? '✓ Done (tap to undo)' : '✓ Check completed'}</button><button type="button" class="secondary" data-go="details/${esc(c)}">? Need more help</button></div></div>`).join('') +
    `<p class="muted small center" style="margin-top:12px">General guidance. Exact tests and values depend on the vehicle. A code is a clue, not proof that a part has failed.</p>`;
}
function renderDetails(c) {
  c = (c || '').toUpperCase(); const d = getCode(c);
  $('detailsBody').innerHTML = codeHead(c, d) + detailsMarkup(d) + `<div class="actions"><button class="primary" type="button" data-go="fix/${esc(c)}">🔧 Open Smart Fix</button></div>`;
}

/* ======================= HISTORY ======================= */
const HISTORY_KEY = 'bcd_history_v41';
const HISTORY_TTL = 7 * 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 20;
function readHistory() {
  try { const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); const clean = arr.filter(x => x && x.time && Date.now() - x.time < HISTORY_TTL).slice(0, HISTORY_LIMIT); localStorage.setItem(HISTORY_KEY, JSON.stringify(clean)); return clean; } catch (e) { return []; }
}
function saveHistory(codes, demo) {
  try {
    const old = readHistory();
    old.unshift({ time: Date.now(), make: make.value, model: model.value, year: $('year').value.trim(), engine: $('engine').value.trim(), vehicle: vehicleLine() || 'Vehicle not specified', demo: !!demo, codes: codes.slice(0, 12), symptoms: selectedSymptoms.slice(), symptomNote: $('symptoms').value.trim().slice(0, 300) });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(old.slice(0, HISTORY_LIMIT)));
  } catch (e) { /* storage is optional; never block diagnosis */ }
}
function renderHistory() {
  const list = $('historyList'), h = readHistory();
  list.innerHTML = h.length ? h.map((x, i) => `<div class="history-entry"><strong>${x.demo ? '🎬 DEMO · ' : ''}${esc(x.codes.join(', '))}</strong><p class="muted small">${esc(x.vehicle)} · ${new Date(x.time).toLocaleString()}</p><button class="secondary history-open" data-index="${i}" type="button">Open this report</button></div>`).join('') : '<div class="empty"><p class="muted">No recent reports on this phone.</p></div>';
}
function setSel(sel, val) { if (val) sel.value = val; }

/* ======================= SCREENS (tap → next page) ======================= */
const SCREENS = ['home', 'diagnose', 'results', 'fix', 'details', 'share', 'scan', 'live', 'history', 'settings'];
const NATIVE_ONLY = ['scan', 'live'];
const PARENT = { fix: 'results', details: 'results', share: 'results', results: 'diagnose' };
let navDepth = 0, lastReport = null;
function parseHash() {
  const h = (location.hash || '').replace(/^#\/?/, ''), i = h.indexOf('/');
  const name = i < 0 ? h : h.slice(0, i), arg = i < 0 ? '' : decodeURIComponent(h.slice(i + 1));
  return { name: SCREENS.includes(name) ? name : 'home', arg };
}
function show(name, arg) {
  SCREENS.forEach(n => $('s-' + n).classList.toggle('active', n === name));
  let title = $('s-' + name).getAttribute('data-title');
  if ((name === 'fix' || name === 'details') && arg) title = (name === 'fix' ? 'Smart Fix · ' : 'Details · ') + arg.toUpperCase();
  $('screenTitle').textContent = title;
  $('backBtn').hidden = name === 'home';
  $('tbLogo').style.display = name === 'home' ? '' : 'none';
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.getAttribute('data-nav') === (PARENT[name] ? 'diagnose' : name)));
  if (name === 'fix') renderFix(arg);
  else if (name === 'details') renderDetails(arg);
  else if (name === 'history') renderHistory();
  else if (name === 'settings') renderSettings();
  else if (name === 'share') renderShare();
  else if (name === 'results') renderResultsScreen();
  else if (name === 'diagnose') renderQuick();
  window.scrollTo(0, 0);
}
function route() {
  let { name, arg } = parseHash();
  if (NATIVE_ONLY.includes(name) && !appMode) name = 'home';
  if ((name === 'fix' || name === 'details') && !arg) name = 'results';
  show(name, arg);
}
function go(path) { if (location.hash === '#/' + path) { route(); return; } navDepth++; history.pushState({ d: navDepth }, '', '#/' + path); route(); }
function goTab(path) { history.replaceState({ d: navDepth }, '', '#/' + path); route(); }
window.addEventListener('hashchange', route);
window.addEventListener('popstate', e => { navDepth = (e.state && e.state.d) || 0; route(); });
function goBack() {
  const { name } = parseHash();
  if (navDepth > 0) { history.back(); return; }
  goTab(PARENT[name] || 'home');
}
$('backBtn').addEventListener('click', goBack);
$('settingsBtn').addEventListener('click', () => go('settings'));
$('voltPill').addEventListener('click', () => go('live'));

/* ======================= REPORT (diagnose → results) ======================= */
let pendingDiagnose = false;
function diagnose() {
  try {
    const raw = codeInput.value.trim();
    if (!dbReady()) { pendingDiagnose = true; statusBox.textContent = 'The code database is still loading. It will run by itself as soon as it is ready.'; return; }
    pendingDiagnose = false;
    if (!raw) { statusBox.textContent = 'Enter a code, for example P0301.'; codeInput.focus(); return; }
    const codes = [...new Set(raw.toUpperCase().match(/[PBCU][0-3][0-9A-F]{3}/g) || [])];
    if (!codes.length) { statusBox.textContent = 'No code recognized. Use a format like P0301, B1234, C1234 or U0100.'; return; }
    const year = $('year').value.trim();
    let warn = '';
    if (year && !/^(19|20)\d{2}$/.test(year)) warn = 'Note: "' + year + '" does not look like a 4-digit year.';
    else if (year && +year < 1996) warn = 'Note: vehicles before about 1996 may not use standard OBD-II codes.';
    for (const k in doneSteps) delete doneSteps[k];
    lastReport = { codes, vehicle: vehicleLine() || 'Vehicle not specified', symptoms: selectedSymptoms.slice(), symptomNote: $('symptoms').value.trim(), time: Date.now(), demo: !!window.acdDemoScan };
    window.acdDemoScan = false;
    saveHistory(codes, !!lastReport.demo);
    const known = codes.filter(c => DB()[c]).length;
    statusBox.textContent = `${codes.length} code(s) processed offline (${known} in the database, ${codes.length - known} not).` + (warn ? ' ' + warn : '');
    $('lastReportTile').hidden = false;
    go('results');
  } catch (e) { statusBox.textContent = 'Diagnostic error: ' + e.message; console.error(e); }
}
function renderResultsScreen() {
  const has = !!lastReport;
  $('resultsEmpty').hidden = has; $('resultsBox').hidden = !has;
  if (!has) return;
  $('vehicleSummary').textContent = lastReport.vehicle + (lastReport.demo ? ' · DEMO' : '');
  report.innerHTML = (lastReport.demo ? '<div class="demo-note">🎬 DEMO: simulated codes from the demo car. This is not a real scan.</div>' : '') + (lastReport.symptoms && lastReport.symptoms.length ? `<div class="section"><h3>What the mechanic noticed</h3><p>${lastReport.symptoms.map(x => esc(SYMPTOM_LABELS[x] || x)).join(' · ')}</p></div>` : '') + (lastReport.symptomNote ? `<div class="section"><h3>Additional note</h3><p>${esc(lastReport.symptomNote)}</p></div>` : '') + lastReport.codes.map(card).join('');
}
$('runBtn').addEventListener('click', diagnose);
codeInput.addEventListener('input', renderSymptomPicker);
document.addEventListener('change', e => { const cb = e.target.closest('[data-symptom]'); if (!cb) return; const id = cb.getAttribute('data-symptom'); if (cb.checked && selectedSymptoms.indexOf(id) < 0) selectedSymptoms.push(id); else if (!cb.checked) selectedSymptoms = selectedSymptoms.filter(x => x !== id); cb.closest('.symptom-option').classList.toggle('selected', cb.checked); const count = $('symptomCount'); if (count) count.textContent = selectedSymptoms.length + ' selected'; });
codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); diagnose(); } });
$('sampleBtn').addEventListener('click', () => {
  codeInput.value = 'P0301'; renderSymptomPicker();
  if (!make.value) { make.value = 'Toyota'; make.dispatchEvent(new Event('change')); model.value = 'Camry'; }
  diagnose();
});
$('clearBtn').addEventListener('click', () => {
  codeInput.value = ''; $('symptoms').value = ''; selectedSymptoms = []; renderSymptomPicker(); $('year').value = ''; $('engine').value = '';
  statusBox.textContent = 'Cleared.'; codeInput.focus();
});

/* quick-pick codes (only codes that exist in the database) */
const QUICK = ['P0300', 'P0301', 'P0171', 'P0172', 'P0420', 'P0442', 'P0128', 'P0113', 'P0335', 'P0401', 'P0500', 'P0505'];
function renderQuick() {
  const box = $('quickCodes'); if (!box) return;
  box.innerHTML = dbReady() ? QUICK.filter(c => DB()[c]).map(c => `<button class="chip" type="button" data-quick="${c}">${c}</button>`).join('') : '';
}

/* ======================= SHARE ======================= */
function nativePlugin(name) {
  const C = window.Capacitor;
  if (C && C.Plugins && C.Plugins[name]) return C.Plugins[name];
  if (C && typeof C.registerPlugin === 'function') return C.registerPlugin(name);
  throw new Error(name + ' is not available');
}
function reportText(short) {
  if (!lastReport) return '';
  const when = new Date(lastReport.time).toLocaleString();
  const demoTag = lastReport.demo ? '*** DEMO: SIMULATED DATA, NOT FROM A REAL CAR ***\n' : '';
  if (short) return demoTag.replace(/\n$/, ' ') + 'Bobby Car Doctor: ' + lastReport.vehicle + ' | ' + lastReport.codes.map(c => c + ' ' + getCode(c).title + ' (' + urgencyFor(c, getCode(c)).label + ')').join('; ') + '. Possible causes only; have a mechanic confirm.';
  const lines = lastReport.codes.map(c => {
    const d = getCode(c), u = urgencyFor(c, d);
    return '• ' + c + ' — ' + d.title + '\n   ' + u.label + '. ' + u.text;
  });
  return demoTag + 'BOBBY CAR DOCTOR — report\nVehicle: ' + lastReport.vehicle + '\nDate: ' + when + (lastReport.symptoms && lastReport.symptoms.length ? '\nObserved: ' + lastReport.symptoms.map(x => SYMPTOM_LABELS[x] || x).join(', ') : '') + (lastReport.symptomNote ? '\nNote: ' + lastReport.symptomNote : '') + '\n\nCodes:\n' + lines.join('\n\n') + '\n\nThese are possible causes, not a confirmed diagnosis. A mechanic should confirm before parts are replaced.';
}
function renderShare() {
  if (!lastReport) { goTab('results'); return; }
  $('shareText').value = reportText(false); $('shareStatus').textContent = '';
  $('fileBtn').textContent = isNative ? 'Send as file' : 'Download file';
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {
    const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (x) { /* ignore */ } a.remove(); return ok;
  }
}
const sstat = t => { $('shareStatus').textContent = t; };
async function shareSheet() {
  const text = reportText(false);
  if (isNative) {
    try { await nativePlugin('Share').share({ title: 'Bobby Car Doctor report', text, dialogTitle: 'Share report' }); sstat('Share menu opened.'); return; }
    catch (e) { if (/cancel/i.test(String(e && e.message))) return; }
  }
  if (navigator.share) { try { await navigator.share({ title: 'Bobby Car Doctor report', text }); sstat('Share menu opened.'); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  sstat((await copyText(text)) ? 'The share menu is not available here, so the report was copied. Paste it in any app.' : 'Share is not available here. Select the text above and copy it.');
}
async function shareFile() {
  const text = reportText(false), name = 'Bobby-Car-Doctor-report.txt';
  if (isNative) {
    try {
      const r = await nativePlugin('Filesystem').writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
      await nativePlugin('Share').share({ title: 'Bobby Car Doctor report', files: [r.uri], dialogTitle: 'Send report file' });
      sstat('File ready to send.'); return;
    } catch (e) { if (/cancel/i.test(String(e && e.message))) return; sstat('Could not make the file here: ' + (e && e.message ? e.message : e)); return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  sstat('File downloaded.');
}
$('shareNowBtn').addEventListener('click', shareSheet);
$('fileBtn').addEventListener('click', shareFile);
$('copyShareBtn').addEventListener('click', async () => sstat((await copyText(reportText(false))) ? 'Report copied.' : 'Copy unavailable; select the text above.'));
$('copyBtn').addEventListener('click', async () => { statusBox.textContent = (await copyText(reportText(false))) ? 'Report copied.' : 'Copy unavailable.'; });
$('waBtn').addEventListener('click', () => { $('waBtn').href = 'https://wa.me/?text=' + encodeURIComponent(reportText(false)); });
$('smsBtn').addEventListener('click', () => { $('smsBtn').href = 'sms:?body=' + encodeURIComponent(reportText(true)); });

/* ======================= INFO SHEET + TOUR ======================= */
function showCount() {
  const n = Object.keys(DB()).length, t = dbReady() ? n + ' codes in the local database' : 'loading code database…';
  ['dbCount', 'aboutCount'].forEach(id => { if ($(id)) $(id).textContent = t; });
}
function openInfo() {
  $('infoBody').innerHTML =
    '<h3>What this app does</h3><p>Enter a trouble code and get the meaning, possible causes, checks and repair direction, all offline.</p>' +
    '<h3>How to use it</h3><p>1. Tap <b>Diagnose</b>, type a code.<br>2. Open <b>Smart Fix</b> for step-by-step checks, or <b>Details</b> for the full notes.<br>3. Tap <b>Share report</b> to send it.</p>' +
    (appMode ? '<h3>Scan car</h3><p>Plug a Bluetooth OBD-II adapter into the car, turn the ignition on, then use <b>Scan car</b>. The battery voltage shows at the top right once connected. Nothing is cleared unless you confirm.</p><h3>Which adapters work</h3><p>Standard <b>ELM327</b> Bluetooth adapters. Adapters from Launch, GOLO, DiagZone and similar brands use a private language and are not supported. Tap <b>Demo mode</b> on the Scan screen to see how the app works without a car (simulated data, clearly labelled).</p>' : '') +
    '<h3>Important notice</h3><p>This is an offline reference. It gives possible causes, not a confirmed diagnosis. Meanings of manufacturer-specific codes depend on the exact vehicle. Confirm with service information and proper tests. If brakes, steering, oil pressure, fuel leaks, overheating or severe shaking occur, stop safely and get qualified help. Never work under a car held only by a jack.</p>' +
    '<p class="muted small">Bobby Car Doctor ' + APP_VERSION + ' · ' + (dbReady() ? Object.keys(DB()).length + ' codes' : 'database loading') + '. New codes come with app updates.</p>';
  $('infoSheet').hidden = false;
}
$('appInfoBtn').addEventListener('click', openInfo);
$('infoClose').addEventListener('click', () => { $('infoSheet').hidden = true; });
$('infoSheet').addEventListener('click', e => { if (e.target === $('infoSheet')) $('infoSheet').hidden = true; });

const TOUR_KEY = 'bcd_tour_done_v42';
const TOUR = [
  ['🔎', 'Type a code', 'Tap Diagnose, enter a code like P0301, and get the meaning in seconds. No internet needed.'],
  ['🔧', 'Smart Fix', 'Every code has step-by-step checks. Tick each step as you finish it.'],
  appMode ? ['🔌', 'Scan the car', 'Plug in your Bluetooth adapter, tap Scan car, and watch the battery voltage at the top right.'] : ['📤', 'Share it', 'Send the report to a customer by WhatsApp, SMS, Bluetooth or any app on your phone.']
];
let tourI = 0;
function drawTour() {
  const t = TOUR[tourI];
  $('tourBody').innerHTML = `<div class="big">${t[0]}</div><h2>${esc(t[1])}</h2><p class="muted">${esc(t[2])}</p>`;
  $('tourDots').innerHTML = TOUR.map((_, i) => `<i class="${i === tourI ? 'on' : ''}"></i>`).join('');
  $('tourNext').textContent = tourI === TOUR.length - 1 ? 'Get started' : 'Next';
}
function startTour() { tourI = 0; drawTour(); $('tour').hidden = false; }
function endTour() { $('tour').hidden = true; try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) { /* ignore */ } }
$('tourNext').addEventListener('click', () => { if (tourI >= TOUR.length - 1) endTour(); else { tourI++; drawTour(); } });
$('tourSkip').addEventListener('click', endTour);

/* ======================= TAPS ======================= */
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { go(g.getAttribute('data-go')); return; }
  const n = e.target.closest('[data-nav]'); if (n) { goTab(n.getAttribute('data-nav')); return; }
  const q = e.target.closest('[data-quick]');
  if (q) { const c = q.getAttribute('data-quick'), cur = codeInput.value.trim(); if (!cur.toUpperCase().includes(c)) codeInput.value = cur ? cur.replace(/[,\s]+$/, '') + ', ' + c : c; renderSymptomPicker(); return; }
  const done = e.target.closest('.smart-done');
  if (done) {
    const step = done.closest('.smart-step'), c = parseHash().arg.toUpperCase(), i = Number(step.getAttribute('data-i'));
    const m = doneSteps[c] || (doneSteps[c] = {}); m[i] = !m[i]; renderFix(c); return;
  }
  const hist = e.target.closest('.history-open');
  if (hist) {
    const item = readHistory()[Number(hist.dataset.index)];
    if (item) {
      codeInput.value = item.codes.join(', ');
      if (item.make && VEHICLES[item.make]) { make.value = item.make; make.dispatchEvent(new Event('change')); setSel(model, item.model); }
      $('year').value = item.year || ''; $('engine').value = item.engine || ''; selectedSymptoms = Array.isArray(item.symptoms) ? item.symptoms.slice() : []; $('symptoms').value = item.symptomNote || (typeof item.symptoms === 'string' ? item.symptoms : ''); renderSymptomPicker();
      window.acdDemoScan = !!item.demo;
      diagnose();
    }
  }
});
if ($('clearHistoryBtn')) $('clearHistoryBtn').addEventListener('click', () => { try { localStorage.removeItem(HISTORY_KEY); } catch (e) { /* ignore */ } renderHistory(); });

window.acdOnDb = () => { try { window.acdFlags && (window.acdFlags.db = 1); } catch (e) { /* ignore */ } showCount(); renderQuick(); if (pendingDiagnose) diagnose(); };
showCount();
renderSymptomPicker();
/* Optional: open the page with ?codes=P0133,P0498 to prefill and run a diagnosis. */
try {
  const q = new URLSearchParams(location.search).get('codes');
  if (q) { codeInput.value = q.split(',').join(', '); renderSymptomPicker(); setTimeout(diagnose, 0); }
} catch (e) { /* ignore */ }

/* ======================= LIVE READINGS (top strip + gauges), units ======================= */
const LIVE = {}; let VOLT = null;
function unitInfo(pid, v, d) {
  d = d || (window.OBD && window.OBD.PIDS && window.OBD.PIDS[pid]);
  if (pid === 0x0D && S.speedU === 'mph') return { n: v * 0.621371, dec: 0, unit: 'mph' };
  if ((pid === 0x05 || pid === 0x0F) && S.tempU === 'f') return { n: v * 1.8 + 32, dec: 0, unit: '°F' };
  if (pid === 0x0B && S.pressU === 'psi') return { n: v * 0.145038, dec: 1, unit: 'psi' };
  return { n: v, dec: d ? d.dec : 0, unit: d ? d.unit : '' };
}
window.acdFmt = (pid, v, d) => { const u = unitInfo(pid, v, d); return { text: u.n.toFixed(u.dec), unit: u.unit }; };
window.acdGet = k => S[k];
const GDEF = {
  speed: { label: 'Speed', min: 0, max: () => (S.speedU === 'mph' ? 125 : 200) },
  rpm: { label: 'Engine', min: 0, max: () => 8000 },
  temp: { label: 'Coolant', min: () => (S.tempU === 'f' ? 104 : 40), max: () => (S.tempU === 'f' ? 266 : 130) },
  volt: { label: 'Battery', min: 10, max: 16 }
};
const val = x => (typeof x === 'function' ? x() : x);
function buildDash() {
  const el = $('dash'); if (!el) return;
  const arc = 'M26.06 93.94 A48 48 0 1 1 93.94 93.94';
  el.innerHTML = Object.keys(GDEF).map(k => `<div class="gauge"><svg viewBox="0 0 120 112" role="img" aria-label="${GDEF[k].label}"><path class="g-bg" d="${arc}"/><path class="g-val" id="gv-${k}" d="${arc}" pathLength="100" stroke-dasharray="0 100"/><text class="g-num" id="gn-${k}" x="60" y="66">—</text><text class="g-unit" id="gu-${k}" x="60" y="82"></text><text class="g-label" x="60" y="106">${GDEF[k].label}</text></svg></div>`).join('');
}
function setGauge(k, raw, text, unit, cls) {
  const bar = $('gv-' + k); if (!bar) return;
  if (raw === null || raw === undefined) { bar.setAttribute('stroke-dasharray', '0 100'); bar.setAttribute('class', 'g-val'); $('gn-' + k).textContent = '—'; $('gu-' + k).textContent = ''; return; }
  const mn = val(GDEF[k].min), mx = val(GDEF[k].max), f = Math.max(0, Math.min(1, (raw - mn) / (mx - mn)));
  bar.setAttribute('stroke-dasharray', (f * 100).toFixed(1) + ' 100'); bar.setAttribute('class', 'g-val ' + (cls || ''));
  $('gn-' + k).textContent = text; $('gu-' + k).textContent = unit;
}
function voltCls(v) { return v < 12 || v > 15.2 ? 'red' : v < 12.4 || v > 14.8 ? 'amber' : v < 13 ? 'green' : v < 13.2 ? 'grey' : 'blue'; }
function refreshLiveUi() {
  if (!$('dash')) return;
  const has = k => LIVE[k] !== undefined;
  const sp = has(0x0D) ? unitInfo(0x0D, LIVE[0x0D]) : null, rp = has(0x0C) ? LIVE[0x0C] : null, tp = has(0x05) ? unitInfo(0x05, LIVE[0x05]) : null;
  setGauge('speed', sp && sp.n, sp && sp.n.toFixed(0), sp && sp.unit, '');
  setGauge('rpm', rp, rp !== null ? rp.toFixed(0) : '', 'rpm', rp !== null && rp >= 6000 ? 'red' : rp !== null && rp >= 4500 ? 'amber' : 'green');
  setGauge('temp', tp && tp.n, tp && tp.n.toFixed(0), tp && tp.unit, has(0x05) ? (LIVE[0x05] > 115 ? 'red' : LIVE[0x05] > 105 ? 'amber' : LIVE[0x05] < 60 ? 'blue' : 'green') : '');
  setGauge('volt', VOLT, VOLT !== null ? VOLT.toFixed(1) : '', 'V', VOLT !== null ? voltCls(VOLT) : '');
  const strip = $('liveStrip'); if (!strip) return;
  strip.hidden = !(appMode && S.strip && (has(0x0D) || has(0x0C) || has(0x05)));
  $('lcSpeed').textContent = sp ? sp.n.toFixed(0) : '—'; $('luSpeed').textContent = sp ? sp.unit : (S.speedU === 'mph' ? 'mph' : 'km/h');
  $('lcRpm').textContent = rp !== null ? rp.toFixed(0) : '—';
  $('lcTemp').textContent = tp ? tp.n.toFixed(0) : '—'; $('luTemp').textContent = S.tempU === 'f' ? '°F' : '°C';
  $('lcTempChip').classList.toggle('hot', has(0x05) && LIVE[0x05] > 115);
  if (typeof window.acdRedrawTiles === 'function') window.acdRedrawTiles();
}
window.acdOnLive = (pid, v) => { if (pid === null) { Object.keys(LIVE).forEach(k => delete LIVE[k]); VOLT = null; } else LIVE[pid] = v; refreshLiveUi(); };
window.acdOnVolt = v => { VOLT = v; refreshLiveUi(); };
window.acdSetDemo = on => { const bar = $('demoBar'); if (bar) bar.hidden = !on; const off = $('demoOffBtn'); if (off) off.style.display = isNative ? '' : 'none'; };
if ($('demoOffBtn')) $('demoOffBtn').addEventListener('click', () => { if (window.acdDemoOff) window.acdDemoOff(); });
if (appMode) buildDash();

applySettings();
history.replaceState({ d: 0 }, '', location.hash && location.hash !== '#' ? location.hash : '#/home');
route();
try { if (!localStorage.getItem(TOUR_KEY)) startTour(); } catch (e) { /* ignore */ }
}
