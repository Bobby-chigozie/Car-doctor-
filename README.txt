BOBBY CAR DOCTOR — VERSION 4.3.2

Current app features
- Offline lookup using the included DTC database (662 entries).
- Vehicle make/model/year/engine selection for report context. The expanded selector includes popular makes and models from several regions. A listed vehicle is not a promise that every ECU or code is supported.
- Smart Fix step checklist and detailed code information.
- Code-triggered offline symptom checklist: it stays hidden until a valid DTC is entered, then displays observations relevant to that code (for example, misfire-related observations for P0301 or cooling/overheating observations for cooling-system codes). When the entered code changes, the options update and no-longer-relevant selections are cleared. Mechanics select only what they actually observe; selections appear in the report and Smart Fix uses them to prioritise checks. Optional text note remains available inside the code-triggered panel. Checklist sizing follows the existing Small/Normal/Large/Extra Large setting.
- Scan, live-data and battery screens are available in the installed app/demo mode as previously implemented.
- Report history remains on the phone and expires after 7 days (20 reports maximum).

Database
The bundled dtc-database.js contains 662 unique code entries. Meanings and repair guidance must be verified against the exact vehicle and trusted service information. Do not treat a code or a selected symptom as proof that a part has failed.

Adapter status
The custom Bluetooth path is intended for standard compatible adapters but has not been validated with a real ELM327 adapter connected to a real vehicle. Demo mode is simulated only. Proprietary/licensed adapters require an official integration; this app does not bypass licences or passwords.

Safety and limits
- Clear codes always requires user confirmation.
- No automatic ECU reset or programming.
- Vehicle selector is for identification and report context; actual module/protocol coverage depends on the vehicle, adapter and tested support.
- JavaScript remains compatible with older Android WebViews (ES2017 or earlier).

Build
Capacitor 6 project. Source files are in the project root.
