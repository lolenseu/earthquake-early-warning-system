## main.py

## imports
import machine
import os

import utime as time
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
            y_axis = self.read_raw(0x3F) / 16384.0
            return x_axis, y_axis, y_axis
        
        except Exception as e:
            eprint(PRINTSTATUS.ERROR, f"Read accel failed: {e}")
            return 0.0, 0.0, 0.0


## call functions
def smooth_read(mpu, samples):
    total_ax = total_ay = total_az = 0
    for _ in range(samples):
        x_axis, y_axis, z_axis = mpu.read_accel()
        total_x_axis += x_axis
        total_y_axis += y_axis
        total_z_axis += z_axis
        
    return total_ax / samples, total_ay / samples, total_az / samples
    
def magnitude(x_axis, y_axis, z_axis):
    """Compute magnitude from x_axis, y_axis, z_axis."""
    
    return (x_axis**2 + y_axis**2 + z_axis**2) ** 0.5
    
def detect_earthquake(mpu):
    """Reads accelerometer, computes G-force, and returns dict."""
    
    try:
        x_axis, y_axis, z_axis = smooth_read(mpu, param.SMOOTH_READ_SAMPLING)
        total_g = magnitude(x_axis, y_axis, z_axis)

        data = {
            "x_axis": x_axis,
            "y_axis": y_axis,
            "z_axis": z_axis,
            "g_force": total_g
        }

        if total_g >= param.EARTHQUAKE_THRESHOLD:
            return data
        return None

    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"Detect earthquake failed: {e}")
        return None
    
def fetch_data():
    """Fetch dats from sever."""
    
    url = "{API_URL}/eews/fetch"
    json_headers = {"Content-Type": "application/json", "Accept": "application/json"}
    
    try:   
        response = requests.get(url, headers=json_headers)
        response.close()
        
        if response.status_code == 200:
            data = response.json()
            param.REQUEST_DATA = data
            #tprint(PRINTSTATUS.INFO, "Data fetched successfully")
            return data

        else:
            return None
         
    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"Fetch error: {e}")
        return None
        
def post_data(data):
    """Post data to server."""
    
    url = "{API_URL}/eews"
    json_headers = {"Content-Type": "application/json", "Accept": "application/json"}
    
    try:
        response = requests.post(url, json=data, headers=json_headers)
        response.close()
        
        if response.status_code == 200:
            #tprint(PRINTSTATUS.INFO, "Data posted successfully")
            return response.json()
        else:
            #eprint(PRINTSTATUS.ERROR, f"Data post failed with PRINTSTATUS: {response.status_code}")
            return None
            
    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"Post error: {e}")
        return None
        
def payload(data):
    x_axis, y_axis, z_axis, g_force = data
    
    payload = {
        "device_id": param.DEVICE_ID,
        "auth_seed": param.AUTH_SEED,
        "x_axis": x_axis,
        "y_axis": y_axis,
        "z_axis": z_axis,
        "g_force": g_force,
        "device_timestamp": time.time()
    }
    
    return payload


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
    
    earthquake_active = False
    earthquake_start_time = None
    last_state_print = None

    counter = 0
    shake_counter = 0
    stable_counter = 0
    
    tprint(PRINTSTATUS.INFO, "Starting earthquake detection...")

    while True:
        data = detect_earthquake(mpu)
        now = time.time()

        if data:
            shake_counter += 1
            stable_counter = 0
        else:
            stable_counter += 1
            shake_counter = 0

        if shake_counter >= param.REQUIRED_SHAKE_COUNT and not earthquake_active:
            earthquake_active = True
            earthquake_start_time = now
            counter = 0
            
            if last_state_print != "earthquake":
                tprint(PRINTSTATUS.INFO, "Earthquake detected!")
                last_state_print = "earthquake"

        if stable_counter * param.SAMPLE_INTERVAL >= param.STABLE_TIME and earthquake_active:
            earthquake_active = False
            earthquake_start_time = None
            counter = 0
            
            if last_state_print != "normal":
                tprint(PRINTSTATUS.INFO, "No earthquake detected")
                last_state_print = "normal"

        if earthquake_active and data:
            counter += 1
            
            param.PAYLOAD = payload(data)
            post_data(param.PAYLOAD)
            
            tprint(PRINTSTATUS.INFO, f"Magnitude: {data['g_force']:.3f} g")
            
            time.sleep(param.SAMPLE_INTERVAL)
            continue

        if 0 == 1:
            if last_state_print != "sleep":
                last_state_print = "sleep"
                counter = 0
                
                param.PAYLOAD = payload(data)
                post_data(param.PAYLOAD)
                
                tprint(PRINTSTATUS.INFO, "Entering ultra-low-power mode")
            
            fetch_data()
            time.sleep(param.SLEEP_INTERVAL)
            continue

        if not earthquake_active and last_state_print != "normal":
            last_state_print = "normal"
            counter = 0
            
            tprint(PRINTSTATUS.INFO, "No earthquake detected")

        fetch_data()
        time.sleep(param.NORMAL_INTERVAL)
    
