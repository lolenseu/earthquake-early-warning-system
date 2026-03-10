import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart' as geo;
import 'package:workmanager/workmanager.dart';
import 'dart:math' as math;

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Workmanager().initialize(
    callbackDispatcher,
    isInDebugMode: false,
  );
  runApp(const MyApp());
}

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    final FlutterLocalNotificationsPlugin notificationsPlugin = FlutterLocalNotificationsPlugin();
    const AndroidInitializationSettings androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const DarwinInitializationSettings iOSInit = DarwinInitializationSettings();
    await notificationsPlugin.initialize(const InitializationSettings(android: androidInit, iOS: iOSInit));

    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      'eews_channel',
      'EEWS Alerts',
      importance: Importance.max,
      description: 'Earthquake warnings',
      playSound: true,
    );

    final androidPlugin = notificationsPlugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(channel);

    final prefs = await SharedPreferences.getInstance();
    final apiBase = prefs.getString('apiBase') ?? 'https://lolenseu.pythonanywhere.com/pipeline/eews';
    final notificationsEnabled = prefs.getBool('notificationsEnabled') ?? true;

    if (!notificationsEnabled) return Future.value(true);

    try {
      final url = '$apiBase/warning';
      final res = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        final data = json.decode(res.body) as Map<String, dynamic>;
        final warning = data['warning'] == true;

        if (warning) {
          final message = data['message'] ?? 'Earthquake warning received';
          String locationText = '';
          if (data.containsKey('location')) {
            locationText = data['location'].toString();
          } else if (data.containsKey('latitude') && data.containsKey('longitude')) {
            locationText = '${data['latitude']}, ${data['longitude']}';
          }

          double maxG = 0.0;
          if (data.containsKey('devices')) {
            try {
              for (final d in (data['devices'] as List)) {
                final g = (d['g_force'] ?? 0).toDouble();
                if (g > maxG) maxG = g;
              }
            } catch (_) {}
          }

          final payload = json.encode({'message': message, 'location': locationText, 'magnitude': maxG, 'raw': data});

          final androidDetails = AndroidNotificationDetails(
            'eews_channel',
            'EEWS',
            importance: Importance.max,
            priority: Priority.high,
            playSound: true,
            fullScreenIntent: true,
            category: AndroidNotificationCategory.alarm,
          );
          final iosDetails = DarwinNotificationDetails(presentSound: true);
          await notificationsPlugin.show(
            0,
            'EEWS Warning',
            message,
            NotificationDetails(
              android: androidDetails,
              iOS: iosDetails,
            ),
            payload: payload,
          );
        }
      }
    } catch (e) {}
    return Future.value(true);
  });
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EEWS Mobile',
      navigatorKey: navigatorKey,
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int _selectedIndex = 0;
  final List<Widget> _pages = [];

  late DevicesPage devicesPage;
  final GlobalKey<_MapPageState> _mapKey = GlobalKey<_MapPageState>();
  late MapPage mapPage;
  late SettingsPage settingsPage;

  Timer? _pollTimer;
  final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();
  String apiBase = 'https://lolenseu.pythonanywhere.com/pipeline/eews';
  bool _isAppInForeground = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    devicesPage = DevicesPage(apiBase: apiBase);
    mapPage = MapPage(key: _mapKey, apiBase: apiBase);
    settingsPage = SettingsPage(onSave: _onSettingsSaved, apiBase: apiBase);
    _pages.addAll([devicesPage, mapPage, settingsPage]);
    _initNotifications();
    _loadSettingsAndStart();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    Workmanager().cancelAll();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _isAppInForeground = state == AppLifecycleState.resumed;
  }

  Future<void> _loadSettingsAndStart() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('apiBase');
    final notif = prefs.getBool('notificationsEnabled') ?? true;
    final locEnabled = prefs.getBool('locationEnabled') ?? true;
    if (saved != null && saved.isNotEmpty) {
      apiBase = saved;
      devicesPage.apiBase = apiBase;
      mapPage.apiBase = apiBase;
    }
    if (notif) {
      _startPolling();
      _startBackgroundTask();
    }
    try {
      _mapKey.currentState?.setLocationEnabled(locEnabled);
    } catch (_) {}
  }

  Future<void> _initNotifications() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iOSInit = DarwinInitializationSettings();

    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      'eews_channel',
      'EEWS Alerts',
      importance: Importance.max,
      description: 'Earthquake warnings',
      playSound: true,
    );

    final androidPlugin = _notificationsPlugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(channel);

    await _notificationsPlugin.initialize(
      const InitializationSettings(
        android: androidInit,
        iOS: iOSInit,
      ),
      onDidReceiveNotificationResponse: (NotificationResponse response) async {
        try {
          if (response.payload != null && response.payload!.isNotEmpty) {
            final data = json.decode(response.payload!);
            navigatorKey.currentState?.push(
              MaterialPageRoute(builder: (_) => WarningScreen(payload: data)),
            );
          }
        } catch (_) {}
      },
    );
  }

  void _onSettingsSaved(String newBase, bool notificationsEnabled, bool locationEnabled) async {
    setState(() {
      apiBase = newBase;
      devicesPage.apiBase = apiBase;
      mapPage.apiBase = apiBase;
    });

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('apiBase', newBase);
    await prefs.setBool('notificationsEnabled', notificationsEnabled);
    await prefs.setBool('locationEnabled', locationEnabled);

    try {
      _mapKey.currentState?.setLocationEnabled(locationEnabled);
    } catch (_) {}

    if (notificationsEnabled) {
      _startPolling();
      _startBackgroundTask();
    } else {
      _stopPolling();
      Workmanager().cancelAll();
    }
  }

  void _startBackgroundTask() {
    Workmanager().registerPeriodicTask(
      'eews-background-task',
      'eewsBackgroundTask',
      frequency: const Duration(minutes: 15),
      constraints: Constraints(
        networkType: NetworkType.connected,
      ),
    );
  }

  void _startPolling() async {
    if (await Permission.notification.isDenied) {
      await Permission.notification.request();
    }

    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      try {
        final url = '$apiBase/warning';
        final res = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 5));
        if (res.statusCode == 200) {
          final data = json.decode(res.body) as Map<String, dynamic>;
          final warning = data['warning'] == true;
          final message = data['message'] ?? 'Earthquake warning received';
          String locationText = '';
          if (data.containsKey('location')) {
            locationText = data['location'].toString();
          } else if (data.containsKey('latitude') && data.containsKey('longitude')) {
            locationText = '${data['latitude']}, ${data['longitude']}';
          }

          if (warning) {
            double maxG = 0.0;
            if (data.containsKey('devices')) {
              try {
                for (final d in (data['devices'] as List)) {
                  final g = (d['g_force'] ?? 0).toDouble();
                  if (g > maxG) maxG = g;
                }
              } catch (_) {}
            }

            final payload = json.encode({'message': message, 'location': locationText, 'magnitude': maxG, 'raw': data});

            await _showNotification('EEWS Warning', message, payload: payload, fullScreen: true);

            if (_isAppInForeground) {
              try {
                final parsed = json.decode(payload);
                navigatorKey.currentState?.push(MaterialPageRoute(builder: (_) => WarningScreen(payload: parsed)));
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
    });
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _showNotification(String title, String body, {String? payload, bool fullScreen = false}) async {
    final androidDetails = AndroidNotificationDetails(
      'eews_channel',
      'EEWS',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      fullScreenIntent: fullScreen,
      category: AndroidNotificationCategory.alarm,
    );
    final iosDetails = DarwinNotificationDetails(presentSound: true);
    await _notificationsPlugin.show(
      0,
      title,
      body,
      NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      ),
      payload: payload,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _pages[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (i) => setState(() => _selectedIndex = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.list), label: 'Devices'),
          BottomNavigationBarItem(icon: Icon(Icons.map), label: 'Map'),
          BottomNavigationBarItem(icon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}

class DevicesPage extends StatefulWidget {
  String apiBase;
  DevicesPage({super.key, required this.apiBase});

  @override
  State<DevicesPage> createState() => _DevicesPageState();
}

class _DevicesPageState extends State<DevicesPage> {
  List<dynamic> devices = [];
  Map<String, dynamic> live = {};
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() => loading = true);
    try {
      final listRes = await http.get(Uri.parse('${widget.apiBase}/devices_list')).timeout(const Duration(seconds: 6));
      final liveRes = await http.get(Uri.parse('${widget.apiBase}/devices')).timeout(const Duration(seconds: 6));
      if (listRes.statusCode == 200) {
        final ldata = json.decode(listRes.body) as Map<String, dynamic>;
        devices = ldata['devices'] ?? [];
      }
      if (liveRes.statusCode == 200) {
        final vdata = json.decode(liveRes.body) as Map<String, dynamic>;
        live = vdata['devices'] ?? {};
      }
    } catch (_) {}
    setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _fetch,
      child: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
              itemCount: devices.length,
              itemBuilder: (context, i) {
                final d = devices[i] as Map<String, dynamic>;
                final id = d['device_id'] ?? 'unknown';
                final liveInfo = (live[id] is Map) ? (live[id] as Map<String, dynamic>) : {};
                final bool isOnline = live.containsKey(id);
                final g = isOnline ? (liveInfo['g_force'] ?? 0.0) : (d['g_force'] ?? 0.0);
                final lat = d['latitude'] ?? 0.0;
                final lng = d['longitude'] ?? 0.0;
                final double mag = (g is num) ? g.toDouble() : double.tryParse(g.toString()) ?? 0.0;
                final bool highMag = mag >= 1.5;
                final iconColor = isOnline ? (highMag ? Colors.red : Colors.green) : Colors.grey;
                final iconData = highMag ? Icons.warning_amber_rounded : Icons.router;
                final statusText = highMag ? 'Earthquake detected' : 'Normal';
                final statusColor = highMag ? Colors.red : Colors.green;

                return Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: iconColor.withOpacity(0.12),
                      child: Icon(iconData, color: iconColor),
                    ),
                    title: Text('ID: $id'),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(isOnline ? 'Online' : 'Offline'),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Text('Mag: ${mag.toStringAsFixed(1)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                            const SizedBox(width: 8),
                            Chip(
                              label: Text(statusText, style: TextStyle(color: statusColor)),
                              backgroundColor: statusColor.withOpacity(0.12),
                            ),
                          ],
                        ),
                      ],
                    ),
                    trailing: Text(d['location'] ?? 'Unknown'),
                  ),
                );
              },
            ),
    );
  }
}

class MapPage extends StatefulWidget {
  String apiBase;
  MapPage({super.key, required this.apiBase});

  @override
  State<MapPage> createState() => _MapPageState();
}

class WarningScreen extends StatelessWidget {
  final Map<String, dynamic> payload;
  const WarningScreen({super.key, required this.payload});

  @override
  Widget build(BuildContext context) {
    final mag = payload['magnitude'] ?? 0.0;
    final msg = payload['message'] ?? 'Earthquake detected';
    final loc = payload['location'] ?? '';

    return Scaffold(
      backgroundColor: Colors.red.shade700,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white),
                child: Center(
                  child: Text(
                    mag is double ? mag.toStringAsFixed(1) : mag.toString(),
                    style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: Colors.red),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(msg, style: const TextStyle(fontSize: 22, color: Colors.white, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              if (loc.isNotEmpty) Text(loc, style: const TextStyle(fontSize: 18, color: Colors.white70)),
              const SizedBox(height: 32),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: Colors.black),
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Dismiss'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MapPageState extends State<MapPage> {
  List<Marker> markers = [];
  bool loading = true;
  geo.Position? _userPosition;
  StreamSubscription<geo.Position>? _positionStream;
  final MapController _mapController = MapController();
  bool _locationEnabled = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final res = await http.get(Uri.parse('${widget.apiBase}/devices_list')).timeout(const Duration(seconds: 6));
      List<dynamic> list = [];
      if (res.statusCode == 200) {
        final data = json.decode(res.body) as Map<String, dynamic>;
        list = data['devices'] ?? [];
      }

      Map<String, dynamic> liveMap = {};
      try {
        final liveRes = await http.get(Uri.parse('${widget.apiBase}/devices')).timeout(const Duration(seconds: 6));
        if (liveRes.statusCode == 200) {
          final vdata = json.decode(liveRes.body) as Map<String, dynamic>;
          liveMap = vdata['devices'] ?? {};
        }
      } catch (_) {}

      markers = List<Marker>.from(list.map((d) {
        final latRaw = d['latitude'] ?? 0.0;
        final lngRaw = d['longitude'] ?? 0.0;
        final lat = (latRaw is num) ? latRaw.toDouble() : double.tryParse(latRaw.toString()) ?? 0.0;
        final lng = (lngRaw is num) ? lngRaw.toDouble() : double.tryParse(lngRaw.toString()) ?? 0.0;
        final id = d['device_id'] ?? '';
        final liveInfo = (liveMap[id] is Map) ? (liveMap[id] as Map<String, dynamic>) : {};
        final bool isOnline = liveMap.containsKey(id);
        final g = isOnline ? (liveInfo['g_force'] ?? 0.0) : (d['g_force'] ?? 0.0);
        final double mag = (g is num) ? g.toDouble() : double.tryParse(g.toString()) ?? 0.0;
        final bool highMag = mag >= 1.5;
        final iconColor = isOnline ? (highMag ? Colors.red : Colors.green) : Colors.blue;

        return Marker(
          point: LatLng(lat, lng),
          width: 40,
          height: 40,
          child: Icon(Icons.location_on, color: iconColor),
        );
      }));
    } catch (_) {}
    setState(() => loading = false);
    try {
      final prefs = await SharedPreferences.getInstance();
      _locationEnabled = prefs.getBool('locationEnabled') ?? true;
    } catch (_) {}
    if (_locationEnabled) {
      _initLocationTracking();
    }
  }

  Future<void> _initLocationTracking() async {
    if (!_locationEnabled) return;
    geo.LocationPermission perm = await geo.Geolocator.checkPermission();
    if (perm == geo.LocationPermission.denied) {
      perm = await geo.Geolocator.requestPermission();
    }
    if (perm == geo.LocationPermission.denied || perm == geo.LocationPermission.deniedForever) {
      return;
    }

    const settings = geo.LocationSettings(
      accuracy: geo.LocationAccuracy.best,
      distanceFilter: 5,
    );
    _positionStream = geo.Geolocator.getPositionStream(locationSettings: settings).listen((pos) {
      setState(() {
        _userPosition = pos;
      });
      try {
        _mapController.move(
          LatLng(pos.latitude, pos.longitude),
          _mapController.camera.zoom,
        );
      } catch (_) {}
    });
  }

  void setLocationEnabled(bool enabled) {
    _locationEnabled = enabled;
    if (!enabled) {
      _positionStream?.cancel();
      _positionStream = null;
      setState(() {
        _userPosition = null;
      });
    } else {
      _initLocationTracking();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    final center = markers.isNotEmpty ? markers[0].point : LatLng(14.5995, 120.9842);
    final List<Marker> allMarkers = List.from(markers);
    if (_userPosition != null) {
      final p = _userPosition!;
      final double acc = (p.accuracy ?? 20.0).clamp(4.0, 200.0);
      final double circlePx = math.min(120.0, 8.0 + acc / 2);

      allMarkers.add(Marker(
        point: LatLng(p.latitude, p.longitude),
        width: circlePx,
        height: circlePx,
        child: Center(
          child: Container(
            width: circlePx,
            height: circlePx,
            decoration: BoxDecoration(color: Colors.blue.withOpacity(0.18), shape: BoxShape.circle),
            child: Center(
              child: Container(width: 12, height: 12, decoration: const BoxDecoration(color: Colors.blue, shape: BoxShape.circle)),
            ),
          ),
        ),
      ));
    }

    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: center,
        initialZoom: 6.0,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          subdomains: const ['a', 'b', 'c'],
          userAgentPackageName: 'com.lolenseu.eews',
        ),
        MarkerLayer(markers: allMarkers),
      ],
    );
  }

  @override
  void dispose() {
    _positionStream?.cancel();
    super.dispose();
  }
}

class SettingsPage extends StatefulWidget {
  final void Function(String apiBase, bool notificationsEnabled, bool locationEnabled) onSave;
  final String apiBase;
  const SettingsPage({super.key, required this.onSave, required this.apiBase});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool _notifications = true;
  bool _locationEnabled = true;
  Map<String, Map<String, dynamic>> _apiStatus = {
    'devices_list': {'status': 'unknown', 'latency': 0},
    'devices': {'status': 'unknown', 'latency': 0},
  };
  String _lastChecked = '';

  @override
  void initState() {
    super.initState();
    _loadPrefs();
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkApis());
  }

  Future<Map<String, dynamic>> _ping(String url, {int timeoutMs = 5000}) async {
    final start = DateTime.now();
    try {
      final res = await http.get(Uri.parse(url)).timeout(Duration(milliseconds: timeoutMs));
      final duration = DateTime.now().difference(start).inMilliseconds;
      return {'status': res.statusCode == 200 ? 'online' : 'offline', 'latency': duration, 'code': res.statusCode};
    } catch (e) {
      return {'status': 'error', 'latency': 0, 'error': e.toString()};
    }
  }

  Future<void> _checkApis() async {
    final base = widget.apiBase;
    final endpoints = {
      'devices_list': '$base/devices_list',
      'devices': '$base/devices',
    };

    for (final key in endpoints.keys) {
      final result = await _ping(endpoints[key]!);
      setState(() {
        _apiStatus[key] = result;
        _lastChecked = DateTime.now().toLocal().toString();
      });
    }
  }

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _notifications = prefs.getBool('notificationsEnabled') ?? true;
      _locationEnabled = prefs.getBool('locationEnabled') ?? true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('API Status', style: TextStyle(fontWeight: FontWeight.bold)),
                      Row(children: [
                        IconButton(onPressed: _checkApis, icon: const Icon(Icons.refresh)),
                      ])
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(widget.apiBase, style: const TextStyle(color: Colors.black54)),
                  const SizedBox(height: 8),
                  Column(
                    children: [
                      _buildApiRow('Devices List', _apiStatus['devices_list']),
                      const SizedBox(height: 6),
                      _buildApiRow('Live Devices', _apiStatus['devices']),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text('Last checked: ${_lastChecked.isEmpty ? "--" : _lastChecked}', style: const TextStyle(fontSize: 12, color: Colors.black45)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          SwitchListTile(title: const Text('Enable notifications'), value: _notifications, onChanged: (v) => setState(() => _notifications = v)),
          SwitchListTile(title: const Text('Enable location tracking'), value: _locationEnabled, onChanged: (v) => setState(() => _locationEnabled = v)),
          ElevatedButton(
            onPressed: () => widget.onSave(widget.apiBase, _notifications, _locationEnabled),
            child: const Text('Save'),
          )
        ],
      ),
    );
  }

  Widget _buildApiRow(String label, Map<String, dynamic>? info) {
    final status = info?['status'] ?? 'unknown';
    final latency = info?['latency'] ?? 0;
    Color color = Colors.grey;
    if (status == 'online') color = Colors.green;
    if (status == 'offline') color = Colors.orange;
    if (status == 'error') color = Colors.red;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 8),
          Text(label),
        ]),
        Text(status == 'online' ? 'Latency: ${latency}ms' : (status == 'offline' ? 'Status ${info?['code'] ?? ''}' : 'Error')),
      ],
    );
  }
}