## parameters.py

## pinouts
SLC_PINOUT = 22                             # slc pin
SDA_PINOUT = 21                             # sda pin

## mpu frequency
I2C_MPU_FREQUENCY = 400000                  # I2C mpu frequency


## identification
DEVICE_ID = "ver1-r1-001"                   # unique device identifier *version - region - unit
AUTH_SEED = "12345678"                      # authentication seed

## location
LATITUDE = 14.5995                          # device latitude
LONGITUDE = 120.9842                        # device longitude

## payloads
PAYLOAD = None                              # data to sent
REQUEST_DATA = None                         # received data

## payload_data
SEND_AUTH_SEED = False                      # send auth seed
SEND_LOCATION = False                       # send location
SEND_AXIS = False                           # send axis
SEND_GFORCE = True                          # send gforce
SEND_TIMESTAMP = False                      # send timestamp

## loops
COUNTER = 0                                 # loop counter
MAIN_LOOP = 0                               # main loop counter
MAX_LOOP = 100                              # max loops before restart


## earthquake detection parameters
EARTHQUAKE_THRESHOLD = 1.35                 # G-force magnitude above this considered earthquake
SMOOTH_READ_SAMPLING = 1                    # reading samples
REQUIRED_SHAKE_COUNT = 1                    # earthquake samples to triger

STABLE_TIME = 3                             # seconds required to say "safe"
SAMPLE_INTERVAL = 0.1                       # seconds between samples
NORMAL_INTERVAL = 1                         # seconds normal iterations
SLEEP_INTERVAL = 10                         # seconds sleep in ultra-low-power mode