## main.py

## imports
import machine
import network
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


## call functions
def smooth_read(mpu, samples):
    total_ax = total_ay = total_az = 0
    for _ in range(samples):
        ax, ay, az = mpu.read_accel()
        total_ax += ax
        total_ay += ay
        total_az += az
        
    return total_ax / samples, total_ay / samples, total_az / samples
    
def magnitude(ax, ay, az):
    """Compute magnitude from ax, ay, az."""
    
    return (ax**2 + ay**2 + az**2) ** 0.5
    
def detect_earthquake(mpu):
    """Reads accelerometer, computes G-force, and returns dict."""
    
    try:
        ax, ay, az = smooth_read(mpu, param.SMOOTH_READ_SAMPLING)
        total_g = magnitude(ax, ay, az)

        data = {
            "ax": ax,
            "ay": ay,
            "az": az,
            "g_force": total_g,
            "timestamp": time.time()
        }

        if total_g >= param.EARTHQUAKE_THRESHOLD:
            return data
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
            #timestamp_print("Data posted successfully.")
            pass
        else:
            #log_error(f"Data post failed with status: {response.status_code}")
            pass
            
    except Exception as e:
        log_error(f"Post error: {e}")
        
        
## procedural functions
def init_mpu6050():
    """Initialize and return MPU6050 instance."""
    
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
    

## main functions
def main():
    mpu = init_mpu6050()
    if mpu is None:
        timestamp_print("MPU6050 initialization failed.")
        return

    timestamp_print("Starting earthquake detection...")
    
    
    ## local parameters
    earthquake_active = False
    earthquake_start_time = None
    last_state_print = None

    counter = 0
    shake_counter = 0
    stable_counter = 0

    while True:
        try:
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
                    timestamp_print("Earthquake detected!")
                    last_state_print = "earthquake"

            if stable_counter * param.SAMPLE_INTERVAL >= param.STABLE_TIME and earthquake_active:
                earthquake_active = False
                earthquake_start_time = None
                counter = 0
                
                if last_state_print != "normal":
                    timestamp_print("No earthquake detected.")
                    last_state_print = "normal"

            if earthquake_active and data:
                counter += 1
                post_data(data)
                timestamp_print(f"Magnitude: {data['g_force']:.3f} g")
                time.sleep(param.SAMPLE_INTERVAL)
                continue

            if 0 == 1:
                if last_state_print != "sleep":
                    last_state_print = "sleep"
                    counter = 0
                    timestamp_print("Entering ultra-low-power mode.")
                    
                time.sleep(param.SLEEP_INTERVAL)
                continue

            if not earthquake_active and last_state_print != "normal":
                last_state_print = "normal"
                counter = 0
                timestamp_print("No earthquake detected.")

            time.sleep(param.NORMAL_INTERVAL)

        except Exception as e:
            error_msg = f"Main loop error: {str(e)}"
            timestamp_print(error_msg)
            log_error(error_msg)
            timestamp_print("Retrying in 10 seconds...")
            log_error("Retrying in 10 seconds...")
            time.sleep(10)
