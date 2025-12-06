## firmware boot.py

## imports

import machine
import network
import ntptime
import os

import utime as time
import urequests as requests


from configs.config import *
from configs.network_config import *


## functions

def get_date_string() -> str:
    """Return current date as YYYY_MM_DD."""
    
    year, month, day = time.localtime()[:3]
    return f"{year:04d}_{month:02d}_{day:02d}"

def get_log_filename(log_type: str) -> str:
    """Return log filename for given type."""
    
    date_str = get_date_string()
    return f"{LOG_FOLDER}/{log_type}_{date_str}.log"

def log_to_file(log_type: str, message: str) -> None:
    """Append message to runtime or error log."""
    
    try:
        filename = get_log_filename(log_type)
        
        if log_type == "runtime":
            with open(filename, "a") as f:
                f.write(message + "\n")
        else:
            with open(filename, "a") as f:
                f.write(message + "\n")
    except:
        pass

def log_error(message: str) -> None:
    """Log error with timestamp, append to error file, and console."""
    
    rtc = machine.RTC().datetime()
    timestamp = f"{rtc[0]:04d}-{rtc[1]:02d}-{rtc[2]:02d} {rtc[4]:02d}:{rtc[5]:02d}:{rtc[6]:02d}"
    full_message = f"[{timestamp}] ERROR: {message}"
    
    log_to_file("error", full_message)
    
def timestamp_print(message: str) -> int:
    """Print message with timestamp, append to runtime log."""
    
    rtc = machine.RTC().datetime()
    timestamp = f"{rtc[0]:04d}-{rtc[1]:02d}-{rtc[2]:02d} {rtc[4]:02d}:{rtc[5]:02d}:{rtc[6]:02d}"
    full_message = f"[{timestamp}] {message}"
    print(full_message)
    
    log_to_file("runtime", full_message)
    
    return int(time.time())


## procedure functions
def reset_logs() -> None:
    """Reset runtime and error logs for current date."""
    
    try:
        for log_type in ["runtime", "error"]:
            filename = get_log_filename(log_type)
            with open(filename, "w") as f:
                f.write("")
    except:
        pass

def start_wifi() -> bool:
    """Connect to WiFi with retry and timeout."""
    
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            timestamp_print(f"Connecting to WiFi... (Attempt {retry_count + 1}/{max_retries})")
            
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
                return True
            else:
                timestamp_print("WiFi connection timeout")
                retry_count += 1
                if retry_count < max_retries:
                    timestamp_print(f"Retrying in 5 seconds...")
                    time.sleep(5)
                    
        except Exception as e:
            error_msg = f"WiFi error: {e}"
            timestamp_print(error_msg)
            log_error(error_msg)
            retry_count += 1
            if retry_count < max_retries:
                timestamp_print(f"Retrying in 5 seconds...")
                time.sleep(5)
    
    error_msg = "WiFi connection failed after 3 attempts"
    timestamp_print(error_msg)
    log_error(error_msg)
    error_msg = "Resetting device..."
    timestamp_print(error_msg)
    log_error(error_msg)
    machine.reset()
    return False

def sync_time():
    """Sync device time using NTP."""
    
    try:
        ntptime.settime()
        timestamp_print("Time synced using NTP")
    except:
        timestamp_print("NTP sync failed")

def fech_old_version_info() -> tuple[str | None, str | None]:
    """Read local version file and return (status, version)."""
    
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
        error_msg = f"Error reading old version info: {e}"
        timestamp_print(error_msg)
        log_error(error_msg)
        return None, None


def fech_version_info() -> tuple[str | None, str | None]:
    """Fetch remote version info and return (status, version)."""
    
    try:
        response = requests.get(VERSION_URL, timeout=10)
        
        if response.status_code == 200:
            response_text = response.text.strip()
            
            if response_text:
                response_status = response_text[0:4]
                response_version = response_text[7:]
                timestamp_print(f"Response version: {response_text}")
                timestamp_print("Successfully fetched version info")
                return response_status, response_version
                
        return None, None
    except Exception as e:
        error_msg = f"Error fetching version info: {e}"
        timestamp_print(error_msg)
        log_error(error_msg)
        return None, None


def check_for_updates() -> bool:
    """Check for firmware updates and apply if available."""
    
    try:
        old_status, old_version = fech_old_version_info()
        status, version = fech_version_info()

        if not status or not version or not old_version:
            error_msg = "Could not fetch version info properly"
            timestamp_print(error_msg)
            log_error(error_msg)
            return False
            
        old_version_patch = old_version.rsplit('.', 1)[-1]
        version_patch = version.rsplit('.', 1)[-1]
        
        if status == "live" and (version_patch != old_version_patch or int(version_patch) > int(old_version_patch)):
            timestamp_print(f"New version available: {version}")
            
            timestamp_print("Updating version info...")
            with open(VERSION_FILE, "w") as f:
                f.write(f"{status} - {version}")
            
            timestamp_print("Downloading main.py...")
            response = requests.get(MAIN_URL, timeout=30)
            
            if response.status_code == 200:
                with open("main.py", "w") as f:
                    f.write(response.text)
                timestamp_print(f"main.py updated to version {version}")
                machine.reset()
            else:
                error_msg = "Failed to download main.py"
                timestamp_print(error_msg)
                log_error(error_msg)
                return False
        else:
            timestamp_print("No updates available")
            return True
    except Exception as e:
        error_msg = f"Error: {e}"
        timestamp_print(error_msg)
        log_error(error_msg)
        return False


## main startup loop
def startup() -> None:
    """Boot process: WiFi, updates, run main.py with retry on error."""
    
    reset_logs()
    
    while True: 
        try:
            timestamp_print("Starting up...")
            start_wifi()
            sync_time()
            check_for_updates()
            
            import main
            if __name__ == "__main__":
                timestamp_print("Running main.py...")
                main.main()
                
            time.sleep(10)
            machine.reset()
            
        except Exception as e:
            error_msg = f"Startup error: {e}"
            timestamp_print(error_msg)
            log_error(error_msg)
            timestamp_print("Retrying in 10 seconds...")
            log_error("Retrying in 10 seconds...")
            time.sleep(10)


if __name__ == "__main__":
    startup()
