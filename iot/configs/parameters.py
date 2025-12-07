## parameters.py

## parameters
DEVICE_ID = "R1-001"                        # unique device identifier

## loops
COUNTER = 0                                 # loop counter
MAIN_LOOP = 0                               # main loop counter
MAX_LOOP = 100                              # max loops before restart

## Earthquake detection parameters
EARTHQUAKE_THRESHOLD = 1.25                 # G-force magnitude above this considered earthquake
DETECTION_STATE = "Normal"                  # current detection state

STABLE_TIME = 3                             # seconds required to say "safe"
SAMPLE_INTERVAL = 0.1                       # seconds between samples
NORMAL_INTERVAL = 1                         # seconds normal iterations
SLEEP_INTERVAL = 10                         # seconds sleep in ultra-low-power mode