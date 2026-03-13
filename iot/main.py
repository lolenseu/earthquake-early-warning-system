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
            devices = i2c.scan()
            if addr not in devices:
                raise OSError(f"MPU6050 not found at address 0x{addr:02X}")
            self.i2c.writeto_mem(self.addr, 0x6B, b'\x00')
            time.sleep(0.1)
        except Exception as e:
            eprint(PRINTSTATUS.ERROR, f"MPU6050 init failed: {e}")
            raise

    def read_raw(self, reg):
        try:
            high = self.i2c.readfrom_mem(self.addr, reg, 1)[0]
            low = self.i2c.readfrom_mem(self.addr, reg + 1, 1)[0]
            value = (high << 8) | low
            if value > 32767:
                value -= 65536
            return value
        except:
            return 0

    def read_accel(self):
        try:
            x_axis = self.read_raw(0x3B) / 16384.0
            y_axis = self.read_raw(0x3D) / 16384.0
            z_axis = self.read_raw(0x3F) / 16384.0
            return x_axis, y_axis, z_axis
        except:
            return 0.0, 0.0, 0.0


## LCD Driver
class I2cLcd:
    LCD_CLR = 0x01
    LCD_ENTRY_MODE = 0x04
    LCD_DISPLAY_CTRL = 0x08
    LCD_FUNCTION = 0x20
    LCD_SET_DDRAM = 0x80

    def __init__(self, i2c, addr, rows=2, cols=16, rs_mask=0x01, rw_mask=0x02, en_mask=0x04, bl_mask=0x08):
        self.i2c = i2c
        self.addr = addr
        self.rows = rows
        self.cols = cols
        self.backlight = True

        self.RS = rs_mask
        self.RW = rw_mask
        self.EN = en_mask
        self.BL = bl_mask

        time.sleep_ms(50)

        self._write4(0x03 << 4)
        time.sleep_ms(5)
        self._write4(0x03 << 4)
        time.sleep_ms(1)
        self._write4(0x03 << 4)
        self._write4(0x02 << 4)

        self._cmd(self.LCD_FUNCTION | 0x08)
        self._cmd(self.LCD_DISPLAY_CTRL | 0x04)
        self.clear()
        self._cmd(self.LCD_ENTRY_MODE | 0x02)

    def _pcf_write(self, data):
        if self.backlight:
            data |= self.BL
        try:
            self.i2c.writeto(self.addr, bytes([data & 0xFF]))
        except:
            pass

    def _pulse(self, data):
        self._pcf_write(data | self.EN)
        time.sleep_us(1)
        self._pcf_write(data & ~self.EN)
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
        self._send(cmd, 0)

    def _write_char(self, char):
        self._send(ord(char), self.RS)

    def clear(self):
        self._cmd(self.LCD_CLR)
        time.sleep_ms(2)

    def move_to(self, col, row):
        row_offsets = [0x00, 0x40]
        addr = col + row_offsets[row]
        self._cmd(self.LCD_SET_DDRAM | addr)

    def putstr(self, string):
        for ch in string:
            self._write_char(ch)


## buzzer
class Buzzer:
    def __init__(self, pin):
        self.pin = machine.Pin(pin, machine.Pin.OUT)
        self.off()

    def on(self):
        self.pin.value(1)

    def off(self):
        self.pin.value(0)


## helpers
def magnitude(x_axis, y_axis, z_axis):
    return (x_axis**2 + y_axis**2 + z_axis**2) ** 0.5


def detect_earthquake(mpu):
    try:
        x_axis, y_axis, z_axis = mpu.read_accel()
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
    except:
        return None


def payload(data=None):

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


def post_data(data):

    url = f"{API_URL}/post"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    try:
        payload_str = "&".join([f"{k}={v}" for k, v in data.items()])
        r = requests.post(url, data=payload_str, headers=headers)
        r.close()
        return True
    except:
        return False


def fetch_data():

    url = f"{API_URL}/eews/fetch"

    try:
        r = requests.get(url)
        r.close()
    except:
        pass


## init
def init_mpu6050(i2c):
    devices = i2c.scan()
    if 0x68 not in devices:
        return None
    return MPU6050(i2c)


def init_lcd(i2c):

    devices = i2c.scan()

    for addr in (0x27, 0x3F):
        if addr in devices:
            return I2cLcd(i2c, addr, 2, 16)

    return None


def init_buzzer():
    try:
        return Buzzer(param.BUZZER_PIN)
    except:
        return None


## main
def main():

    shared_i2c = machine.SoftI2C(
        scl=machine.Pin(param.SLC_PINOUT),
        sda=machine.Pin(param.SDA_PINOUT),
        freq=param.I2C_FREQUENCY
    )

    mpu = init_mpu6050(shared_i2c)
    lcd = init_lcd(shared_i2c)
    buzzer = init_buzzer()

    if mpu is None:
        return

    MODE_NORMAL = 0
    MODE_EARTHQUAKE = 1

    mode = MODE_NORMAL
    exit_deadline = None

    normal_loop_counter = 0

    while True:

        if mode == MODE_NORMAL:

            if buzzer:
                buzzer.off()

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
                    buzzer.on()

                if lcd:
                    lcd.clear()
                    lcd.move_to(0,0)
                    lcd.putstr("Earthquake!")

                continue


            normal_loop_counter += 1

            if normal_loop_counter >= 5:
                post_data(payload(None))
                #fetch_data()
                normal_loop_counter = 0


            if lcd:
                lcd.move_to(0,0)
                lcd.putstr("Mode: Normal ")
                lcd.move_to(0,1)
                lcd.putstr("G: 0.000 g ")

            time.sleep(param.NORMAL_INTERVAL)
            continue


        if mode == MODE_EARTHQUAKE:

            data = detect_earthquake(mpu)
            now = time.time()

            if data:

                exit_deadline = None
                post_data(payload(data))

                if lcd:
                    lcd.move_to(0,1)
                    lcd.putstr(f"G:{data['g_force']:.3f} g")

            else:

                if exit_deadline is None:
                    exit_deadline = now + param.STABLE_TIME

                elif now >= exit_deadline:

                    if buzzer:
                        buzzer.off()

                    mode = MODE_NORMAL
                    exit_deadline = None

            time.sleep(param.EARTHQUAKE_INTERVAL)
