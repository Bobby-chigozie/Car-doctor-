// Helper used by the cloud build. Usage: node patch.js prepare | node patch.js android
const fs = require('fs'), path = require('path');
const step = process.argv[2];

if (step === 'prepare') {
  // copy the web app files into www/ (Capacitor's web folder)
  fs.mkdirSync('www', { recursive: true });
  for (const f of ['index.html', 'style.css', 'app.js', 'dtc-database.js', 'obd.js', 'scanner.js', 'runtime-diagnostics.js', 'logo.png']) {
    if (!fs.existsSync(f)) throw new Error('Missing file: ' + f);
    fs.copyFileSync(f, path.join('www', f));
  }
  // Include runtime diagnostics in the APK so startup failures are visible on-device.
  const indexPath = path.join('www', 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('runtime-diagnostics.js')) {
    html = html.replace('<script src=\"app.js\" defer></script>', '<script src=\"runtime-diagnostics.js\" defer></script>\n<script src=\"app.js\" defer></script>');
    if (!html.includes('runtime-diagnostics.js')) html = html.replace('</body>', '<script src=\"runtime-diagnostics.js\" defer></script></body>');
    fs.writeFileSync(indexPath, html);
  }
  console.log('www/ ready (runtime diagnostics included)');
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
  console.log('android project patched');
} else {
  throw new Error('Usage: node patch.js prepare|android');
}
