## main.py

## imports

import machine
import network
import os

import utime as time
import urequests as requests

from wsgiref import headers


from boot import *
from configs.config import *
from configs.parameters import *


## classes

## MPU6050 Driver
class MPU6050:
    def __init__(self, i2c, addr=0x68):
        self.i2c = i2c
        self.addr = addr
        # Wake up sensor
        self.i2c.writeto_mem(self.addr, 0x6B, b'\x00')

    def read_raw(self, reg):
        high = self.i2c.readfrom_mem(self.addr, reg, 1)[0]
        low = self.i2c.readfrom_mem(self.addr, reg + 1, 1)[0]
        value = (high << 8) | low
        if value > 32767:
            value -= 65536
        return value

    def read_accel(self):
        ax = self.read_raw(0x3B)
        ay = self.read_raw(0x3D)
        az = self.read_raw(0x3F)
        return ax / 16384, ay / 16384, az / 16384


## functions

def magnitude(ax, ay, az):
    return (ax*ax + ay*ay + az*az) ** 0.5

def init_mpu6050():
    timestamp_print("Initializing MPU6050...")

    try:
        i2c = machine.I2C(0, scl=machine.Pin(22), sda=machine.Pin(21), freq=400000)
        mpu = MPU6050(i2c)
        timestamp_print("MPU6050 ready.")
        return mpu
    
    except Exception as e:
        log_error(f"MPU6050 init failed: {e}")
        return None
    
def detect_earthquake(mpu):
    """Reads accelerometer, computes G-force."""
    
    try:
        ax = mpu.accel.x
        ay = mpu.accel.y
        az = mpu.accel.z

        total_g = (ax**2 + ay**2 + az**2) ** 0.5

        data = {
            "ax": ax,
            "ay": ay,
            "az": az,
            "g_force": total_g,
            "timestamp": time.time()
        }
        
        return data
        
    except Exception as e:
        log_error(f"Read error: {e}")
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
    

## main function
def main(): 
    mpu = init_mpu6050()
    
    if mpu is None:
        timestamp_print("MPU6050 initialization failed.")
        return
    
    timestamp_print("Starting earthquake detection...")
    while True:
        try:
            earthquake_detected = detect_earthquake(mpu)
            
            if earthquake_detected:
                if COUNTER <= 0: 
                    timestamp_print("Earthquake detected!")
                else:  
                    post_data(earthquake_detected)
                    time.sleep(SAMPLE_INTERVAL)
                    COUNTER += 1
            
            elif api_ultra_sleep == True:
                if COUNTER <= 0:
                    timestamp_print("Entering ultra-low-power mode.")
                else:
                    time.sleep(ULTRA_SLEEP_INTERVAL)
                    COUNTER += 1
                
            else:
                if COUNTER <= 0:
                    timestamp_print("No earthquake detected. System stable.")
                else:
                    time.sleep(NORMAL_INTERVAL)
                    COUNTER += 1
                
        except Exception as e:
            error_msg = f"Main loop error: {str(e)}"
            timestamp_print(error_msg)
            log_error(error_msg)
            timestamp_print("Retrying in 10 seconds...")
            log_error("Retrying in 10 seconds...")
            time.sleep(10)
        
        
        