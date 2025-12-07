## main.py

## imports
import machine
import network
import os

import utime as time
import urequests as requests


from boot import *
from configs.config import *
from configs.parameters import *


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
            log_error(f"MPU6050 init failed: {e}")
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
            log_error(f"Read raw failed at reg 0x{reg:02X}: {e}")
            return 0

    def read_accel(self):
        """Return accelerometer values in g's (ax, ay, az)."""
        
        try:
            ax = self.read_raw(0x3B) / 16384.0
            ay = self.read_raw(0x3D) / 16384.0
            az = self.read_raw(0x3F) / 16384.0
            return ax, ay, az
        except Exception as e:
            log_error(f"Read accel failed: {e}")
            return 0.0, 0.0, 0.0


## functions
def magnitude(ax, ay, az):
    return (ax*ax + ay*ay + az*az) ** 0.5

def init_mpu6050():
    timestamp_print("Initializing MPU6050...")
    
    try:
        i2c = machine.SoftI2C(scl=machine.Pin(22), sda=machine.Pin(21), freq=400000)
        devices = i2c.scan()
        timestamp_print(f"I2C devices found: {devices}")
        
        if 0x68 not in devices:
            log_error("MPU6050 not found at address 0x68")
            return None

        mpu = MPU6050(i2c)
        timestamp_print("MPU6050 ready.")
        return mpu
    except Exception as e:
        log_error(f"MPU6050 init failed: {e}")
        return None

    
def detect_earthquake(mpu):
    """Reads accelerometer, computes G-force, and returns dict."""
    
    try:
        ax, ay, az = mpu.read_accel()
        total_g = (ax**2 + ay**2 + az**2) ** 0.5

        data = {
            "ax": ax,
            "ay": ay,
            "az": az,
            "g_force": total_g,
            "timestamp": time.time()
        }

        if total_g >= EARTHQUAKE_THRESHOLD:
            return data
        else:
            return None

    except Exception as e:
        log_error(f"Detect earthquake failed: {e}")
        return None
    
def post_data(data):
    """Post accelerometer data to server."""
    
    try:
        url = "{API_URL}/"
        response = requests.post(url, json=data, headers=headers)
        
        if response.status_code == 200:
            timestamp_print("Data posted successfully.")
        else:
            log_error(f"Data post failed with status: {response.status_code}")
            
    except Exception as e:
        log_error(f"Post error: {e}")
    

## main functions
def main(): 
    global COUNTER, DETECTION_STATE, earthquake_start_time
    
    COUNTER = 0
    DETECTION_STATE = "normal"
    earthquake_start_time = None

    mpu = init_mpu6050()
    if mpu is None:
        timestamp_print("MPU6050 initialization failed.")
        return
    
    timestamp_print("Starting earthquake detection...")
    
    while True:
        try:
            data = detect_earthquake(mpu)

            if data:
                if DETECTION_STATE != "earthquake":
                    earthquake_start_time = time.time()
                    DETECTION_STATE = "earthquake"
                    COUNTER = 0
                    timestamp_print("Earthquake detected!")

                post_data(data)
                time.sleep(SAMPLE_INTERVAL)
                COUNTER += 1

            else:
                if DETECTION_STATE == "earthquake":
                    if earthquake_start_time is None:
                        earthquake_start_time = time.time()
                    elif (time.time() - earthquake_start_time) >= STABLE_TIME:
                        DETECTION_STATE = "normal"
                        COUNTER = 0
                        timestamp_print("No earthquake detected. System stable.")
                        earthquake_start_time = None
                elif 0 == 1:
                    if DETECTION_STATE != "sleep":
                        DETECTION_STATE = "sleep"
                        COUNTER = 0
                        timestamp_print("Entering ultra-low-power mode.")
                    time.sleep(SLEEP_INTERVAL)
                else:
                    if DETECTION_STATE != "normal":
                        DETECTION_STATE = "normal"
                        COUNTER = 0
                        timestamp_print("No earthquake detected. System stable.")
                    time.sleep(NORMAL_INTERVAL)
                
        except Exception as e:
            error_msg = f"Main loop error: {str(e)}"
            timestamp_print(error_msg)
            log_error(error_msg)
            timestamp_print("Retrying in 10 seconds...")
            log_error("Retrying in 10 seconds...")
            time.sleep(10)
   