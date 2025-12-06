## parameters.py

## parameters
DEVICE_ID = "R1-001"                        # unique device identifier

## loops
COUNTER = 0
MAIN_LOOP = 0
MAX_LOOP = 100

## Earthquake detection parameters
EARTHQUAKE_THRESHOLD = 1.25                 # G-force magnitude above this considered earthquake

STABLE_TIME = 3                             # seconds required to say "safe"
SAMPLE_INTERVAL = 0.1                       # seconds between samples
NORMAL_INTERVAL = 1                         # seconds normal iterations
ULTRA_SLEEP_INTERVAL = 10                   # seconds sleep in ultra-low-power mode