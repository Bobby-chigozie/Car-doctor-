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

  // ----- App icon: the Bobby logo (needs ImageMagick "convert", which the GitHub runner has) -----
  // If anything fails, the build still succeeds and keeps the default icon.
  try {
    const { execFileSync } = require('child_process');
    const res = 'android/app/src/main/res';
    const sizes = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] }; // [old-style icon, adaptive foreground]
    for (const d of Object.keys(sizes)) {
      const dir = path.join(res, 'mipmap-' + d);
      fs.mkdirSync(dir, { recursive: true });
      const small = sizes[d][0] + 'x' + sizes[d][0], fg = sizes[d][1], inner = Math.round(fg * 0.62);
      execFileSync('convert', ['logo.png', '-resize', small, path.join(dir, 'ic_launcher.png')]);
      execFileSync('convert', ['logo.png', '-resize', small, path.join(dir, 'ic_launcher_round.png')]);
      execFileSync('convert', ['logo.png', '-resize', inner + 'x' + inner, '-background', 'none', '-gravity', 'center', '-extent', fg + 'x' + fg, path.join(dir, 'bobby_icon_fg.png')]);
    }
    fs.mkdirSync(path.join(res, 'values'), { recursive: true });
    fs.writeFileSync(path.join(res, 'values', 'bobby_icon.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="bobby_icon_bg">#06152E</color>\n</resources>\n');
    const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/bobby_icon_bg"/>\n    <foreground android:drawable="@mipmap/bobby_icon_fg"/>\n</adaptive-icon>\n';
    fs.mkdirSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true });
    fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive);
    fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);
    console.log('app icon set from logo.png');
  } catch (e) { console.log('WARNING: app icon not changed (' + e.message + '). The build continues with the default icon.'); }

  console.log('android project patched');
} else {
  throw new Error('Usage: node patch.js prepare|android');
}
