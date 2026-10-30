AI CAR DOCTOR — ANDROID STARTUP DIAGNOSTICS PACKAGE

This package combines the source ZIP v3.1 available in the conversation with:
1) runtime-diagnostics.js: an on-screen diagnostic overlay for JavaScript errors, database readiness, script presence, dropdown initialization, Scan Card presence, and Capacitor native plugin availability.
2) .github/workflows/build-apk.yml: a GitHub Actions workflow that runs patch.js prepare, synchronizes Capacitor, registers the existing native Bluetooth plugin through patch.js android, and builds a debug APK.
3) patch.js update: copies runtime-diagnostics.js into www and injects it into the packaged index.html.

IMPORTANT LIMITATIONS
- The overlay reports symptoms; it does not repair runtime errors by itself.
- A successful GitHub build does not prove that dropdowns or Bluetooth work on the phone.
- The Bluetooth plugin's actual compatibility with the user's adapter remains unverified.
- The source is based on AI_Car_Doctor_files_v3_1.zip available in the conversation. It does not include later v3.2 edits from Cloud if those edits are not present in v3.1.
- Keep a backup of the current SPCK project and website before replacing files.

INSTALL/USE
1. Back up the existing SPCK project.
2. Merge/replace the files in this ZIP into the repository, preserving the folder structure, especially .github/workflows/build-apk.yml.
3. Commit and push to the main branch, or run the workflow manually from GitHub Actions.
4. Download the artifact named Bobby-Car-Doctor-APK-Diagnostics.
5. Install and open the APK. Wait about 3–4 seconds. The diagnostic panel should appear at the bottom. If errors occur, they are listed in the panel. The Hide button hides it; Show diagnostics reopens it.
6. Send the panel text or screenshot if the app still fails.

The runtime diagnostic file is also copied into the web package by patch.js prepare, so the diagnostic panel may appear on the website too. It can be removed later after troubleshooting by removing its script injection and file copy from patch.js.
