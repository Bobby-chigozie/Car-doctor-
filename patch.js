// Helper used by the cloud build. Usage: node patch.js prepare | node patch.js android
const fs = require('fs'), path = require('path');
const step = process.argv[2];

if (step === 'prepare') {
  // copy the web app files into www/ (Capacitor's web folder)
  fs.mkdirSync('www', { recursive: true });
  for (const f of ['index.html', 'style.css', 'app.js', 'dtc-database.js', 'obd.js', 'scanner.js', 'logo.png']) {
    if (!fs.existsSync(f)) throw new Error('Missing file: ' + f);
    fs.copyFileSync(f, path.join('www', f));
  }
  console.log('www/ ready');
} else if (step === 'android') {
  const pkgDir = 'android/app/src/main/java/com/aicardoctor/app';
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.copyFileSync('ObdBluetoothPlugin.java', path.join(pkgDir, 'ObdBluetoothPlugin.java'));
  fs.writeFileSync(path.join(pkgDir, 'MainActivity.java'),
`package com.aicardoctor.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ObdBluetoothPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);
  const mf = 'android/app/src/main/AndroidManifest.xml';
  let x = fs.readFileSync(mf, 'utf8');
  if (!x.includes('BLUETOOTH_CONNECT')) {
    const perms =
`    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
    <uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />
    <uses-feature android:name="android.hardware.bluetooth" android:required="false" />

    <application`;
    if (!x.includes('<application')) throw new Error('Manifest has no <application> tag');
    x = x.replace('<application', perms);
    fs.writeFileSync(mf, x);
  }

  // ----- App name: "Bobby Car Doctor" -----
  try {
    const sf = 'android/app/src/main/res/values/strings.xml';
    if (fs.existsSync(sf)) {
      let sx = fs.readFileSync(sf, 'utf8');
      sx = sx.replace(/(<string name="app_name">)[^<]*(<\/string>)/, '$1Bobby Car Doctor$2')
             .replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, '$1Bobby Car Doctor$2');
      fs.writeFileSync(sf, sx);
    }
  } catch (e) { console.log('WARNING: could not set app name: ' + e.message); }

  // ----- App icon: the Bobby Car Doctor logo (ready-made PNGs from the icons/ folder, no image tools needed) -----
  // If anything fails the build still succeeds and keeps the default icon.
  try {
    const res = 'android/app/src/main/res';
    // Be forgiving about folder names typed by hand on a phone ("icons " with a space, "midmap-hdpi", "xxxhdpi"...)
    const iconsDir = fs.readdirSync('.').find(n => n.trim().toLowerCase() === 'icons' && fs.statSync(n).isDirectory());
    if (!iconsDir) throw new Error('icons folder is missing');
    const norm = n => { n = n.trim().toLowerCase().replace(/^midmap/, 'mipmap'); if (/^(m|h|xh|xxh|xxxh)dpi$/.test(n)) n = 'mipmap-' + n; return n; };
    let copied = 0;
    for (const d of fs.readdirSync(iconsDir)) {
      const from = path.join(iconsDir, d);
      if (!fs.statSync(from).isDirectory()) continue;
      const to = path.join(res, norm(d));
      fs.mkdirSync(to, { recursive: true });
      for (const f of fs.readdirSync(from)) { fs.copyFileSync(path.join(from, f), path.join(to, f.trim())); copied++; }
    }
    if (!copied) throw new Error('no icon files found');
    fs.mkdirSync(path.join(res, 'values'), { recursive: true });
    fs.writeFileSync(path.join(res, 'values', 'bobby_icon.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="bobby_icon_bg">#020B1A</color>\n</resources>\n');
    const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/bobby_icon_bg"/>\n    <foreground android:drawable="@mipmap/bobby_icon_fg"/>\n</adaptive-icon>\n';
    fs.mkdirSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true });
    fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive);
    fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);
    console.log('app icon set from icons/ (' + copied + ' files)');
  } catch (e) { console.log('WARNING: app icon not changed (' + e.message + '). The build continues with the default icon.'); }

  // ----- Launch screen: pure black, the round logo small in the centre, nothing stretched -----
  try {
    const res = 'android/app/src/main/res';
    if (!fs.existsSync(path.join(res, 'drawable-nodpi', 'splash_logo.png'))) throw new Error('splash_logo.png was not found, so the default launch screen is kept');
    // remove Capacitor's default splash pictures (they would override ours or clash with it)
    const walk = dir => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/^splash\.(png|jpg|xml)$/.test(f)) { fs.unlinkSync(p); } } };
    walk(res);
    fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
    fs.writeFileSync(path.join(res, 'drawable', 'splash.xml'),
'<?xml version="1.0" encoding="utf-8"?>\n<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n    <item android:drawable="@color/bobby_splash_bg"/>\n    <item>\n        <bitmap android:src="@drawable/splash_logo" android:gravity="center"/>\n    </item>\n</layer-list>\n');
    const cf = path.join(res, 'values', 'bobby_icon.xml');
    let cx = fs.readFileSync(cf, 'utf8');
    if (!cx.includes('bobby_splash_bg')) cx = cx.replace('</resources>', '    <color name="bobby_splash_bg">#000000</color>\n</resources>');
    fs.writeFileSync(cf, cx);
    // Android 12+ and the compat splash: black background and our logo
    const sf2 = path.join(res, 'values', 'styles.xml');
    if (fs.existsSync(sf2)) {
      let st = fs.readFileSync(sf2, 'utf8');
      const m = st.match(/<style name="AppTheme\.NoActionBarLaunch"[^>]*parent="([^"]*)"[^>]*>/);
      if (m && /Theme\.SplashScreen/.test(m[1]) && !st.includes('windowSplashScreenBackground')) {
        st = st.replace(m[0], m[0] + '\n        <item name="windowSplashScreenBackground">@color/bobby_splash_bg</item>\n        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_logo</item>');
        fs.writeFileSync(sf2, st);
      }
    }
    console.log('launch screen set (black, centred logo)');
  } catch (e) { console.log('WARNING: launch screen not changed (' + e.message + ').'); }

  console.log('android project patched');
} else {
  throw new Error('Usage: node patch.js prepare|android');
}
