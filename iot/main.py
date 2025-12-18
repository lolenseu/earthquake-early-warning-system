## main.py

## imports
import machine
import os

import utime as time
import ujson as json
import urequests as requests


from boot import *
from configs.config import *

from configs import parameters as param


## classes
## MPU6050 Driver
class MPU6050:
    def __init__(self, i2c, addr=0x68):
        self.i2c = i2c
        self.addr = addr
        try:
            # Check if device is present
            devices = i2c.scan()
            if addr not in devices:
                raise OSError(f"MPU6050 not found at address 0x{addr:02X}")
            
            # Wake up sensor
            self.i2c.writeto_mem(self.addr, 0x6B, b'\x00')
            time.sleep(0.1)
            
        except Exception as e:
            eprint(PRINTSTATUS.ERROR, f"MPU6050 init failed: {e}")
            raise

    def read_raw(self, reg):
        """Read 16-bit signed value from two consecutive registers."""
        
        try:
            high = self.i2c.readfrom_mem(self.addr, reg, 1)[0]
            low = self.i2c.readfrom_mem(self.addr, reg + 1, 1)[0]
            value = (high << 8) | low
            if value > 32767:
                value -= 65536
            return value
        
        except Exception as e:
            eprint(PRINTSTATUS.ERROR, f"Read raw failed at reg 0x{reg:02X}: {e}")
            return 0

    def read_accel(self):
        """Return accelerometer values in g's (ax, ay, az)."""
        
        try:
            x_axis = self.read_raw(0x3B) / 16384.0
            y_axis = self.read_raw(0x3D) / 16384.0
            z_axis = self.read_raw(0x3F) / 16384.0
            return x_axis, y_axis, z_axis
        
        except Exception as e:
            eprint(PRINTSTATUS.ERROR, f"Read accel failed: {e}")
            return 0.0, 0.0, 0.0


## call functions
def smooth_read(mpu, samples):
    total_x_axis = total_y_axis = total_z_axis = 0
    for _ in range(samples):
        x_axis, y_axis, z_axis = mpu.read_accel()
        total_x_axis += x_axis
        total_y_axis += y_axis
        total_z_axis += z_axis
        
    return total_x_axis / samples, total_y_axis / samples, total_z_axis / samples
    
def magnitude(x_axis, y_axis, z_axis):
    """Compute magnitude from x_axis, y_axis, z_axis."""
    
    return (x_axis**2 + y_axis**2 + z_axis**2) ** 0.5
    
def detect_earthquake(mpu):
    """Reads accelerometer, computes G-force, and returns dict."""
    
    try:
        x_axis, y_axis, z_axis = mpu.read_accel()
        #x_axis, y_axis, z_axis = smooth_read(mpu, param.SMOOTH_READ_SAMPLING)                  #filter is disabled
        
        g_force = magnitude(x_axis, y_axis, z_axis)

        data = {
            "x_axis": x_axis,
            "y_axis": y_axis,
            "z_axis": z_axis,
            "g_force": g_force
        }

        if g_force >= param.EARTHQUAKE_THRESHOLD:
            return data
        return None

    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"Detect earthquake failed: {e}")
        return None
    
def fetch_data():
    """Fetch data from server (GET request, headers only)."""
    
    url = f"{API_URL}/eews/fetch"
    headers = {
        "Accept": "text/plain"
    }
    
    try:
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            text = response.text

            try:
                data = json.loads(text)
            except:
                data = text
            
            param.REQUEST_DATA = data
            response.close()
            return data
        else:
            response.close()
            return None
         
    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"Fetch error: {e}")
        return None
        
def post_data(data):
    """Post data to server using URL-encoded form instead of JSON."""
    
    url = f"{API_URL}/eews/post"
    headers = {"Content-Type": "application/x-www-form-urlencoded", "Accept": "text/plain"}
    
    try:
        payload_str = "&".join([f"{k}={v}" for k, v in data.items()])
        response = requests.post(url, data=payload_str, headers=headers)
        response.close()
        return True
            
    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"Post error: {e}")
        return None
    
def post_storage_data(data):
    """Post storage data to API using URL-encoded form."""
    
    url = f"{API_URL_STORAGE}/eews/post_device_id"
    headers = {"Content-Type": "application/x-www-form-urlencoded", "Accept": "text/plain"}
    
    try:
        payload_str = "&".join([f"{k}={v}" for k, v in data.items()])
        response = requests.post(url, data=payload_str, headers=headers)
        response.close()
        return True

    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"Storage POST error: {e}")
        return False

def storage_payload():
    """Build storage payload for device registration."""
    try:
        return {    
            "device_id": param.DEVICE_ID,
            "auth_seed": param.AUTH_SEED,
            "latitude": param.LATITUDE,
            "longitude": param.LONGITUDE
        }

    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"Storage payload build failed: {e}")
        return None
    
def payload(data=None):
    """Build payload. If no data, send zeros."""
    
    try:
        if data:
            x_axis = data["x_axis"]
            y_axis = data["y_axis"]
            z_axis = data["z_axis"]
            g_force = data["g_force"]
        else:
            x_axis = y_axis = z_axis = 0.0
            g_force = 0.0

        payload = {}
            
        if param.SEND_AXIS:
            payload["x_axis"] = x_axis
            payload["y_axis"] = y_axis
            payload["z_axis"] = z_axis
            
        if param.SEND_GFORCE:
            payload["g_force"] = g_force
            
        if param.SEND_TIMESTAMP:
            payload["device_timestamp"] = time.time()
            
        payload["device_id"] = param.DEVICE_ID

        return payload

    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"Payload build failed: {e}")
        return None


## procedural functions
def init_mpu6050():
    """Initialize and return MPU6050 instance."""
    
    tprint(PRINTSTATUS.INFO, "Initializing MPU6050...")
    
    try:
        i2c = machine.SoftI2C(scl=machine.Pin(param.SLC_PINOUT), sda=machine.Pin(param.SDA_PINOUT), freq=param.I2C_MPU_FREQUENCY)
        devices = i2c.scan()
        tprint(PRINTSTATUS.INFO, f"I2C devices found: {devices}")
        
        if 0x68 not in devices:
            eprint(PRINTSTATUS.ERROR, "MPU6050 not found at address 0x68")
            return None

        mpu = MPU6050(i2c)
        tprint(PRINTSTATUS.SUCCESS, "MPU6050 ready")
        return mpu
    
    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"MPU6050 init failed: {e}")
        return None
        

## main function  
def main():
    tprint(PRINTSTATUS.INFO, "Initializing Hardware...")
    mpu = init_mpu6050()

    if mpu is None:
        tprint(PRINTSTATUS.ERROR, "Hardware initialization failed")
        return

    tprint(PRINTSTATUS.INFO, "Registering device...")
    if post_storage_data(storage_payload()):
        tprint(PRINTSTATUS.SUCCESS, "Registration successful")

    MODE_NORMAL = 0
    MODE_SLEEP = 1
    MODE_EARTHQUAKE = 2

    mode = MODE_NORMAL
    last_printed_mode = None

    exit_deadline = None

    tprint(PRINTSTATUS.INFO, "Starting earthquake detection...")

    while True:
        if mode == MODE_NORMAL:
            if last_printed_mode != MODE_NORMAL:
                tprint(PRINTSTATUS.INFO, "No earthquake detected")
                last_printed_mode = MODE_NORMAL

            shake_detected = False

            for _ in range(param.REQUIRED_SHAKE_COUNT):
                data = detect_earthquake(mpu)
                if data:
                    shake_detected = True
                    break
                time.sleep(param.NORMAL_INTERVAL / param.REQUIRED_SHAKE_COUNT)

            if shake_detected:
                mode = MODE_EARTHQUAKE
                exit_deadline = None
                continue

            if 1 == 0:
                mode = MODE_SLEEP
                continue

            post_data(payload(None))
            fetch_data()
            time.sleep(param.NORMAL_INTERVAL)
            continue

        if mode == MODE_SLEEP:
            if last_printed_mode != MODE_SLEEP:
                tprint(PRINTSTATUS.INFO, "Entering ultra-low-power mode")
                last_printed_mode = MODE_SLEEP
                
            if 1 == 0:
                mode = MODE_NORMAL
                continue

            post_data(payload(None))
            fetch_data()
            time.sleep(param.SLEEP_INTERVAL)
            continue
            
        if mode == MODE_EARTHQUAKE:
            if last_printed_mode != MODE_EARTHQUAKE:
                tprint(PRINTSTATUS.INFO, "Earthquake detected!")
                last_printed_mode = MODE_EARTHQUAKE

            data = detect_earthquake(mpu)
            now = time.time()

            if data:
                exit_deadline = None
                post_data(payload(data))
                tprint(PRINTSTATUS.INFO, f"Magnitude: {data['g_force']:.3f} g")
            else:
                if exit_deadline is None:
                    exit_deadline = now + param.STABLE_TIME
                elif now >= exit_deadline:
                    mode = MODE_NORMAL
                    exit_deadline = None

            time.sleep(param.EARTHQUAKE_INTERVAL)
            