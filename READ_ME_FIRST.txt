BOBBY CAR DOCTOR — WHAT'S IN THIS ZIP

Two folders:

1) REPLACE_THESE_FILES_ONLY
   Only 5 files: app.js, index.html, style.css, package.json, dtc-database.js
   These are the ONLY files that changed recently (symptom checklist +
   search-online button + the P0350 database fix). Copy these 5 files into
   the root of your existing GitHub/Capacitor project, overwriting the old
   ones. Everything else in your project (scanner.js, obd.js, icons,
   ObdBluetoothPlugin.java, patch.js, .github folder) stays exactly as it
   is — do NOT touch those.

2) Bobby_Car_Doctor_full_project
   The WHOLE project as it stands right now, every file, so you can look
   through it, compare it to what's on GitHub, or use it as a fresh
   starting point if you're ever unsure your repo matches. This is not a
   patch — if you push this whole folder it will also work, but normally
   you only need the 5 files above.

If you're not sure which to use: use REPLACE_THESE_FILES_ONLY. It's safer
and smaller.
