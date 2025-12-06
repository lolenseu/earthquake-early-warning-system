## firmware boot.py

## imports

import machine
import network
import time
import os

import urequests as requests

from configs.network_config import SSID, PASSWORD
from configs.config import VERSION_FILE, VERSION_URL, MAIN_URL


## functions

def timestamp_print(message) -> None:
    """Helper function to add timestamp to all messages"""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    print(f"[{timestamp}] {message}")


def start_wifi() -> None:
    """Start WiFi connection using provided SSID and PASSWORD"""
    try:
        wlan = network.WLAN(network.STA_IF)
        wlan.active(True)
        wlan.connect(SSID, PASSWORD)
        
        timeout = 30 
        connected = False
        
        for i in range(timeout):
            if wlan.isconnected():
                connected = True
                break
            time.sleep(1)
        
        if connected:
            timestamp_print(f"Connected to WiFi: {wlan.ifconfig()}")
        else:
            timestamp_print("WiFi connection timeout")
            raise Exception("WiFi connection failed")
            
    except Exception as e:
        timestamp_print(f"WiFi error: {e}")
        raise e
    

def fech_old_version_info() -> tuple:
    """Read old version info from local VERSION_FILE"""
    try:
        with open(VERSION_FILE, "r") as f:
            version_info = f.read().strip()
            
            if version_info:
                old_status = version_info[0:4]
                old_version = version_info[7:]
                timestamp_print("Successfully read old version info")
                return old_status, old_version
            
        return None, None
    except Exception as e:
        timestamp_print(f"Error reading old version info: {e}")
        return None, None


def fech_version_info() -> tuple:
    """Fetch latest version info from VERSION_URL"""
    try:
        response = requests.get(VERSION_URL)
        
        if response.status_code == 200:
            response_text = response.text.strip()
            
            if response_text:
                response_status = response_text[0:4]
                response_version = response_text[7:]
                timestamp_print(f"Response status: {response_status}")
                timestamp_print(f"Response version: {response_version}")
                timestamp_print("Successfully fetched version info")
                return response_status, response_version
                
        return None, None
    except Exception as e:
        timestamp_print(f"Error fetching version info: {e}")
        return None, None


def check_for_updates() -> None:
    """Compare old and new versions, update main.py if newer version is available"""
    try:
        old_status, old_version = fech_old_version_info()
        status, version = fech_version_info()
        
        old_version_patch = old_version.rsplit('.', 1)[-1]
        version_patch = version.rsplit('.', 1)[-1]
        
        if status == "live" and (version_patch != old_version_patch or int(version_patch) > int(old_version_patch)):
            timestamp_print(f"New version available: {version}")
            
            timestamp_print("Updating version info...")
            with open(VERSION_FILE, "w") as f:
                f.write(f"{status} - {version}")
            
            timestamp_print("Downloading main.py...")
            response = requests.get(MAIN_URL)
            
            if response.status_code == 200:
                with open("main.py", "w") as f:
                    f.write(response.text)
                timestamp_print(f"main.py updated to version {version}")
                machine.reset()
            else:
                timestamp_print("Failed to download main.py")
        else:
            timestamp_print("No updates available")
    except Exception as e:
        timestamp_print(f"Error: {e}")


def startup() -> None:
    """Main startup loop: connect WiFi, check for updates, run main.py"""
    while True: 
        try:
            timestamp_print("Starting up...")
            start_wifi()
            check_for_updates()
            
            import main
            if __name__ == "__main__":
                timestamp_print("Running main.py...")
                main.main()
                
            time.sleep(10)
            machine.reset()
            
        except Exception as e:
            timestamp_print(f"Startup error: {e}")
            timestamp_print("Retrying in 10 seconds...")
            time.sleep(10)
            machine.reset()


if __name__ == "__main__":
    startup()
