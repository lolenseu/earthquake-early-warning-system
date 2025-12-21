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

EEWS_DEVICES: dict = {}
EEWS_STORE: dict = {}

# Security constants
SECRET_KEY = secrets.token_hex(32)
TOKEN_EXPIRY_MINUTES = 60

# EEWS constants
G_FORCE_THRESHOLD = 1.35
MIN_DEVICES_FOR_WARNING = 5

EEWS_EXPIRY_SECONDS = 10

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

# EEWS functions
def load_eews_users():
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, "r") as f:
        return json.load(f)

def save_eews_devices(device):
    os.makedirs(os.path.dirname(EEWS_DEVICES_FILE), exist_ok=True)

    if os.path.exists(EEWS_DEVICES_FILE):
        with open(EEWS_DEVICES_FILE, "r") as f:
            data = json.load(f)
            devices = data.get("devices", [])
    else:
        devices = []

    city = get_city_from_coordinates(device.get("latitude"), device.get("longitude"))

    device_record = {
        "device_id": device["device_id"],
        "auth_seed": device["auth_seed"],
        "latitude": device.get("latitude"),
        "longitude": device.get("longitude"),
        "location": city,
        "registered_at": datetime.now().isoformat()
    }

    replaced = False
    for i, d in enumerate(devices):
        if d["device_id"] == device_record["device_id"]:
            devices[i] = device_record
            replaced = True
            break

    if not replaced:
        devices.append(device_record)

    with open(EEWS_DEVICES_FILE, "w") as f:
        json.dump({"devices": devices, "updated_at": datetime.now().isoformat()}, f, indent=2)

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

def get_city_from_coordinates(latitude, longitude):
    try:
        url = f"https://nominatim.openstreetmap.org/reverse"
        params = {
            'format': 'json',
            'lat': latitude,
            'lon': longitude,
            'addressdetails': 1,
            'accept-language': 'en'
        }
        
        response = requests.get(url, params=params, headers={
            'User-Agent': 'EEWS-Monitor/1.0'
        })
        
        if response.status_code == 200:
            data = response.json()
            address = data.get('address', {})
            
            city = (address.get('city') or 
                   address.get('town') or 
                   address.get('village') or 
                   address.get('hamlet') or 
                   address.get('municipality') or
                   address.get('state') or
                   'Unknown')
            
            return city
        else:
            return 'Unknown'
            
    except Exception:
        return 'Unknown'

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
    
@app.route('/pipeline/eews/post_device_id', methods=['POST', 'GET'])
def earthquake_early_warning_system_post_device_id():
    timestamp = datetime.now().isoformat()

    try:
        device_id = request.values.get("device_id")
        auth_seed = request.values.get("auth_seed")
        latitude = request.values.get("latitude", type=float)
        longitude = request.values.get("longitude", type=float)

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
        return jsonify({"status": "error",
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

# Main
if __name__ == '__main__':
    app.config['SECRET_KEY'] = SECRET_KEY
    app.run()  # Run the app
    #app.run(debug=True,port=5001)  # for debug