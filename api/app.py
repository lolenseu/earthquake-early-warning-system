import os
import time
import json
import requests
import threading

import secrets
import hashlib
import jwt

from flask import Flask, jsonify, request
from datetime import datetime, timedelta

# Variables
app = Flask(__name__)

# CORS
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,Cache-Control')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

parent_folder: str = './pipeline'
megastream_folder: str = './megastream'

mem_data_stream:dict = {}

# EEWS variables
USERS_FILE = os.path.join(os.path.dirname(__file__), "users.json")
EEWS_DEVICES_FILE = os.path.join(os.path.dirname(__file__), "eews_devices.json")
HISTORICAL_DATA_FILE = os.path.join(os.path.dirname(__file__), "historical_data.json")
LOCATION_CACHE_FILE = os.path.join(os.path.dirname(__file__), "location_cache.json")

EEWS_DEVICES: dict = {}
EEWS_STORE: dict = {}

# Security constants
SECRET_KEY = secrets.token_hex(32)
TOKEN_EXPIRY_MINUTES = 60

# EEWS constants
G_FORCE_THRESHOLD = 1.35
MIN_DEVICES_FOR_WARNING = 2            # Default is 5

EEWS_EXPIRY_SECONDS = 10

# Location cache
LOCATION_CACHE = {}

# Response Class
class Response:
    @staticmethod
    def success(message: str, pipeline_id: str, timestamp: str, data: dict = None) -> tuple:
        response = {'response': 'success!', 'message': message, 'id': pipeline_id, 'timestamp': timestamp}
        if data:
            response.update(data)
        return jsonify(response), 201
    
    @staticmethod
    def error(message: str, pipeline_id: str, timestamp: str) -> tuple:
        response = {'response': 'error!', 'message': message, 'id': pipeline_id, 'timestamp': timestamp}
        return jsonify(response), 400

# Functions
def create_id(pipeline_id: str, pipeline_key: str) -> bool:
    hex_folder_name = hex(int(pipeline_id))
    folder_location = os.path.join(parent_folder, hex_folder_name)
    try:
        if not os.path.exists(parent_folder):
            os.makedirs(parent_folder)
        if not os.path.isdir(folder_location):
            os.mkdir(folder_location)
        
        key_file_path = os.path.join(folder_location, 'key.txt')
        with open(key_file_path, 'a') as key_file:
            key_file.write(pipeline_key)
        
        if os.path.isdir(folder_location) and os.path.exists(key_file_path):
            return True
        else:
            return False
    except:
        return False

def confirm_id(pipeline_id: str) -> bool:
    hex_folder_name = hex(int(pipeline_id))
    folder_location = os.path.join(parent_folder, hex_folder_name)
    return os.path.isdir(folder_location)

def confirm_key(pipeline_id: str) -> str:
    hex_folder_name = hex(int(pipeline_id))
    folder_location = os.path.join(parent_folder, hex_folder_name)
    key_file_path = os.path.join(folder_location, 'key.txt')
    with open(key_file_path, 'r') as file:
        file_key = file.read()
    return file_key

def update_key(pipeline_id: str, pipeline_new_key: str) -> None:
    hex_folder_name = hex(int(pipeline_id))
    folder_location = os.path.join(parent_folder, hex_folder_name)
    key_file_path = os.path.join(folder_location, 'key.txt')
    with open(key_file_path, 'w') as file:
        file.write(pipeline_new_key)

def data_available(pipeline_id: str) -> bool:
    hex_folder_name = hex(int(pipeline_id))
    file_path = os.path.join(parent_folder, hex_folder_name, 'stream.json')
    return os.path.exists(file_path)

def store_data(pipeline_id: str, data: dict) -> None:
    hex_folder_name = hex(int(pipeline_id))
    folder_location = os.path.join(parent_folder, hex_folder_name)
    if not os.path.exists(folder_location):
        os.makedirs(folder_location)
    with open(os.path.join(folder_location, 'stream.json'), 'w') as f:
        json.dump(data, f)

def read_data(pipeline_id: str) -> dict:
    hex_folder_name = hex(int(pipeline_id))
    folder_location = os.path.join(parent_folder, hex_folder_name)
    with open(os.path.join(folder_location, 'stream.json'), 'r') as f:
        return json.load(f)

def total_id() -> int:
    return len(os.listdir(parent_folder))

def get_server_public_ip() -> str:
    try:
        response = requests.get('https://api.ipify.org?format=json')
        return response.json()['ip']
    except requests.RequestException:
        return 'Unable to get IP'

# Location cache functions
def load_location_cache():
    """Load location cache from file"""
    global LOCATION_CACHE
    if os.path.exists(LOCATION_CACHE_FILE):
        try:
            with open(LOCATION_CACHE_FILE, 'r') as f:
                LOCATION_CACHE = json.load(f)
        except:
            LOCATION_CACHE = {}
    return LOCATION_CACHE

def save_location_cache():
    """Save location cache to file"""
    global LOCATION_CACHE
    try:
        with open(LOCATION_CACHE_FILE, 'w') as f:
            json.dump(LOCATION_CACHE, f, indent=2)
    except:
        pass

def get_city_from_coordinates(latitude, longitude):
    """
    Get city name from coordinates using OpenStreetMap Nominatim API
    Includes caching to avoid rate limiting
    """
    if latitude is None or longitude is None:
        return 'Unknown (No coordinates)'
    
    try:
        # Validate coordinates
        try:
            lat = float(latitude)
            lon = float(longitude)
        except (TypeError, ValueError):
            return 'Unknown (Invalid coordinates)'
        
        # Check if coordinates are within valid ranges
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return 'Unknown (Out of range)'
        
        # Create cache key (rounded to 3 decimal places for approximate location)
        cache_key = f"{lat:.3f},{lon:.3f}"
        
        # Load cache if not already loaded
        if not LOCATION_CACHE:
            load_location_cache()
        
        # Check cache first
        if cache_key in LOCATION_CACHE:
            return LOCATION_CACHE[cache_key]
        
        # Use OpenStreetMap Nominatim API
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            'format': 'json',
            'lat': lat,
            'lon': lon,
            'zoom': 10,  # City level
            'addressdetails': 1,
            'accept-language': 'en'
        }
        
        # Add a proper User-Agent as required by Nominatim terms
        headers = {
            'User-Agent': 'EEWS-Monitor/1.0 (https://github.com/your-repo)',
            'Accept-Language': 'en'
        }
        
        # Make request with timeout
        response = requests.get(url, params=params, headers=headers, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            
            # Extract address components
            address = data.get('address', {})
            
            # Try different address components in order of preference
            city = (
                address.get('city') or
                address.get('town') or
                address.get('village') or
                address.get('hamlet') or
                address.get('municipality') or
                address.get('county') or
                address.get('state_district') or
                address.get('state') or
                address.get('country') or
                'Unknown'
            )
            
            # Add country for better context
            country = address.get('country', '')
            if country and city != 'Unknown' and city != country:
                result = f"{city}, {country}"
            elif city:
                result = city
            else:
                # Get display name if available
                display_name = data.get('display_name', '')
                if display_name:
                    # Take first part of display name
                    result = display_name.split(',')[0].strip()
                else:
                    result = f"Location at {lat:.4f}, {lon:.4f}"
            
            # Cache the result
            LOCATION_CACHE[cache_key] = result
            save_location_cache()
            
            return result
        else:
            # Fallback to coordinates if API fails
            result = f"Location at {lat:.2f}, {lon:.2f}"
            
            # Cache the fallback too
            LOCATION_CACHE[cache_key] = result
            save_location_cache()
            
            return result
            
    except requests.exceptions.Timeout:
        result = f"Location at {lat:.2f}, {lon:.2f} (timeout)"
        return result
    except requests.exceptions.RequestException as e:
        result = f"Location at {lat:.2f}, {lon:.2f}"
        return result
    except Exception as e:
        # Ultimate fallback - return coordinates
        if 'lat' in locals() and 'lon' in locals():
            return f"Location at {lat:.2f}, {lon:.2f}"
        return 'Unknown'

# EEWS functions
def load_eews_users():
    if not os.path.exists(USERS_FILE):
        # Create default users with recovery keys
        default_users = {
            "admin": {
                "role": "admin",
                "email": "admin@eews.com",
                "password": "21232f297a57a5a743894a0e4a801fc3",  # MD5 of "admin"
                "recovery_key": "eews_admin",
                "created_at": datetime.now().isoformat(),
                "last_password_reset": None
            }
        }
        with open(USERS_FILE, "w") as f:
            json.dump(default_users, f, indent=2)
        return default_users
    
    with open(USERS_FILE, "r") as f:
        users = json.load(f)
        
        # Migrate any users without the new fields
        migrated = False
        for username, user_data in users.items():
            if 'recovery_key' not in user_data:
                role = user_data.get('role', 'user')
                user_data['recovery_key'] = f"eews_{role}"
                migrated = True
                print(f"Added recovery key for {username}: eews_{role}")
            
            if 'email' not in user_data:
                user_data['email'] = f"{username}@eews.com"
                migrated = True
            
            if 'created_at' not in user_data:
                user_data['created_at'] = datetime.now().isoformat()
                migrated = True
            
            if 'last_password_reset' not in user_data:
                user_data['last_password_reset'] = None
                migrated = True
        
        if migrated:
            with open(USERS_FILE, "w") as f:
                json.dump(users, f, indent=2)
        
        return users

def save_eews_devices(device):
    os.makedirs(os.path.dirname(EEWS_DEVICES_FILE), exist_ok=True)

    if os.path.exists(EEWS_DEVICES_FILE):
        try:
            with open(EEWS_DEVICES_FILE, "r") as f:
                data = json.load(f)
                devices = data.get("devices", [])
        except json.JSONDecodeError:
            devices = []
    else:
        devices = []

    # Get city name with better error handling
    city = get_city_from_coordinates(device.get("latitude"), device.get("longitude"))

    device_record = {
        "device_id": device["device_id"],
        "auth_seed": device["auth_seed"],
        "latitude": device.get("latitude"),
        "longitude": device.get("longitude"),
        "location": city,
        "registered_at": datetime.now().isoformat()
    }

    # Check if device already exists and update it
    replaced = False
    for i, d in enumerate(devices):
        if d["device_id"] == device_record["device_id"]:
            # Preserve original registration date if updating
            if "registered_at" in d:
                device_record["registered_at"] = d["registered_at"]
            devices[i] = device_record
            replaced = True
            break

    if not replaced:
        devices.append(device_record)

    # Save with pretty formatting
    with open(EEWS_DEVICES_FILE, "w") as f:
        json.dump({
            "devices": devices, 
            "updated_at": datetime.now().isoformat(),
            "total_devices": len(devices)
        }, f, indent=2)

    return device_record

def load_eews_devices():
    if os.path.exists(EEWS_DEVICES_FILE):
        try:
            with open(EEWS_DEVICES_FILE, "r") as f:
                data = json.load(f)
                return data.get("devices", [])
        except:
            return []
    return []

def cleanup_eews_store():
    now = datetime.now()
    expired_devices = []

    for device_id, device_data in list(EEWS_STORE.items()):
        ts_str = device_data.get("server_timestamp")
        if not ts_str:
            expired_devices.append(device_id)
            continue
        try:
            ts = datetime.fromisoformat(ts_str)
            if now - ts > timedelta(seconds=EEWS_EXPIRY_SECONDS):
                expired_devices.append(device_id)
        except Exception:
            expired_devices.append(device_id)

    for device_id in expired_devices:
        EEWS_STORE.pop(device_id, None)
        
def cleanup_loop():
    while True:
        cleanup_eews_store()
        time.sleep(1)

def get_device_location_map():
    devices = load_eews_devices()
    return {d["device_id"]: d.get("location", "Unknown") for d in devices}
    
def detect_earthquake_warning():
    cleanup_eews_store()

    device_location_map = get_device_location_map()
    location_hits = {}

    for device_id, data in EEWS_STORE.items():
        g_force = data.get("g_force")
        if g_force is None or g_force <= G_FORCE_THRESHOLD:
            continue

        location = device_location_map.get(device_id)
        if not location:
            continue

        if location not in location_hits:
            location_hits[location] = []

        location_hits[location].append({
            "device_id": device_id,
            "g_force": g_force,
            "server_timestamp": data.get("server_timestamp")
        })

    # Check if any location meets warning condition
    for location, devices in location_hits.items():
        if len(devices) >= MIN_DEVICES_FOR_WARNING:
            return {
                "warning": True,
                "location": location,
                "device_count": len(devices),
                "devices": devices,
                "message": f"Earthquake detected in {location}"
            }

    return {
        "warning": False,
        "message": "No earthquake detected"
    }

# Initialize historical data structure
def init_historical_data():
    if not os.path.exists(HISTORICAL_DATA_FILE):
        default_data = {
            "day": [],  # Last 24 hours, 1 point per hour
            "week": [], # Last 7 days, 1 point per day
            "month": [] # Last 30 days, 1 point per day
        }
        with open(HISTORICAL_DATA_FILE, 'w') as f:
            json.dump(default_data, f, indent=2)
        return default_data
    
    with open(HISTORICAL_DATA_FILE, 'r') as f:
        return json.load(f)

# Save historical data
def save_historical_data(data):
    with open(HISTORICAL_DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

# Process historical data for different time ranges
def process_historical_data():
    data = init_historical_data()
    
    # Process day data (last 24 hours, hourly)
    day_labels = []
    day_online = []
    day_warnings = []
    day_total = []
    
    now = datetime.now()
    day_points = data.get("day", [])
    
    # Create 24 hourly slots
    for i in range(24):
        hour = now - timedelta(hours=23-i)
        label = hour.strftime("%H:00")
        day_labels.append(label)
        
        # Find data point for this hour
        hour_data = None
        for point in day_points:
            # Fix: Handle both ISO format with Z and without
            timestamp_str = point.get("timestamp", now.isoformat())
            try:
                # Replace 'Z' with '+00:00' for fromisoformat compatibility
                if timestamp_str.endswith('Z'):
                    timestamp_str = timestamp_str.replace('Z', '+00:00')
                point_time = datetime.fromisoformat(timestamp_str)
                # Convert to local time for comparison
                if point_time.tzinfo:
                    point_time = point_time.replace(tzinfo=None)
            except (ValueError, TypeError):
                # Fallback to current time if parsing fails
                point_time = now
            
            if point_time.hour == hour.hour and point_time.day == hour.day and point_time.month == hour.month:
                hour_data = point
                break
        
        if hour_data:
            day_online.append(hour_data.get("online_devices", 0))
            day_warnings.append(hour_data.get("warnings", 0))
            day_total.append(hour_data.get("total_devices", 0))
        else:
            day_online.append(0)
            day_warnings.append(0)
            day_total.append(0)
    
    # Process week data (last 7 days, daily)
    week_labels = []
    week_online = []
    week_warnings = []
    week_total = []
    
    week_points = data.get("week", [])
    
    for i in range(7):
        day = now - timedelta(days=6-i)
        label = day.strftime("%a")
        week_labels.append(label)
        
        # Find data point for this day
        day_data = None
        for point in week_points:
            # Fix: Handle both ISO format with Z and without
            timestamp_str = point.get("timestamp", now.isoformat())
            try:
                # Replace 'Z' with '+00:00' for fromisoformat compatibility
                if timestamp_str.endswith('Z'):
                    timestamp_str = timestamp_str.replace('Z', '+00:00')
                point_time = datetime.fromisoformat(timestamp_str)
                # Convert to local time for comparison
                if point_time.tzinfo:
                    point_time = point_time.replace(tzinfo=None)
            except (ValueError, TypeError):
                # Fallback to current time if parsing fails
                point_time = now
            
            if point_time.day == day.day and point_time.month == day.month:
                day_data = point
                break
        
        if day_data:
            week_online.append(day_data.get("online_devices", 0))
            week_warnings.append(day_data.get("warnings", 0))
            week_total.append(day_data.get("total_devices", 0))
        else:
            week_online.append(0)
            week_warnings.append(0)
            week_total.append(0)
    
    # Process month data (last 30 days, daily)
    month_labels = []
    month_online = []
    month_warnings = []
    month_total = []
    
    month_points = data.get("month", [])
    
    for i in range(30):
        day = now - timedelta(days=29-i)
        label = day.strftime("%d %b")
        month_labels.append(label)
        
        # Find data point for this day
        day_data = None
        for point in month_points:
            # Fix: Handle both ISO format with Z and without
            timestamp_str = point.get("timestamp", now.isoformat())
            try:
                # Replace 'Z' with '+00:00' for fromisoformat compatibility
                if timestamp_str.endswith('Z'):
                    timestamp_str = timestamp_str.replace('Z', '+00:00')
                point_time = datetime.fromisoformat(timestamp_str)
                # Convert to local time for comparison
                if point_time.tzinfo:
                    point_time = point_time.replace(tzinfo=None)
            except (ValueError, TypeError):
                # Fallback to current time if parsing fails
                point_time = now
            
            if point_time.day == day.day and point_time.month == day.month:
                day_data = point
                break
        
        if day_data:
            month_online.append(day_data.get("online_devices", 0))
            month_warnings.append(day_data.get("warnings", 0))
            month_total.append(day_data.get("total_devices", 0))
        else:
            month_online.append(0)
            month_warnings.append(0)
            month_total.append(0)
    
    return {
        "day": {
            "labels": day_labels,
            "datasets": [
                {
                    "label": "Online Devices",
                    "data": day_online,
                    "borderColor": "#00db5b",
                    "backgroundColor": "rgba(0, 219, 91, 0.1)"
                },
                {
                    "label": "Earthquake Warnings",
                    "data": day_warnings,
                    "borderColor": "#ff416c",
                    "backgroundColor": "rgba(255, 65, 108, 0.1)"
                },
                {
                    "label": "Total Devices",
                    "data": day_total,
                    "borderColor": "#4facfe",
                    "backgroundColor": "rgba(79, 172, 254, 0.1)",
                    "borderDash": [5, 5]
                }
            ]
        },
        "week": {
            "labels": week_labels,
            "datasets": [
                {
                    "label": "Online Devices",
                    "data": week_online,
                    "borderColor": "#00db5b",
                    "backgroundColor": "rgba(0, 219, 91, 0.1)"
                },
                {
                    "label": "Earthquake Warnings",
                    "data": week_warnings,
                    "borderColor": "#ff416c",
                    "backgroundColor": "rgba(255, 65, 108, 0.1)"
                },
                {
                    "label": "Total Devices",
                    "data": week_total,
                    "borderColor": "#4facfe",
                    "backgroundColor": "rgba(79, 172, 254, 0.1)",
                    "borderDash": [5, 5]
                }
            ]
        },
        "month": {
            "labels": month_labels,
            "datasets": [
                {
                    "label": "Online Devices",
                    "data": month_online,
                    "borderColor": "#00db5b",
                    "backgroundColor": "rgba(0, 219, 91, 0.1)"
                },
                {
                    "label": "Earthquake Warnings",
                    "data": month_warnings,
                    "borderColor": "#ff416c",
                    "backgroundColor": "rgba(255, 65, 108, 0.1)"
                },
                {
                    "label": "Total Devices",
                    "data": month_total,
                    "borderColor": "#4facfe",
                    "backgroundColor": "rgba(79, 172, 254, 0.1)",
                    "borderDash": [5, 5]
                }
            ]
        }
    }

# Routes
@app.route('/pipeline', methods=['GET', 'POST'])
def home():
    timestamp = datetime.now().isoformat()
    response = {'response': 'success!', 'message': 'Welcome to Pair-Pipeline!', 'timestamp': timestamp}
    return jsonify(response), 200

# Megastream
@app.route('/pipeline/megastream', methods=['GET', 'POST'])
def megastream():
    server_ip: str = get_server_public_ip()
    id: int = total_id()
    timestamp = datetime.now().isoformat()
    response: dict = {
        'server_ip': server_ip,
        'total_id': id,
        'timestamp': timestamp
    }
    return jsonify(response), 200

# Pipeline
@app.route('/pipeline/stream', methods=['GET', 'POST'])
def pipeline():
    try:
        pipeline_option: str = request.args.get('opt')
        pipeline_id: str = request.args.get('id')
        pipeline_key: str = request.args.get('key')
        pipeline_new_key: str = request.args.get('nkey')
        timestamp = datetime.now().isoformat()
        
        # Check if pipeline_id is exactly 8 digits long
        if len(pipeline_id) != 8 or not pipeline_id.isdigit():
            return Response.error('ID must be exactly 8 digits long', pipeline_id, timestamp)
        
        # Check if pipeline_key
        if len(pipeline_key) != 16:
            return Response.error('Key must be exactly 16 string long', pipeline_id, timestamp)
        
        # Check if pipeline_option is valid
        if pipeline_option == 'cre':
            if confirm_id(pipeline_id):
                return Response.error('ID already exists', pipeline_id, timestamp)
            else:
                create_id(pipeline_id, pipeline_key)
                return Response.success('Pipeline created successfully', pipeline_id, timestamp)
            
        elif pipeline_option == 'upk':
            if confirm_id(pipeline_id):
                if pipeline_key != confirm_key(pipeline_id):
                    return Response.error('Wrong key', pipeline_id, timestamp)
                
                if pipeline_new_key:
                    update_key(pipeline_id, pipeline_new_key)
                    return Response.success('Key updated successfully', pipeline_id, timestamp)
            else:
                return Response.error('ID not found', pipeline_id, timestamp)
        
        elif pipeline_option == 'snd':
            if confirm_id(pipeline_id):
                if pipeline_key != confirm_key(pipeline_id):
                    return Response.error('Wrong key', pipeline_id, timestamp)
                
                int_data: dict[str, int] = {}
                str_data: dict[str, str] = {}
                
                # Populate int_data
                for i in range(1, 9):
                    key = f'ivp{i}'
                    value = request.args.get(key)
                    if value:
                        if not value.isdigit() or int(value) > 9999:
                            return Response.error(f'Integer limit 4 digits for {key}', pipeline_id, timestamp)
                        int_data[key] = int(value)

                # Populate str_data
                for i in range(1, 5):
                    key = f'svp{i}'
                    value = request.args.get(key)
                    if value:
                        if len(value) > 128:
                            return Response.error(f'String limit 128 characters for {key}', pipeline_id, timestamp)
                        str_data[key] = value
                
                # Check if the number of ivd values exceeds the limit
                if len(int_data) > 8:
                    return Response.error('Exceeded limit of 8 ivp values', pipeline_id, timestamp)
                
                # Check if the number of svd values exceeds the limit
                if len(str_data) > 4:
                    return Response.error('Exceeded limit of 4 svp values', pipeline_id, timestamp)
                
                if int_data or str_data:
                    data = {'int_virtual_pin': int_data, 'str_virtual_pin': str_data}
                    mem_data_stream[pipeline_id] = data
                    store_data(pipeline_id, data)
                    return Response.success('Data sent successfully', pipeline_id, timestamp)
                else:
                    return Response.error('Data not sent', pipeline_id, timestamp)
            else:
                return Response.error('ID not found', pipeline_id, timestamp)
        
        elif pipeline_option == 'rcv':
            if confirm_id(pipeline_id):
                if pipeline_key != confirm_key(pipeline_id):
                    return Response.error('Wrong key', pipeline_id, timestamp)
                
                if data_available(pipeline_id):
                    #data = mem_data_stream[pipeline_id]
                    data = read_data(pipeline_id)
                    return Response.success('Data received successfully', pipeline_id, timestamp, {'stream': data})
                else:
                    return Response.error('Data not received', pipeline_id, timestamp)
            else:
                return Response.error('ID not found', pipeline_id, timestamp)
                       
        else: 
            return Response.error('Invalid request', pipeline_id, timestamp)
        
    except Exception as e:
        return Response.error('Invalid request', pipeline_id, timestamp)
        #return Response.error(f'Internal server error: {str(e)}', pipeline_id, timestamp)
        
# EEWS api
@app.route('/pipeline/eews/login', methods=['POST', 'GET'])
def earthquake_early_warning_system_login():
    timestamp = datetime.now().isoformat()

    try:
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")
        remember = data.get("remember", False)

        users = load_eews_users()

        if username not in users:
            return jsonify({
                "status": "error",
                "message": "Invalid credentials",
                "server_timestamp": timestamp
            }), 401

        user = users[username]

        password_hash = hashlib.md5(password.encode()).hexdigest()
        if user["password"] != password_hash:
            return jsonify({
                "status": "error",
                "message": "Invalid credentials",
                "server_timestamp": timestamp
            }), 401

        expiry_minutes = TOKEN_EXPIRY_MINUTES
        if remember:
            expiry_minutes *= 12

        token_payload = {
            "username": username,
            "role": user.get("role", "user"),
            "exp": datetime.utcnow() + timedelta(minutes=expiry_minutes)
        }

        token = jwt.encode(token_payload, SECRET_KEY, algorithm="HS256")
        if isinstance(token, bytes):
            token = token.decode('utf-8')
            
        return jsonify({
            "success": True,
            "token": token,
            "user": {
                "username": username,
                "role": user.get("role", "user")
            },
            "server_timestamp": timestamp
        }), 200

    except Exception as e:
        return jsonify({"status": "error",
            "message": f"Login failed: {str(e)}",
            "server_timestamp": timestamp
        }), 500


@app.route('/pipeline/eews/reset_password', methods=['POST'])
def earthquake_early_warning_system_reset_password():
    timestamp = datetime.now().isoformat()

    try:
        data = request.get_json()
        recovery_key = data.get("key")
        new_password = data.get("new_password")
        username = data.get("username")  # Optional

        if not recovery_key or not new_password:
            return jsonify({
                "success": False,
                "message": "Recovery key and new password are required",
                "server_timestamp": timestamp
            }), 400

        # Load users
        users = load_eews_users()
        
        # Find user by recovery key
        found_user = None
        found_username = None
        
        for uname, user_data in users.items():
            # Check if recovery key matches exactly (eews_admin, eews_user format)
            if user_data.get("recovery_key") == recovery_key:
                found_user = user_data
                found_username = uname
                break
            
            # Also check if username is provided and matches with role-based key
            if username and uname == username:
                expected_key = f"eews_{user_data.get('role', 'user')}"
                if recovery_key == expected_key:
                    found_user = user_data
                    found_username = uname
                    break

        if not found_user:
            return jsonify({
                "success": False,
                "message": "Invalid recovery key",
                "server_timestamp": timestamp
            }), 401

        # Update password
        new_password_hash = hashlib.md5(new_password.encode()).hexdigest()
        users[found_username]["password"] = new_password_hash
        users[found_username]["last_password_reset"] = datetime.now().isoformat()

        # Save updated users
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)

        return jsonify({
            "success": True,
            "message": "Password reset successful",
            "username": found_username,
            "role": found_user.get('role'),
            "server_timestamp": timestamp
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Password reset failed: {str(e)}",
            "server_timestamp": timestamp
        }), 500
        
@app.route('/pipeline/eews/change_password', methods=['POST'])
def change_password():
    timestamp = datetime.now().isoformat()
    
    try:
        data = request.get_json()
        new_password = data.get("new_password")
        
        # Get token from header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                "success": False,
                "message": "Unauthorized - Missing token",
                "server_timestamp": timestamp
            }), 401
            
        token = auth_header.split(' ')[1]
        
        try:
            # Verify token and get username
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            username = payload.get('username')
            
            if not username:
                return jsonify({
                    "success": False,
                    "message": "Invalid token payload",
                    "server_timestamp": timestamp
                }), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({
                "success": False,
                "message": "Token expired",
                "server_timestamp": timestamp
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                "success": False,
                "message": "Invalid token",
                "server_timestamp": timestamp
            }), 401
        
        # Validate new password
        if not new_password:
            return jsonify({
                "success": False,
                "message": "New password is required",
                "server_timestamp": timestamp
            }), 400
            
        if len(new_password) < 6:
            return jsonify({
                "success": False,
                "message": "Password must be at least 6 characters",
                "server_timestamp": timestamp
            }), 400
        
        # Load users
        users = load_eews_users()
        
        if username not in users:
            return jsonify({
                "success": False,
                "message": "User not found",
                "server_timestamp": timestamp
            }), 404
        
        # Update password
        new_password_hash = hashlib.md5(new_password.encode()).hexdigest()
        users[username]["password"] = new_password_hash
        users[username]["last_password_reset"] = datetime.now().isoformat()
        
        # Save updated users
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)
        
        return jsonify({
            "success": True,
            "message": "Password changed successfully",
            "server_timestamp": timestamp
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Password change failed: {str(e)}",
            "server_timestamp": timestamp
        }), 500

# NEW: Update recovery key endpoint
@app.route('/pipeline/eews/update_recovery_key', methods=['POST'])
def update_recovery_key():
    timestamp = datetime.now().isoformat()
    
    try:
        data = request.get_json()
        username = data.get("username")
        new_recovery_key = data.get("recovery_key")
        
        # Get token from header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                "success": False,
                "message": "Unauthorized - Missing token",
                "server_timestamp": timestamp
            }), 401
            
        token = auth_header.split(' ')[1]
        
        try:
            # Verify token
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            if payload.get('username') != username:
                return jsonify({
                    "success": False,
                    "message": "Unauthorized",
                    "server_timestamp": timestamp
                }), 403
        except jwt.ExpiredSignatureError:
            return jsonify({
                "success": False,
                "message": "Token expired",
                "server_timestamp": timestamp
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                "success": False,
                "message": "Invalid token",
                "server_timestamp": timestamp
            }), 401
        
        if not username or not new_recovery_key:
            return jsonify({
                "success": False,
                "message": "Username and recovery key are required",
                "server_timestamp": timestamp
            }), 400
        
        # Load users
        users = load_eews_users()
        
        if username not in users:
            return jsonify({
                "success": False,
                "message": "User not found",
                "server_timestamp": timestamp
            }), 404
        
        # Update recovery key
        users[username]["recovery_key"] = new_recovery_key
        
        # Save updated users
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)
        
        return jsonify({
            "success": True,
            "message": "Recovery key updated successfully",
            "recovery_key": new_recovery_key,
            "server_timestamp": timestamp
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to update recovery key: {str(e)}",
            "server_timestamp": timestamp
        }), 500

@app.route('/pipeline/eews/user_profile', methods=['GET'])
def get_user_profile():
    timestamp = datetime.now().isoformat()
    
    try:
        # Get token from header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                "success": False,
                "message": "Unauthorized - Missing token",
                "server_timestamp": timestamp
            }), 401
            
        token = auth_header.split(' ')[1]
        
        try:
            # Verify token and get username
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            username = payload.get('username')
            
            if not username:
                return jsonify({
                    "success": False,
                    "message": "Invalid token payload",
                    "server_timestamp": timestamp
                }), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({
                "success": False,
                "message": "Token expired",
                "server_timestamp": timestamp
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                "success": False,
                "message": "Invalid token",
                "server_timestamp": timestamp
            }), 401
        
        # Load users
        users = load_eews_users()
        
        if username not in users:
            return jsonify({
                "success": False,
                "message": "User not found",
                "server_timestamp": timestamp
            }), 404
        
        user = users[username]
        
        return jsonify({
            "success": True,
            "user": {
                "username": username,
                "email": user.get("email"),
                "role": user.get("role"),
                "recovery_key": user.get("recovery_key"),
                "created_at": user.get("created_at"),
                "last_password_reset": user.get("last_password_reset")
            },
            "server_timestamp": timestamp
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to get user profile: {str(e)}",
            "server_timestamp": timestamp
        }), 500
        
@app.route('/pipeline/eews/historical/save', methods=['POST'])
def save_historical_point():
    timestamp = datetime.now().isoformat()
    
    try:
        # Get token from header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                "success": False,
                "message": "Unauthorized",
                "server_timestamp": timestamp
            }), 401
            
        data = request.get_json()
        
        # Load historical data
        historical = init_historical_data()
        
        # Add to day data (hourly)
        historical["day"].append({
            "timestamp": data.get("timestamp", timestamp),
            "total_devices": data.get("total_devices", 0),
            "online_devices": data.get("online_devices", 0),
            "warnings": data.get("warnings", 0),
            "latency": data.get("latency", 0)
        })
        
        # Keep only last 24 hours (24 points)
        if len(historical["day"]) > 24:
            historical["day"] = historical["day"][-24:]
        
        # Check if we need to add to week data (daily)
        today = datetime.now().date()
        last_week_point = None
        if historical["week"]:
            last_week_point = datetime.fromisoformat(historical["week"][-1]["timestamp"]).date()
        
        if not last_week_point or last_week_point != today:
            # Calculate daily averages
            day_data = historical["day"][-24:] if len(historical["day"]) >= 24 else historical["day"]
            if day_data:
                avg_online = sum(d.get("online_devices", 0) for d in day_data) // len(day_data)
                avg_warnings = sum(d.get("warnings", 0) for d in day_data) // len(day_data)
                max_total = max((d.get("total_devices", 0) for d in day_data), default=0)
                
                historical["week"].append({
                    "timestamp": datetime.now().isoformat(),
                    "total_devices": max_total,
                    "online_devices": avg_online,
                    "warnings": avg_warnings,
                    "latency": sum(d.get("latency", 0) for d in day_data) // len(day_data)
                })
                
                # Keep only last 7 days
                if len(historical["week"]) > 7:
                    historical["week"] = historical["week"][-7:]
        
        # Check if we need to add to month data (daily)
        last_month_point = None
        if historical["month"]:
            last_month_point = datetime.fromisoformat(historical["month"][-1]["timestamp"]).date()
        
        if not last_month_point or last_month_point != today:
            # Use the same day data for month
            day_data = historical["day"][-24:] if len(historical["day"]) >= 24 else historical["day"]
            if day_data:
                avg_online = sum(d.get("online_devices", 0) for d in day_data) // len(day_data)
                avg_warnings = sum(d.get("warnings", 0) for d in day_data) // len(day_data)
                max_total = max((d.get("total_devices", 0) for d in day_data), default=0)
                
                historical["month"].append({
                    "timestamp": datetime.now().isoformat(),
                    "total_devices": max_total,
                    "online_devices": avg_online,
                    "warnings": avg_warnings,
                    "latency": sum(d.get("latency", 0) for d in day_data) // len(day_data)
                })
                
                # Keep only last 30 days
                if len(historical["month"]) > 30:
                    historical["month"] = historical["month"][-30:]
        
        # Save updated data
        save_historical_data(historical)
        
        return jsonify({
            "success": True,
            "message": "Historical data saved",
            "server_timestamp": timestamp
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to save historical data: {str(e)}",
            "server_timestamp": timestamp
        }), 500

# Get historical data for a specific range
@app.route('/pipeline/eews/historical/<range>', methods=['GET'])
def get_historical_data(range):
    timestamp = datetime.now().isoformat()
    
    if range not in ['day', 'week', 'month']:
        return jsonify({
            "success": False,
            "message": "Invalid range. Use 'day', 'week', or 'month'",
            "server_timestamp": timestamp
        }), 400
    
    try:
        # Process data for the requested range
        processed_data = process_historical_data()
        
        return jsonify({
            "success": True,
            "range": range,
            "labels": processed_data[range]["labels"],
            "datasets": processed_data[range]["datasets"],
            "server_timestamp": timestamp
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to get historical data: {str(e)}",
            "server_timestamp": timestamp
        }), 500

# Get all historical data at once
@app.route('/pipeline/eews/historical/all', methods=['GET'])
def get_all_historical_data():
    timestamp = datetime.now().isoformat()
    
    try:
        processed_data = process_historical_data()
        
        return jsonify({
            "success": True,
            "data": processed_data,
            "server_timestamp": timestamp
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Failed to get historical data: {str(e)}",
            "server_timestamp": timestamp
        }), 500
    
@app.route('/pipeline/eews/post_device_id', methods=['POST', 'GET'])
def earthquake_early_warning_system_post_device_id():
    timestamp = datetime.now().isoformat()

    try:
        device_id = request.values.get("device_id")
        auth_seed = request.values.get("auth_seed")
        
        # Handle coordinates - they might come as strings
        lat_str = request.values.get("latitude")
        lon_str = request.values.get("longitude")
        
        latitude = None
        longitude = None
        
        if lat_str and lon_str:
            try:
                latitude = float(lat_str)
                longitude = float(lon_str)
            except ValueError:
                # If conversion fails, log but continue
                print(f"Invalid coordinates: lat={lat_str}, lon={lon_str}")

        if not device_id or not auth_seed:
            return jsonify({
                "status": "error",
                "msg": "device_id or auth_seed missing",
                "server_timestamp": timestamp
            }), 400

        # Get city name from coordinates
        city = get_city_from_coordinates(latitude, longitude)

        device = {
            "device_id": device_id,
            "auth_seed": auth_seed,
            "latitude": latitude,
            "longitude": longitude,
            "location": city
        }

        saved_device = save_eews_devices(device)

        return jsonify({
            "status": "success",
            "device": saved_device,
            "server_timestamp": timestamp
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "msg": f"Invalid request: {str(e)}",
            "server_timestamp": timestamp
        }), 400
    
@app.route('/pipeline/eews/post', methods=['POST', 'GET'])
def earthquake_early_warning_system_post():
    timestamp = datetime.now().isoformat()
    
    try:
        device_id = request.values.get('device_id')
        x_axis = request.values.get('x_axis', type=float)
        y_axis = request.values.get('y_axis', type=float)
        z_axis = request.values.get('z_axis', type=float)
        g_force = request.values.get('g_force', type=float)
        device_timestamp = request.values.get('device_timestamp')
        
        if not device_id:
            return jsonify({"status": "error", "msg": "device_id missing"}), 400
        
        EEWS_STORE[device_id] = {
            "device_id": device_id,
            "x_axis": x_axis,
            "y_axis": y_axis,
            "z_axis": z_axis,
            "g_force": g_force,
            "device_timestamp": device_timestamp,
            "server_timestamp": timestamp
        }
        
        return jsonify({
            "status": "success",
            "stored": EEWS_STORE[device_id]
        }), 200 
        
    except Exception as e:
        return jsonify({"status": "error",
            "msg": str(e),"server_timestamp": timestamp
        }), 500
    
@app.route('/pipeline/eews/verify', methods=['GET'])
def earthquake_early_warning_system_verify_eews_token():
    timestamp = datetime.now().isoformat()
    auth = request.headers.get("Authorization")

    if not auth or not auth.startswith("Bearer "):
        return jsonify({
            "status": "error",
            "msg": "Missing token",
            "server_timestamp": timestamp
        }), 401

    token = auth.split(" ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return jsonify({
            "status": "success",
            "user": {
                "username": payload["username"],
                "role": payload.get("role", "user")
            },
            "server_timestamp": timestamp
        }), 200

    except jwt.ExpiredSignatureError:
        return jsonify({"status": "error",
            "msg": "Token expired",
            "server_timestamp": timestamp
        }), 401

    except jwt.InvalidTokenError:
        return jsonify({"status": "error",
            "msg": "Invalid token",
            "server_timestamp": timestamp
        }), 401
    
@app.route('/pipeline/eews/fetch', methods=['GET'])
def  earthquake_early_warning_system_fetch():
    timestamp = datetime.now().isoformat()
    
    try:
        return jsonify({
            "status": "success",
            "data": "test"
        }), 200
        
    except Exception as e:
        return jsonify({"status": "error",
            "msg": str(e),
            "server_timestamp": timestamp
        }), 500
    
@app.route('/pipeline/eews/devices_list', methods=['GET'])
def earthquake_early_warning_system_devices_list():
    timestamp = datetime.now().isoformat()
    
    try:
        devices_list = list(load_eews_devices())
        
        return jsonify({
            "status": "success",
            "total_devices": len(devices_list),
            "devices": devices_list,
            "server_timestamp": timestamp
        }), 200

    except Exception as e:
        return jsonify({"status": "error",
            "msg": str(e),
            "server_timestamp": timestamp
        }), 500
    
@app.route('/pipeline/eews/devices', methods=['GET'])
def earthquake_early_warning_system_devices():
    timestamp = datetime.now().isoformat()
    
    try:
        cleanup_eews_store()
        
        return jsonify({
            "status": "success",
            "devices": EEWS_STORE
        }), 200

    except Exception as e:
        return jsonify({"status": "error",
            "msg": str(e),
            "server_timestamp": timestamp
        }),500
        
@app.route('/pipeline/eews/device/restart', methods=['POST'])
def device_restart():
    timestamp = datetime.now().isoformat()
    
    try:
        data = request.get_json()
        device_id = data.get("device_id")
        
        # Get token from header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                "success": False,
                "message": "Unauthorized",
                "server_timestamp": timestamp
            }), 401
        
        if not device_id:
            return jsonify({
                "success": False,
                "message": "Device ID required",
                "server_timestamp": timestamp
            }), 400
        
        # Simulate device restart
        # In a real implementation, this would send a command to the actual device
        
        # Remove device from EEWS_STORE to simulate offline during restart
        if device_id in EEWS_STORE:
            # Store the device data temporarily
            device_data = EEWS_STORE[device_id]
            # Remove it to show offline
            del EEWS_STORE[device_id]
            
            # In a real scenario, you'd have a background task to bring it back online
            # For simulation, we'll add it back after a delay
            def bring_device_back():
                time.sleep(3)  # 3 seconds restart time
                EEWS_STORE[device_id] = device_data
                print(f"Device {device_id} back online after restart")
            
            threading.Thread(target=bring_device_back, daemon=True).start()
        
        return jsonify({
            "success": True,
            "message": f"Device {device_id} restart initiated",
            "server_timestamp": timestamp
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e),
            "server_timestamp": timestamp
        }), 500

@app.route('/pipeline/eews/device/sleep', methods=['POST'])
def device_sleep():
    timestamp = datetime.now().isoformat()
    
    try:
        data = request.get_json()
        device_id = data.get("device_id")
        duration = data.get("duration", 30)  # Default 30 seconds
        
        # Get token from header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                "success": False,
                "message": "Unauthorized",
                "server_timestamp": timestamp
            }), 401
        
        if not device_id:
            return jsonify({
                "success": False,
                "message": "Device ID required",
                "server_timestamp": timestamp
            }), 400
        
        # Simulate device sleep
        # Remove device from EEWS_STORE to simulate offline during sleep
        if device_id in EEWS_STORE:
            device_data = EEWS_STORE[device_id]
            del EEWS_STORE[device_id]
            
            # Wake up after duration
            def wake_device():
                time.sleep(duration)
                EEWS_STORE[device_id] = device_data
                print(f"Device {device_id} woke up after {duration}s sleep")
            
            threading.Thread(target=wake_device, daemon=True).start()
        
        return jsonify({
            "success": True,
            "message": f"Device {device_id} sleeping for {duration} seconds",
            "server_timestamp": timestamp
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e),
            "server_timestamp": timestamp
        }), 500
    
@app.route('/pipeline/eews/warning', methods=['GET'])
def earthquake_warning_check():
    timestamp = datetime.now().isoformat()

    try:
        result = detect_earthquake_warning()

        return jsonify({
            "status": "success",
            "server_timestamp": timestamp,
            **result
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "msg": str(e),
            "server_timestamp": timestamp
        }), 500
    
# Error Handling
@app.errorhandler(404)
def page_not_found(e):
    timestamp = datetime.now().isoformat()
    return Response.error('Invalid request', '', timestamp)

# Setup
cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
cleanup_thread.start()

# Load location cache on startup
load_location_cache()

# Main
if __name__ == '__main__':
    app.config['SECRET_KEY'] = SECRET_KEY
    app.run()  # Run the app
    #app.run(debug=True,port=5001)  # for debug