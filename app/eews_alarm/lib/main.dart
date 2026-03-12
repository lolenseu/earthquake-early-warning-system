import 'dart:async';
import 'dart:convert';
import 'dart:typed_data'; // ADDED: Missing import for Int64List
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
final FlutterLocalNotificationsPlugin notificationsPlugin = FlutterLocalNotificationsPlugin();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize notifications
  await initNotifications();
  
  // Initialize background service
  await initializeService();
  
  // Request permissions
  await requestPermissions();
  
  runApp(const MyApp());
}

Future<void> initNotifications() async {
  const AndroidInitializationSettings androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
  const DarwinInitializationSettings iOSInit = DarwinInitializationSettings();
  
  await notificationsPlugin.initialize(
    const InitializationSettings(android: androidInit, iOS: iOSInit),
    onDidReceiveNotificationResponse: (NotificationResponse response) async {
      if (response.payload != null && response.payload!.isNotEmpty) {
        try {
          final data = json.decode(response.payload!);
          navigatorKey.currentState?.push(
            MaterialPageRoute(builder: (_) => WarningScreen(payload: data)),
          );
        } catch (_) {}
      }
    },
  );

  const AndroidNotificationChannel channel = AndroidNotificationChannel(
    'eews_alarm_channel',
    'EEWS Earthquake Alarms',
    description: 'Channel for earthquake alarm notifications',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
  );

  final androidPlugin = notificationsPlugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
  await androidPlugin?.createNotificationChannel(channel);
}

Future<void> requestPermissions() async {
  await [
    Permission.notification,
    Permission.ignoreBatteryOptimizations,
  ].request();
}

Future<void> initializeService() async {
  final service = FlutterBackgroundService();
  
  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: onStart,
      autoStart: true,
      isForegroundMode: true,
      notificationChannelId: 'eews_alarm_channel',
      initialNotificationTitle: 'EEWS Alarm Monitor',
      initialNotificationContent: 'Listening for earthquakes...',
    ),
    iosConfiguration: IosConfiguration(
      autoStart: true,
      onForeground: onStart,
      onBackground: onIosBackground,
    ),
  );
  
  await service.startService();
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  // Only for Android
  if (service is AndroidServiceInstance) {
    service.setForegroundNotificationInfo(
      title: "EEWS Monitoring",
      content: "Listening for earthquakes...",
    );
  }
  
  final prefs = await SharedPreferences.getInstance();
  String apiBase = prefs.getString('apiBase') ?? 'https://lolenseu.pythonanywhere.com/pipeline/eews';
  bool lastWarningState = false;
  
  // Check every second
  Timer.periodic(const Duration(seconds: 1), (timer) async {
    // FIXED: Removed the isRunning() check that doesn't exist
    // Just continue running - the service will stop when app is closed
    
    try {
      // Check for warnings
      final url = '$apiBase/warning';
      final res = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 3));
      
      if (res.statusCode == 200) {
        final data = json.decode(res.body) as Map<String, dynamic>;
        final warning = data['warning'] == true;
        
        // Only trigger notification on state change from false to true
        if (warning && !lastWarningState) {
          final message = data['message'] ?? 'EARTHQUAKE WARNING! Take cover immediately!';
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

          final payload = json.encode({
            'message': message, 
            'location': locationText, 
            'magnitude': maxG, 
            'raw': data
          });

          // Show alarm notification
          await showAlarmNotification(message, locationText, maxG, payload);
          
          // Update foreground notification to show alarm state
          if (service is AndroidServiceInstance) {
            service.setForegroundNotificationInfo(
              title: "⚠️ EARTHQUAKE WARNING ⚠️",
              content: message,
            );
          }
        }
        
        lastWarningState = warning;
      }
    } catch (e) {
      // Silent fail for network errors
    }
    
    // Update timestamp every 5 seconds
    if (DateTime.now().second % 5 == 0) {
      if (service is AndroidServiceInstance) {
        service.setForegroundNotificationInfo(
          title: "EEWS Monitoring",
          content: "Last check: ${DateTime.now().hour}:${DateTime.now().minute}:${DateTime.now().second}",
        );
      }
    }
  });
}

Future<void> showAlarmNotification(String message, String location, double magnitude, String payload) async {
  // Create vibration pattern
  final vibrationPattern = Int64List(6);
  vibrationPattern[0] = 0;
  vibrationPattern[1] = 1000;
  vibrationPattern[2] = 500;
  vibrationPattern[3] = 1000;
  vibrationPattern[4] = 500;
  vibrationPattern[5] = 1000;

  final AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
    'eews_alarm_channel',
    'EEWS Earthquake Alarms',
    channelDescription: 'Channel for earthquake alarm notifications',
    importance: Importance.max,
    priority: Priority.high,
    playSound: true,
    // Comment out sound if you don't have the siren file yet
    // sound: RawResourceAndroidNotificationSound('siren'),
    enableVibration: true,
    vibrationPattern: vibrationPattern,
    fullScreenIntent: true,
    category: AndroidNotificationCategory.alarm,
    visibility: NotificationVisibility.public,
    timeoutAfter: 60000,
    color: const Color(0xFFFF0000),
    ledColor: const Color(0xFFFF0000),
    ledOnMs: 1000,
    ledOffMs: 500,
    styleInformation: const BigTextStyleInformation(''),
    ticker: 'EARTHQUAKE WARNING',
  );
  
  final DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
    presentAlert: true,
    presentSound: true,
    presentBadge: true,
    // sound: 'siren.wav', // Comment out if you don't have the sound file
  );
  
  await notificationsPlugin.show(
    0,
    '⚠️ EARTHQUAKE WARNING ⚠️',
    magnitude > 0 ? '$message (Magnitude: ${magnitude.toStringAsFixed(1)})' : message,
    NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    ),
    payload: payload,
  );
}

@pragma('vm:entry-point')
bool onIosBackground(ServiceInstance service) {
  WidgetsFlutterBinding.ensureInitialized();
  return true;
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EEWS Alarm',
      navigatorKey: navigatorKey,
      theme: ThemeData(
        primarySwatch: Colors.red,
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _serviceRunning = false;
  String _apiBase = 'https://lolenseu.pythonanywhere.com/pipeline/eews';
  String _status = 'Initializing...';
  Timer? _uiTimer;
  final TextEditingController _apiController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadSettings();
    _checkServiceStatus();
    _startUIUpdates();
  }

  @override
  void dispose() {
    _uiTimer?.cancel();
    _apiController.dispose();
    super.dispose();
  }

  void _startUIUpdates() {
    _uiTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      _checkServiceStatus();
    });
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _apiBase = prefs.getString('apiBase') ?? 'https://lolenseu.pythonanywhere.com/pipeline/eews';
      _apiController.text = _apiBase;
    });
  }

  Future<void> _checkServiceStatus() async {
    final service = FlutterBackgroundService();
    final isRunning = await service.isRunning();
    if (isRunning != _serviceRunning) {
      setState(() {
        _serviceRunning = isRunning;
        _status = isRunning ? 'ACTIVE - Listening for earthquakes' : 'STOPPED';
      });
    }
  }

  Future<void> _toggleService() async {
    final service = FlutterBackgroundService();
    
    if (_serviceRunning) {
      service.invoke('stopService');
    } else {
      await service.startService();
    }
    
    _checkServiceStatus();
  }

  Future<void> _saveApiUrl() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('apiBase', _apiController.text);
    setState(() {
      _apiBase = _apiController.text;
    });
    
    // Restart service to use new URL
    final service = FlutterBackgroundService();
    await service.startService();
    
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Settings saved and service restarted')),
    );
  }

  Future<void> _testAlarm() async {
    // Create test warning data
    final Map<String, dynamic> testData = {
      'message': 'TEST ALARM - This is only a test',
      'location': 'Test Location',
      'magnitude': 3.5,
    };
    
    final payload = json.encode(testData);
    
    // Show test alarm
    await showAlarmNotification(
      testData['message'] as String,
      testData['location'] as String,
      testData['magnitude'] as double,
      payload,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.red.shade900, Colors.red.shade700],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(15),
                      ),
                      child: const Icon(
                        Icons.warning_amber_rounded,
                        color: Colors.white,
                        size: 40,
                      ),
                    ),
                    const SizedBox(width: 15),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'EEWS ALARM',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 2,
                            ),
                          ),
                          Text(
                            'Earthquake Early Warning System',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: 30),
                
                // Status Card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.3),
                        blurRadius: 10,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Icon(
                            _serviceRunning ? Icons.notifications_active : Icons.notifications_off,
                            color: _serviceRunning ? Colors.green : Colors.red,
                            size: 30,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _status,
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: _serviceRunning ? Colors.green : Colors.red,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  'Checking API every second',
                                  style: TextStyle(color: Colors.grey[600]),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      LinearProgressIndicator(
                        value: _serviceRunning ? null : 0,
                        backgroundColor: Colors.grey[300],
                        valueColor: AlwaysStoppedAnimation<Color>(
                          _serviceRunning ? Colors.green : Colors.red,
                        ),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 20),
                
                // API Settings Card
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.3),
                        blurRadius: 10,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'API CONFIGURATION',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.red,
                        ),
                      ),
                      const SizedBox(height: 15),
                      TextField(
                        controller: _apiController,
                        decoration: InputDecoration(
                          labelText: 'API Base URL',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          hintText: 'https://your-api.com/eews',
                        ),
                      ),
                      const SizedBox(height: 15),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              onPressed: _saveApiUrl,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.blue,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 15),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                              child: const Text('SAVE & RESTART'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 20),
                
                // Control Buttons
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _toggleService,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _serviceRunning ? Colors.red : Colors.green,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: Text(
                          _serviceRunning ? 'STOP MONITORING' : 'START MONITORING',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: 15),
                
                // Test Button
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _testAlarm,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: const BorderSide(color: Colors.white, width: 2),
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: const Text(
                          'TEST ALARM',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: 20),
                
                // Info Card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(15),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Icon(Icons.info, color: Colors.white.withOpacity(0.7), size: 20),
                          const SizedBox(width: 10),
                          Text(
                            'Background Service Info',
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.9),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'This app runs in the background and checks for earthquake warnings every second. '
                        'When a warning is detected, it will sound a siren and show a full-screen alarm.',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.7),
                          fontSize: 13,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class WarningScreen extends StatelessWidget {
  final Map<String, dynamic> payload;
  const WarningScreen({super.key, required this.payload});

  @override
  Widget build(BuildContext context) {
    final mag = payload['magnitude'] ?? 0.0;
    final msg = payload['message'] ?? 'EARTHQUAKE DETECTED';
    final loc = payload['location'] ?? '';

    return Scaffold(
      backgroundColor: Colors.red.shade900,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Pulsing animation for alarm effect
              TweenAnimationBuilder<double>(
                tween: Tween<double>(begin: 0.8, end: 1.2),
                duration: const Duration(milliseconds: 500),
                curve: Curves.easeInOut,
                builder: (context, double scale, child) {
                  return Transform.scale(
                    scale: scale,
                    child: Container(
                      width: 250,
                      height: 250,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.white.withOpacity(0.5),
                            blurRadius: 30,
                            spreadRadius: 5,
                          ),
                        ],
                      ),
                      child: Center(
                        child: Text(
                          mag > 0 ? (mag as double).toStringAsFixed(1) : '!',
                          style: const TextStyle(
                            fontSize: 80,
                            fontWeight: FontWeight.bold,
                            color: Colors.red,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
              
              const SizedBox(height: 40),
              
              // Warning text with animation
              TweenAnimationBuilder<double>(
                tween: Tween<double>(begin: 0.5, end: 1.0),
                duration: const Duration(milliseconds: 800),
                curve: Curves.elasticOut,
                builder: (context, double opacity, child) {
                  return Opacity(
                    opacity: opacity,
                    child: Column(
                      children: [
                        const Text(
                          '⚠️ EARTHQUAKE WARNING ⚠️',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 2,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 20),
                        Text(
                          msg,
                          style: const TextStyle(
                            fontSize: 22,
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  );
                },
              ),
              
              const SizedBox(height: 20),
              
              if (loc.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: Text(
                    loc,
                    style: const TextStyle(fontSize: 16, color: Colors.white70),
                    textAlign: TextAlign.center,
                  ),
                ),
              
              const Spacer(),
              
              // Dismiss button
              Padding(
                padding: const EdgeInsets.all(30),
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.red.shade900,
                    padding: const EdgeInsets.symmetric(horizontal: 50, vertical: 18),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                  ),
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text(
                    'ACKNOWLEDGE',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}