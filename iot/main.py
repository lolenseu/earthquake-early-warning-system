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
        
## Minimal I2C LCD (PCF8574) driver
class I2cLcd:
    """Simple PCF8574-backed 16x2 LCD driver for MicroPython.
    Provides the subset used by this project: `clear()`, `move_to()`, `putstr()`.
    """
    # LCD commands
    LCD_CLR = 0x01
    LCD_HOME = 0x02
    LCD_ENTRY_MODE = 0x04
    LCD_DISPLAY_CTRL = 0x08
    LCD_CURSOR_SHIFT = 0x10
    LCD_FUNCTION = 0x20
    LCD_SET_CGRAM = 0x40
    LCD_SET_DDRAM = 0x80

    def __init__(self, i2c, addr, rows=2, cols=16, *, rs_mask=0x01, rw_mask=0x02, en_mask=0x04, bl_mask=0x08):
        self.i2c = i2c
        self.addr = addr
        self.rows = rows
        self.cols = cols
        self.backlight = True

        # control bit masks (PCF8574 -> LCD wiring may vary)
        self.RS = rs_mask
        self.RW = rw_mask
        self.EN = en_mask
        self.BL = bl_mask

        # init sequence
        time.sleep_ms(50)
        # send 0x03 3 times then 0x02 to set 4-bit mode
        self._write4(0x03 << 4)
        time.sleep_ms(5)
        self._write4(0x03 << 4)
        time.sleep_ms(1)
        self._write4(0x03 << 4)
        self._write4(0x02 << 4)

        # function set: 4-bit, 2 lines, 5x8 dots
        self._cmd(self.LCD_FUNCTION | 0x08)
        # display on, cursor off, blink off
        self._cmd(self.LCD_DISPLAY_CTRL | 0x04)
        # clear display
        self.clear()
        # entry mode set: increment
        self._cmd(self.LCD_ENTRY_MODE | 0x02)

    # low-level pcf write
    def _pcf_write(self, data):
        if self.backlight:
            data |= self.BL
        try:
            self.i2c.writeto(self.addr, bytes([data & 0xFF]))
        except Exception:
            pass

    def _pulse(self, data):
        self._pcf_write(data | self.EN)  # enable high
        time.sleep_us(1)
        self._pcf_write(data & ~self.EN)  # enable low
        time.sleep_us(50)

    def _write4(self, data):
        self._pcf_write(data)
        self._pulse(data)

    def _send(self, value, mode=0):
        high = value & 0xF0
        low = (value << 4) & 0xF0
        self._write4(high | mode)
        self._write4(low | mode)

    def _cmd(self, cmd):
        self._send(cmd, mode=0)

    def _write_char(self, char):
        self._send(ord(char), mode=self.RS)

    # Public API used by main.py
    def clear(self):
        self._cmd(self.LCD_CLR)
        time.sleep_ms(2)

    def move_to(self, col, row):
        row_offsets = [0x00, 0x40, 0x14, 0x54]
        if row >= self.rows:
            row = self.rows - 1
        addr = col + row_offsets[row]
        self._cmd(self.LCD_SET_DDRAM | addr)

    def putstr(self, string):
        for ch in string:
            self._write_char(ch)


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
    
    url = f"{API_URL}/post"
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
    
    url = f"{API_URL_STORAGE}/post_device_id"
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
def init_buzzer():
    """Initialize buzzer pin. Returns Pin or None."""
    try:
        pin_num = getattr(param, 'BUZZER_PIN', None)
        if pin_num is None:
            tprint(PRINTSTATUS.INFO, "No BUZZER_PIN configured; buzzer disabled")
            return None

        active_low = getattr(param, 'BUZZER_ACTIVE_LOW', False)
        use_pwm = getattr(param, 'BUZZER_USE_PWM', False)

        class Buzzer:
            def __init__(self, pin_num, active_low=False, use_pwm=False):
                self.pin_num = pin_num
                self.active_low = active_low
                self.use_pwm = use_pwm
                self._pin = machine.Pin(pin_num, machine.Pin.OUT)
                self._pwm = None
                # ensure off state
                if self.active_low:
                    self._pin.value(1)
                else:
                    self._pin.value(0)

            def on(self, freq=None, duty=None):
                if self.use_pwm and hasattr(machine, 'PWM'):
                    try:
                        if self._pwm is None:
                            self._pwm = machine.PWM(machine.Pin(self.pin_num))
                        if freq:
                            self._pwm.freq(freq)
                        if duty is not None and hasattr(self._pwm, 'duty'):
                            self._pwm.duty(duty)
                        elif duty is not None and hasattr(self._pwm, 'duty_u16'):
                            self._pwm.duty_u16(duty)
                    except Exception:
                        # fallback to digital on
                        if self.active_low:
                            self._pin.value(0)
                        else:
                            self._pin.value(1)
                else:
                    if self.active_low:
                        self._pin.value(0)
                    else:
                        self._pin.value(1)

            def off(self):
                if self._pwm is not None:
                    try:
                        self._pwm.deinit()
                    except Exception:
                        pass
                    self._pwm = None
                if self.active_low:
                    self._pin.value(1)
                else:
                    self._pin.value(0)

            def beep_once(self, duration_ms=200, freq=None, duty=None):
                try:
                    if self.use_pwm and hasattr(machine, 'PWM'):
                        f = freq or getattr(param, 'BUZZER_FREQ', 2000)
                        d = duty if duty is not None else getattr(param, 'BUZZER_DUTY', 512)
                        self.on(f, d)
                        time.sleep_ms(duration_ms)
                        self.off()
                    else:
                        # simple digital pulse
                        if self.active_low:
                            self._pin.value(0)
                            time.sleep_ms(duration_ms)
                            self._pin.value(1)
                        else:
                            self._pin.value(1)
                            time.sleep_ms(duration_ms)
                            self._pin.value(0)
                except Exception as e:
                    eprint(PRINTSTATUS.WARN, f"Buzzer beep failed: {e}")

        buz = Buzzer(pin_num, active_low=active_low, use_pwm=use_pwm)
        tprint(PRINTSTATUS.SUCCESS, f"Buzzer initialized on pin {pin_num} (pwm={use_pwm})")
        return buz

    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"Buzzer init failed: {e}")
        return None

def init_mpu6050(i2c=None):
    """Initialize and return MPU6050 instance."""
    
    tprint(PRINTSTATUS.INFO, "Initializing MPU6050...")
    
    try:
        if i2c is None:
            i2c = machine.SoftI2C(scl=machine.Pin(param.SLC_PINOUT), sda=machine.Pin(param.SDA_PINOUT), freq=param.I2C_FREQUENCY)

        devices = i2c.scan()
        tprint(PRINTSTATUS.INFO, f"MPU6050 init: I2C devices: {devices}")

        if 0x68 not in devices:
            eprint(PRINTSTATUS.ERROR, "MPU6050 not found at address 0x68")
            return None

        mpu = MPU6050(i2c)
        tprint(PRINTSTATUS.SUCCESS, "MPU6050 ready")
        return mpu
    
    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"MPU6050 init failed: {e}")
        return None
        
def init_lcd(i2c=None):
    """Initialize I2C LCD using PCF8574 backpack. Returns I2cLcd or None.
    Accepts optional shared `i2c` instance.
    """
    try:
        preferred = getattr(param, 'LCD_I2C_ADDR', None)
        cols = getattr(param, 'LCD_COLS', 16)
        rows = getattr(param, 'LCD_ROWS', 2)
        if i2c is None:
            i2c = machine.SoftI2C(scl=machine.Pin(param.SLC_PINOUT), sda=machine.Pin(param.SDA_PINOUT), freq=param.I2C_FREQUENCY)
        devices = i2c.scan()
        tprint(PRINTSTATUS.INFO, f"LCD init: I2C devices: {devices}")

        # candidate addresses to try
        candidates = []
        if preferred is not None:
            candidates.append(preferred)
        # common PCF8574 backpack addresses
        for a in (0x27, 0x3F, 0x3e):
            if a not in candidates:
                candidates.append(a)

        found = None
        for a in candidates:
            if a in devices:
                found = a
                break

        if found is None:
            eprint(PRINTSTATUS.WARN, f"LCD not found on I2C (tried: {candidates})")
            return None

        addr = found
        tprint(PRINTSTATUS.INFO, f"Using LCD I2C address 0x{addr:02X}")

        # try default mask mapping first; if it fails, return None
        lcd = I2cLcd(i2c, addr, rows, cols)
        # quick self-test write to confirm operation
        try:
            lcd.clear()
            lcd.move_to(0, 0)
            lcd.putstr("LCD OK")
        except Exception as e:
            eprint(PRINTSTATUS.WARN, f"LCD write test failed: {e}")
            return None

        tprint(PRINTSTATUS.SUCCESS, "LCD ready")
        return lcd

    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"LCD init failed: {e}")
        return None


## main function  
def main():
    tprint(PRINTSTATUS.INFO, "Initializing Hardware...")

    try:
        shared_i2c = machine.SoftI2C(scl=machine.Pin(param.SLC_PINOUT), sda=machine.Pin(param.SDA_PINOUT), freq=param.I2C_FREQUENCY)
        tprint(PRINTSTATUS.INFO, "I2C bus created for peripherals")
    except Exception as e:
        eprint(PRINTSTATUS.ERROR, f"I2C bus creation failed: {e}")
        return

    buzzer = init_buzzer()
    mpu = init_mpu6050(shared_i2c)
    lcd = init_lcd(shared_i2c)
    
    if buzzer:
        buzzer.beep_once(200)

    if mpu is None:
        tprint(PRINTSTATUS.ERROR, "MPU6050 initialization failed")
        return

    if lcd is None:
        tprint(PRINTSTATUS.WARN, "LCD not initialized — continuing without display")

    tprint(PRINTSTATUS.INFO, "Registering device...")
    if post_storage_data(storage_payload()):
        tprint(PRINTSTATUS.SUCCESS, "Registration successful")
        if lcd:
            try:
                lcd.move_to(0, 0)
                lcd.putstr("Registered")
                lcd.move_to(0, 1)
                lcd.putstr(param.DEVICE_ID[:16])
            except Exception:
                pass

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
                if buzzer:
                    try:
                        buzzer.off()
                        tprint(PRINTSTATUS.INFO, "Buzzer: stopped")
                    except Exception:
                        pass
                if lcd:
                    try:
                        lcd.clear()
                        lcd.move_to(0,0)
                        lcd.putstr("Mode: Normal")
                        lcd.move_to(0,1)
                        lcd.putstr("G: 0.000 g")
                    except Exception:
                        pass

            shake_detected = False

            for _ in range(param.REQUIRED_SHAKE_COUNT):
                data = detect_earthquake(mpu)
                if data:
                    shake_detected = True
                time.sleep(param.NORMAL_INTERVAL / param.REQUIRED_SHAKE_COUNT)

            if shake_detected:
                mode = MODE_EARTHQUAKE
                exit_deadline = None
                if buzzer:
                    try:
                            # start tone for passive buzzer or simple on for active
                            if getattr(param, 'BUZZER_USE_PWM', False):
                                buzzer.on(getattr(param, 'BUZZER_FREQ', 2000), getattr(param, 'BUZZER_DUTY', 512))
                            else:
                                buzzer.on()
                    except Exception:
                        pass
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
                if lcd:
                    try:
                        lcd.clear()
                        lcd.move_to(0,0)
                        lcd.putstr("Mode: Sleep")
                    except Exception:
                        pass
                
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
                if buzzer:
                    try:
                            if getattr(param, 'BUZZER_USE_PWM', False):
                                buzzer.on(getattr(param, 'BUZZER_FREQ', 2000), getattr(param, 'BUZZER_DUTY', 512))
                            else:
                                buzzer.on()
                    except Exception:
                        pass

                if lcd:
                    try:
                        lcd.clear()
                        lcd.move_to(0,0)
                        lcd.putstr("Earthquake!")
                    except Exception:
                        pass

            data = detect_earthquake(mpu)
            now = time.time()

            if data:
                exit_deadline = None
                post_data(payload(data))
                tprint(PRINTSTATUS.INFO, f"Magnitude: {data['g_force']:.3f} g")
                if lcd:
                    try:
                        lcd.move_to(0,1)
                        lcd.putstr(f"G:{data['g_force']:.3f} g")
                    except Exception:
                        pass
            else:
                if exit_deadline is None:
                    exit_deadline = now + param.STABLE_TIME
                elif now >= exit_deadline:
                    if buzzer:
                        try:
                                buzzer.off()
                        except Exception:
                            pass
                    mode = MODE_NORMAL
                    exit_deadline = None

            time.sleep(param.EARTHQUAKE_INTERVAL)
            