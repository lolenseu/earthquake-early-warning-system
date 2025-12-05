## firmware boot.py

## imports

import machine
import network
import time
import os

import urequests as requests


import configs.network_config as net_config


## functions

def start_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(net_config.SSID, net_config.PASSWORD)
    while not wlan.isconnected():
        time.sleep(1)
    print("Connected to WiFi:", wlan.ifconfig())


def check_for_updates():
    try:
        response = requests.get(VERSION_URL)
        latest_version = response.text.strip()
        response.close()

        if not os.path.exists("version.txt"):
            current_version = "0.0.0"
        else:
            with open("version.txt", "r") as f:
                current_version = f.read().strip()

        if latest_version != current_version:
            print("New version available:", latest_version)
            response = requests.get(MAIN_URL)
            with open("main.py", "w") as f:
                f.write(response.text)
            response.close()

            with open("version.txt", "w") as f:
                f.write(latest_version)

            print("Updated to version:", latest_version)
        else:
            print("Already up to date:", current_version)
    except Exception as e:
        print("Error checking for updates:", e)
        

def startup():
    print("Starting up...")
    start_wifi()
    check_for_updates()
    print("Running main.py...")