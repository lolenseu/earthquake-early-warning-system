## parameters.py

## parameters
DEVICE_ID = "R1-001"                        # unique device identifier
AUTH_SEED = "12345678"                      # authentication seed

# payloads
PAYLOAD = None                              # data to sent
REQUEST_DATA = None                         # received data

## loops
COUNTER = 0                                 # loop counter
MAIN_LOOP = 0                               # main loop counter
MAX_LOOP = 100                              # max loops before restart

## pinouts
SLC_PINOUT = 22                             # slc pin
SDA_PINOUT = 21                             # sda pin

## mpu frequency
I2C_MPU_FREQUENCY = 400000                  # I2C mpu frequency

## earthquake detection parameters
EARTHQUAKE_THRESHOLD = 1.35                 # G-force magnitude above this considered earthquake
SMOOTH_READ_SAMPLING = 1                    # reading samples
REQUIRED_SHAKE_COUNT = 1                    # earthquake samples to triger

STABLE_TIME = 3                             # seconds required to say "safe"
SAMPLE_INTERVAL = 0.1                       # seconds between samples
NORMAL_INTERVAL = 1                         # seconds normal iterations
SLEEP_INTERVAL = 10                         # seconds sleep in ultra-low-power mode