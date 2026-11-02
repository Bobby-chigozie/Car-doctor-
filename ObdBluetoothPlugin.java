package com.aicardoctor.app;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.BluetoothSocket;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.os.Build;
import android.os.ParcelUuid;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Bluetooth bridge for ELM327-style OBD-II adapters. Two transports:
 *   "classic": Serial Port Profile (RFCOMM) on an already-paired device.
 *   "ble":     Bluetooth Low Energy serial service (UART over GATT), no pairing needed.
 * Either way the app sees the same thing: send a text command, get the reply text.
 * It never clears codes by itself; the JavaScript decides which commands to send.
 */
@CapacitorPlugin(
    name = "ObdBluetooth",
    permissions = {
        @Permission(alias = "bluetooth", strings = { "android.permission.BLUETOOTH_CONNECT" }),
        @Permission(alias = "scanbt", strings = { "android.permission.BLUETOOTH_SCAN" }),
        @Permission(alias = "loc", strings = { "android.permission.ACCESS_FINE_LOCATION" })
    }
)
public class ObdBluetoothPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805F9B34FB");
    private static final int BLE_CHUNK = 20; // safe with the default ATT size (23 bytes)

    // Known BLE "serial" services: {service, characteristic the adapter notifies on, characteristic we write to}
    private static final String[][] KNOWN_UARTS = {
        { "49535343-fe7d-4ae5-8fa9-9fafd205e455", "49535343-1e4d-4bd9-ba61-23c647249616", "49535343-8841-43f4-a8d4-ecbe34729bb3" }, // Microchip/ISSC transparent UART
        { "0000ffe0-0000-1000-8000-00805f9b34fb", "0000ffe1-0000-1000-8000-00805f9b34fb", "0000ffe1-0000-1000-8000-00805f9b34fb" },
        { "0000fff0-0000-1000-8000-00805f9b34fb", "0000fff1-0000-1000-8000-00805f9b34fb", "0000fff2-0000-1000-8000-00805f9b34fb" },
        { "6e400001-b5a3-f393-e0a9-e50e24dcca9e", "6e400003-b5a3-f393-e0a9-e50e24dcca9e", "6e400002-b5a3-f393-e0a9-e50e24dcca9e" }, // Nordic UART
        { "e7810a71-73ae-499d-8c15-faa9aef0c3f2", "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f", "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f" },
        { "000018f0-0000-1000-8000-00805f9b34fb", "00002af0-0000-1000-8000-00805f9b34fb", "00002af1-0000-1000-8000-00805f9b34fb" }
    };

    private final ExecutorService io = Executors.newSingleThreadExecutor();

    // Classic link
    private BluetoothSocket socket;
    // Streams used by send() for both transports
    private InputStream in;
    private OutputStream out;

    // BLE link
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic bleRx, bleTx;
    private RxBuffer rxBuf;
    private volatile String bleError;
    private volatile CountDownLatch bleReady = new CountDownLatch(1);
    private final Semaphore writeDone = new Semaphore(0);
    private volatile String bleDescription = "";

    // ---------- permissions ----------
    private boolean needsPermission() {
        return Build.VERSION.SDK_INT >= 31 && getPermissionState("bluetooth") != PermissionState.GRANTED;
    }

    private boolean needsScanPermission() {
        if (Build.VERSION.SDK_INT >= 31) {
            return getPermissionState("bluetooth") != PermissionState.GRANTED
                || getPermissionState("scanbt") != PermissionState.GRANTED;
        }
        return getPermissionState("loc") != PermissionState.GRANTED; // Android 11 and older need Location to scan
    }

    private static final String DENIED =
        "Bluetooth permission was denied. In Android settings, allow 'Nearby devices' for AI Car Doctor.";
    private static final String SCAN_DENIED =
        "Permission to find Bluetooth devices was denied. In Android settings, allow 'Nearby devices' (Android 12 and newer) or 'Location' (Android 11 and older) for AI Car Doctor.";

    // ---------- list paired devices ----------
    @PluginMethod
    public void listPaired(PluginCall call) {
        if (needsPermission()) {
            requestPermissionForAlias("bluetooth", call, "listPermCallback");
            return;
        }
        doList(call);
    }

    @PermissionCallback
    private void listPermCallback(PluginCall call) {
        if (needsPermission()) { call.reject(DENIED); return; }
        doList(call);
    }

    private static String typeName(int t) {
        return t == BluetoothDevice.DEVICE_TYPE_CLASSIC ? "classic"
            : t == BluetoothDevice.DEVICE_TYPE_LE ? "le"
            : t == BluetoothDevice.DEVICE_TYPE_DUAL ? "dual" : "unknown";
    }

    @SuppressLint("MissingPermission")
    private void doList(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) { call.reject("This device has no Bluetooth."); return; }
        if (!adapter.isEnabled()) { call.reject("Bluetooth is turned off. Turn it on and tap Refresh list."); return; }
        JSArray devices = new JSArray();
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        if (bonded != null) {
            for (BluetoothDevice d : bonded) {
                JSObject o = new JSObject();
                o.put("name", d.getName() == null ? "" : d.getName());
                o.put("address", d.getAddress());
                o.put("type", typeName(d.getType()));
                devices.put(o);
            }
        }
        JSObject ret = new JSObject();
        ret.put("devices", devices);
        call.resolve(ret);
    }

    // ---------- find nearby Bluetooth LE devices (adapters that are not paired) ----------
    @PluginMethod
    public void scanLe(PluginCall call) {
        if (needsScanPermission()) {
            String[] aliases = Build.VERSION.SDK_INT >= 31 ? new String[] { "bluetooth", "scanbt" } : new String[] { "loc" };
            requestPermissionForAliases(aliases, call, "scanPermCallback");
            return;
        }
        doScan(call);
    }

    @PermissionCallback
    private void scanPermCallback(PluginCall call) {
        if (needsScanPermission()) { call.reject(SCAN_DENIED); return; }
        doScan(call);
    }

    @SuppressLint("MissingPermission")
    private void doScan(final PluginCall call) {
        final int ms = Math.max(2000, Math.min(15000, call.getInt("durationMs", 6000)));
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) { call.reject("This device has no Bluetooth."); return; }
        if (!adapter.isEnabled()) { call.reject("Bluetooth is turned off. Turn it on and try again."); return; }
        final BluetoothLeScanner scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) { call.reject("Bluetooth scanner not available. Make sure Bluetooth is on."); return; }
        final Map<String, JSObject> found = new LinkedHashMap<String, JSObject>();
        final int[] failCode = { 0 };
        final ScanCallback cb = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult r) {
                try {
                    BluetoothDevice d = r.getDevice();
                    String name = r.getScanRecord() != null ? r.getScanRecord().getDeviceName() : null;
                    if (name == null) name = d.getName();
                    if (name == null || name.isEmpty()) return;
                    JSObject o = new JSObject();
                    o.put("name", name);
                    o.put("address", d.getAddress());
                    o.put("type", typeName(d.getType()));
                    o.put("rssi", r.getRssi());
                    synchronized (found) { found.put(d.getAddress(), o); }
                } catch (Exception ignored) { }
            }
            @Override
            public void onScanFailed(int errorCode) { failCode[0] = errorCode; }
        };
        io.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    scanner.startScan(cb);
                    try { Thread.sleep(ms); } catch (InterruptedException ignored) { }
                    try { scanner.stopScan(cb); } catch (Exception ignored) { }
                    if (failCode[0] != 0 && found.isEmpty()) { call.reject("Bluetooth scan failed (code " + failCode[0] + ")."); return; }
                    JSArray arr = new JSArray();
                    synchronized (found) { for (JSObject o : found.values()) arr.put(o); }
                    JSObject ret = new JSObject();
                    ret.put("devices", arr);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Bluetooth scan failed: " + e.getMessage());
                }
            }
        });
    }

    // ---------- adapter info (evidence only; no data is sent to the adapter) ----------
    @PluginMethod
    public void deviceInfo(PluginCall call) {
        if (needsPermission()) {
            requestPermissionForAlias("bluetooth", call, "infoPermCallback");
            return;
        }
        doInfo(call);
    }

    @PermissionCallback
    private void infoPermCallback(PluginCall call) {
        if (needsPermission()) { call.reject(DENIED); return; }
        doInfo(call);
    }

    @SuppressLint("MissingPermission")
    private void doInfo(PluginCall call) {
        String address = call.getString("address");
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || address == null) { call.reject("No Bluetooth or no address."); return; }
        try {
            BluetoothDevice d = adapter.getRemoteDevice(address);
            JSObject ret = new JSObject();
            ret.put("name", d.getName() == null ? "" : d.getName());
            ret.put("address", d.getAddress());
            ret.put("type", typeName(d.getType()));
            ret.put("bonded", d.getBondState() == BluetoothDevice.BOND_BONDED);
            JSArray uuids = new JSArray();
            ParcelUuid[] u = d.getUuids();
            if (u != null) { for (ParcelUuid p : u) { uuids.put(p.toString()); } }
            ret.put("uuids", uuids);
            ret.put("ble", bleDescription);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not read adapter info: " + e.getMessage());
        }
    }

    // ---------- connect ----------
    @PluginMethod
    public void connect(PluginCall call) {
        if (needsPermission()) {
            requestPermissionForAlias("bluetooth", call, "connectPermCallback");
            return;
        }
        doConnect(call);
    }

    @PermissionCallback
    private void connectPermCallback(PluginCall call) {
        if (needsPermission()) { call.reject(DENIED); return; }
        doConnect(call);
    }

    private static void closeSocket(BluetoothSocket s) {
        try { if (s != null) s.close(); } catch (Exception ignored) { }
    }

    @SuppressLint("MissingPermission")
    private void doConnect(final PluginCall call) {
        final String address = call.getString("address");
        final String transport = call.getString("transport") == null ? "classic" : call.getString("transport");
        if (address == null || address.isEmpty()) { call.reject("No adapter address given."); return; }
        io.execute(new Runnable() {
            @Override
            public void run() {
                if ("ble".equals(transport)) { connectBle(call, address); } else { connectClassic(call, address); }
            }
        });
    }

    @SuppressLint("MissingPermission")
    private void connectClassic(final PluginCall call, final String address) {
        try {
            closeQuietly();
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) { call.reject("Bluetooth is turned off."); return; }
            // We never start discovery, but another app might have. On Android 12+ this call needs
            // BLUETOOTH_SCAN, which may not be granted, so it must never be allowed to abort the connection.
            try { adapter.cancelDiscovery(); } catch (SecurityException ignored) { }
            BluetoothDevice device = adapter.getRemoteDevice(address);

            BluetoothSocket s = null;
            String method = null;
            String e1 = "", e2 = "", e3 = "";

            // Attempt 1: standard Serial Port Profile, secure
            try {
                s = device.createRfcommSocketToServiceRecord(SPP_UUID);
                s.connect();
                method = "secure-spp";
            } catch (Exception e) { e1 = String.valueOf(e.getMessage()); closeSocket(s); s = null; }

            // Attempt 2: standard Serial Port Profile, insecure (many adapters need this)
            if (s == null) {
                try {
                    s = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                    s.connect();
                    method = "insecure-spp";
                } catch (Exception e) { e2 = String.valueOf(e.getMessage()); closeSocket(s); s = null; }
            }

            // Attempt 3: fixed RFCOMM channel 1 (hidden API, for adapters without a service record)
            if (s == null) {
                try {
                    s = (BluetoothSocket) device.getClass()
                        .getMethod("createRfcommSocket", new Class[] { int.class })
                        .invoke(device, Integer.valueOf(1));
                    s.connect();
                    method = "rfcomm-channel-1";
                } catch (Exception e) { e3 = String.valueOf(e.getMessage()); closeSocket(s); s = null; }
            }

            if (s == null) {
                call.reject("Bluetooth connection failed. Secure SPP: " + e1 + " | Insecure SPP: " + e2 + " | Channel 1: " + e3);
                return;
            }
            socket = s;
            in = s.getInputStream();
            out = s.getOutputStream();
            JSObject ret = new JSObject();
            ret.put("connected", true);
            ret.put("method", method);
            call.resolve(ret);
        } catch (Exception e) {
            closeQuietly();
            call.reject("Bluetooth connection failed: " + e.getMessage());
        }
    }

    // ---------- Bluetooth LE ----------
    /** Bytes received from the adapter (notifications), readable like a stream. */
    private static class RxBuffer extends InputStream {
        private final ArrayDeque<Byte> q = new ArrayDeque<Byte>();
        private boolean closed = false;

        synchronized void push(byte[] b) { if (b == null) return; for (byte x : b) q.add(Byte.valueOf(x)); }
        synchronized void markClosed() { closed = true; }

        @Override
        public synchronized int available() throws IOException {
            if (q.isEmpty() && closed) throw new IOException("Bluetooth LE link closed");
            return q.size();
        }

        @Override
        public synchronized int read() {
            if (q.isEmpty()) return -1;
            return q.poll().byteValue() & 0xFF;
        }

        @Override
        public synchronized int read(byte[] b, int off, int len) {
            int n = 0;
            while (n < len && !q.isEmpty()) { b[off + n] = q.poll().byteValue(); n++; }
            return (n == 0 && len > 0) ? -1 : n;
        }
    }

    /** Writes to the adapter's write characteristic in small chunks. */
    private class GattOut extends OutputStream {
        @Override
        public void write(int b) throws IOException { write(new byte[] { (byte) b }, 0, 1); }

        @SuppressLint("MissingPermission")
        @Override
        public void write(byte[] b, int off, int len) throws IOException {
            BluetoothGatt g = gatt;
            BluetoothGattCharacteristic c = bleTx;
            if (g == null || c == null) throw new IOException("Bluetooth LE not connected");
            boolean withResponse = (c.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0;
            for (int i = off; i < off + len; i += BLE_CHUNK) {
                int n = Math.min(BLE_CHUNK, off + len - i);
                writeDone.drainPermits();
                c.setWriteType(withResponse ? BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT : BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
                c.setValue(Arrays.copyOfRange(b, i, i + n));
                if (!g.writeCharacteristic(c)) throw new IOException("Bluetooth LE write was refused");
                try {
                    if (withResponse) {
                        if (!writeDone.tryAcquire(2, TimeUnit.SECONDS)) throw new IOException("Bluetooth LE write timed out");
                    } else {
                        Thread.sleep(25);
                    }
                } catch (InterruptedException e) { throw new IOException("Interrupted"); }
            }
        }
    }

    private static String chProps(BluetoothGattCharacteristic c) {
        int p = c.getProperties();
        return ((p & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0 ? "N" : "")
            + ((p & BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0 ? "I" : "")
            + ((p & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0 ? "W" : "")
            + ((p & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0 ? "w" : "");
    }

    private static boolean canNotify(BluetoothGattCharacteristic c) {
        return (c.getProperties() & (BluetoothGattCharacteristic.PROPERTY_NOTIFY | BluetoothGattCharacteristic.PROPERTY_INDICATE)) != 0;
    }

    private static boolean canWrite(BluetoothGattCharacteristic c) {
        return (c.getProperties() & (BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE)) != 0;
    }

    private static BluetoothGattCharacteristic findChar(BluetoothGattService s, String uuid) {
        List<BluetoothGattCharacteristic> cs = s.getCharacteristics();
        if (cs == null) return null;
        for (BluetoothGattCharacteristic c : cs) if (c.getUuid().toString().equalsIgnoreCase(uuid)) return c;
        return null;
    }

    /** Picks the serial service. Known UART layouts first, then any service with one notify and one write characteristic. */
    private void chooseSerial(BluetoothGatt g) {
        bleRx = null; bleTx = null;
        StringBuilder d = new StringBuilder();
        List<BluetoothGattService> services = g.getServices();
        if (services == null) return;
        for (BluetoothGattService s : services) {
            d.append(s.getUuid()).append(" [");
            List<BluetoothGattCharacteristic> cs = s.getCharacteristics();
            if (cs != null) for (BluetoothGattCharacteristic c : cs) d.append(c.getUuid()).append(':').append(chProps(c)).append(' ');
            d.append("]\n");
        }
        bleDescription = d.toString();
        for (String[] k : KNOWN_UARTS) {
            for (BluetoothGattService s : services) {
                if (!s.getUuid().toString().equalsIgnoreCase(k[0])) continue;
                BluetoothGattCharacteristic rx = findChar(s, k[1]), tx = findChar(s, k[2]);
                if (rx != null && tx != null && canNotify(rx) && canWrite(tx)) { bleRx = rx; bleTx = tx; return; }
            }
        }
        for (BluetoothGattService s : services) {
            String u = s.getUuid().toString().toLowerCase();
            if (u.startsWith("00001800") || u.startsWith("00001801") || u.startsWith("0000180a")) continue;
            BluetoothGattCharacteristic rx = null, tx = null;
            List<BluetoothGattCharacteristic> cs = s.getCharacteristics();
            if (cs == null) continue;
            for (BluetoothGattCharacteristic c : cs) {
                if (rx == null && canNotify(c)) rx = c;
                if (tx == null && canWrite(c) && !canNotify(c)) tx = c;
            }
            if (tx == null) for (BluetoothGattCharacteristic c : cs) if (canWrite(c)) { tx = c; break; }
            if (rx != null && tx != null) { bleRx = rx; bleTx = tx; return; }
        }
    }

    private void bleFail(String why) {
        if (bleError == null) bleError = why;
        if (rxBuf != null) rxBuf.markClosed();
        bleReady.countDown();
    }

    private class GattCb extends BluetoothGattCallback {
        @SuppressLint("MissingPermission")
        @Override
        public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                if (!g.discoverServices()) bleFail("could not start service discovery");
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED || status != BluetoothGatt.GATT_SUCCESS) {
                bleFail("link closed (status " + status + ")");
            }
        }

        @SuppressLint("MissingPermission")
        @Override
        public void onServicesDiscovered(BluetoothGatt g, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS) { bleFail("service discovery failed (status " + status + ")"); return; }
            chooseSerial(g);
            if (bleRx == null || bleTx == null) { bleFail("no serial service found on this adapter"); return; }
            g.setCharacteristicNotification(bleRx, true);
            BluetoothGattDescriptor cccd = bleRx.getDescriptor(CCCD);
            if (cccd == null) { bleReady.countDown(); return; }
            boolean notify = (bleRx.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0;
            cccd.setValue(notify ? BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE : BluetoothGattDescriptor.ENABLE_INDICATION_VALUE);
            if (!g.writeDescriptor(cccd)) bleFail("could not enable notifications");
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor d, int status) {
            if (status == BluetoothGatt.GATT_SUCCESS) bleReady.countDown();
            else bleFail("could not enable notifications (status " + status + ")");
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c) {
            RxBuffer b = rxBuf;
            if (b != null) b.push(c.getValue());
        }

        @Override
        public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic c, int status) {
            writeDone.release();
        }
    }

    @SuppressLint("MissingPermission")
    private void connectBle(final PluginCall call, final String address) {
        try {
            closeQuietly();
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) { call.reject("Bluetooth is turned off."); return; }
            BluetoothDevice device = adapter.getRemoteDevice(address);
            rxBuf = new RxBuffer();
            bleError = null;
            bleDescription = "";
            bleReady = new CountDownLatch(1);
            writeDone.drainPermits();
            GattCb cb = new GattCb();
            gatt = Build.VERSION.SDK_INT >= 23
                ? device.connectGatt(getContext(), false, cb, BluetoothDevice.TRANSPORT_LE)
                : device.connectGatt(getContext(), false, cb);
            if (gatt == null) { call.reject("Bluetooth LE connection could not be started."); return; }
            boolean ready = false;
            try { ready = bleReady.await(15, TimeUnit.SECONDS); } catch (InterruptedException ignored) { }
            if (!ready || bleError != null) {
                String why = ready ? bleError : "timed out after 15 seconds (adapter not reachable, or already connected to another app)";
                closeQuietly();
                call.reject("Bluetooth LE connection failed: " + why);
                return;
            }
            in = rxBuf;
            out = new GattOut();
            JSObject ret = new JSObject();
            ret.put("connected", true);
            ret.put("method", "ble");
            ret.put("serial", bleTx.getUuid().toString() + " / " + bleRx.getUuid().toString());
            ret.put("services", bleDescription);
            call.resolve(ret);
        } catch (Exception e) {
            closeQuietly();
            call.reject("Bluetooth LE connection failed: " + e.getMessage());
        }
    }

    // ---------- send a command and read the reply (until the ELM '>' prompt or timeout) ----------
    @PluginMethod
    public void send(final PluginCall call) {
        final String command = call.getString("command");
        final int timeout = call.getInt("timeoutMs", 5000);
        final int idleMs = call.getInt("idleMs", 0);
        if (command == null) { call.reject("No command given."); return; }
        io.execute(new Runnable() {
            @Override
            public void run() {
                if (in == null || out == null) { call.reject("Not connected to an adapter."); return; }
                try {
                    // throw away anything left over from earlier
                    while (in.available() > 0) { in.read(); }
                    out.write((command + "\r").getBytes(StandardCharsets.US_ASCII));
                    out.flush();
                    StringBuilder sb = new StringBuilder();
                    StringBuilder hex = new StringBuilder();
                    long end = System.currentTimeMillis() + timeout;
                    long lastRx = 0;
                    byte[] buf = new byte[256];
                    while (System.currentTimeMillis() < end) {
                        int avail = in.available();
                        if (avail > 0) {
                            int n = in.read(buf, 0, Math.min(avail, buf.length));
                            if (n > 0) {
                                sb.append(new String(buf, 0, n, StandardCharsets.US_ASCII));
                                for (int i = 0; i < n; i++) hex.append(String.format("%02X ", buf[i] & 0xFF));
                                lastRx = System.currentTimeMillis();
                            }
                            if (sb.toString().trim().endsWith(">")) break;
                        } else {
                            // Adapters that are not ELM327 never send the '>' prompt. If idleMs is set,
                            // stop waiting once data has arrived and then gone quiet.
                            if (idleMs > 0 && lastRx > 0 && System.currentTimeMillis() - lastRx >= idleMs) break;
                            Thread.sleep(20);
                        }
                    }
                    JSObject ret = new JSObject();
                    ret.put("response", sb.toString());
                    ret.put("hex", hex.toString().trim());
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Lost connection to the adapter: " + e.getMessage());
                }
            }
        });
    }

    // ---------- disconnect ----------
    @PluginMethod
    public void disconnect(PluginCall call) {
        closeQuietly();
        call.resolve();
    }

    @SuppressLint("MissingPermission")
    private void closeQuietly() {
        try { if (socket != null) socket.close(); } catch (Exception ignored) { }
        socket = null;
        BluetoothGatt g = gatt;
        gatt = null;
        if (g != null) {
            try { g.disconnect(); } catch (Exception ignored) { }
            try { g.close(); } catch (Exception ignored) { }
        }
        if (rxBuf != null) rxBuf.markClosed();
        rxBuf = null; bleRx = null; bleTx = null;
        in = null; out = null;
    }

    @Override
    protected void handleOnDestroy() {
        closeQuietly();
        io.shutdown();
    }
}
