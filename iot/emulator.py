import tkinter as tk
from tkinter import ttk
import threading
import time
import random
import requests

API_URL_STORAGE = "https://lolenseu.pythonanywhere.com/pipeline"
API_URL = "https://lolenseu.pythonanywhere.com/pipeline"

DEVICES = [
    {"id": "demo-r0-001", "auth_seed": "12345678", "latitude": 14.5995, "longitude": 120.9842},
    {"id": "demo-r0-002", "auth_seed": "87654321", "latitude": 14.6001, "longitude": 120.9850},
    {"id": "demo-r0-003", "auth_seed": "11223344", "latitude": 14.5989, "longitude": 120.9835},
    {"id": "demo-r0-004", "auth_seed": "44332211", "latitude": 14.6010, "longitude": 120.9860},
    {"id": "demo-r0-005", "auth_seed": "55667788", "latitude": 14.5975, "longitude": 120.9820},
    {"id": "demo-r0-006", "auth_seed": "99887766", "latitude": 14.6025, "longitude": 120.9875},
    {"id": "demo-r0-007", "auth_seed": "13579246", "latitude": 14.5960, "longitude": 120.9810},
    {"id": "demo-r0-008", "auth_seed": "24681357", "latitude": 14.6040, "longitude": 120.9890},
    {"id": "demo-r0-009", "auth_seed": "11112222", "latitude": 14.5945, "longitude": 120.9800},
    {"id": "demo-r0-010", "auth_seed": "33334444", "latitude": 14.6055, "longitude": 120.9905},
]

BASELINE_NOISE = 0.05
SAMPLE_INTERVAL = 1.0

class DeviceSimulator:
    def __init__(self, device_config):
        self.device_config = device_config
        self.device_id = device_config["id"]
        self.online = False
        self.g_force = 0.0
        self.active = False
        self.thread = None
        self.stop_event = threading.Event()
        self.send_count = 0

    def magnitude(self, x, y, z):
        return (x**2 + y**2 + z**2) ** 0.5

    def generate_acceleration_data(self):
        x = random.uniform(-BASELINE_NOISE, BASELINE_NOISE)
        y = random.uniform(-BASELINE_NOISE, BASELINE_NOISE)
        z = 1.0 + random.uniform(-BASELINE_NOISE, BASELINE_NOISE)
        current_mag = self.magnitude(x, y, z)
        if current_mag > 0 and self.g_force > 0:
            scale = self.g_force / current_mag
            x *= scale
            y *= scale
            z *= scale
        return {"x_axis": round(x,3),"y_axis": round(y,3),"z_axis": round(z,3),"g_force": round(self.magnitude(x,y,z),3)}

    def build_payload(self, data):
        return {
            "device_id": self.device_config["id"],
            "auth_seed": self.device_config["auth_seed"],
            "latitude": self.device_config["latitude"],
            "longitude": self.device_config["longitude"],
            "x_axis": data["x_axis"],
            "y_axis": data["y_axis"],
            "z_axis": data["z_axis"],
            "g_force": data["g_force"],
            "device_timestamp": time.time()
        }

    def post_data(self, data):
        url = f"{API_URL}/eews/post"
        try:
            response = requests.post(url, json=data, headers={"Content-Type":"application/json","Accept":"application/json"}, timeout=5)
            if response.status_code == 200:
                return True
            else:
                print(f"[{self.device_id}] Post failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"[{self.device_id}] Post error: {e}")
            return False

    def register_device(self):
        url = f"{API_URL_STORAGE}/eews/post_device_id"
        try:
            payload = {
                "device_id": self.device_config["id"],
                "auth_seed": self.device_config["auth_seed"],
                "latitude": self.device_config["latitude"],
                "longitude": self.device_config["longitude"],
                "device_timestamp": time.time()
            }
            response = requests.post(url, json=payload, headers={"Content-Type":"application/json","Accept":"application/json"}, timeout=5)
            if response.status_code == 200:
                print(f"[{self.device_id}] Registered successfully")
                return True
            else:
                print(f"[{self.device_id}] Registration failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"[{self.device_id}] Registration error: {e}")
            return False

    def simulation_loop(self):
        print(f"[{self.device_id}] Starting simulation")
        while not self.stop_event.is_set():
            if self.online and self.g_force > 0:
                data = self.generate_acceleration_data()
                payload = self.build_payload(data)
                if self.post_data(payload):
                    self.send_count += 1
                    print(f"[{self.device_id}] G: {data['g_force']:.3f}g - Sent OK (#{self.send_count})")
                else:
                    print(f"[{self.device_id}] Failed to send")
            time.sleep(SAMPLE_INTERVAL)
        print(f"[{self.device_id}] Stopping simulation")

    def start(self):
        if not self.online:
            self.online = True
        if self.g_force == 0:
            self.g_force = 1.0
        if self.thread is None or not self.thread.is_alive():
            self.stop_event.clear()
            self.thread = threading.Thread(target=self.simulation_loop)
            self.thread.daemon = True
            self.thread.start()
            self.active = True
            print(f"Started simulation for {self.device_id}")

    def stop(self):
        self.online = False
        self.g_force = 0.0
        self.active = False
        self.send_count = 0
        if self.thread and self.thread.is_alive():
            self.stop_event.set()
            print(f"Stopped simulation for {self.device_id}")

    def set_gforce(self, g_force):
        self.g_force = round(float(g_force),1)
        if self.g_force > 0 and self.online:
            self.start()
        elif self.g_force == 0:
            self.stop()

    def toggle_online(self):
        if self.online:
            self.stop()
        else:
            self.online = True
            if self.g_force > 0:
                self.start()

class EarthquakeEmulator:
    def __init__(self, root):
        self.root = root
        self.root.title("Earthquake Emulator")
        self.root.geometry("1000x700")
        self.root.configure(bg='#1a1a1a')
        self.simulators = {device["id"]:DeviceSimulator(device) for device in DEVICES}
        self.create_widgets()
        self.update_stats()

    def create_widgets(self):
        header_frame = tk.Frame(self.root, bg='#2a2a2a', height=80)
        header_frame.pack(fill='x', padx=10, pady=10)
        title_label = tk.Label(header_frame, text="Earthquake Emulator", font=('Arial', 20, 'bold'), fg='white', bg='#2a2a2a')
        title_label.pack(side='left', padx=20, pady=20)
        control_frame = tk.Frame(header_frame, bg='#2a2a2a')
        control_frame.pack(side='right', padx=20, pady=20)
        self.toggle_all_btn = tk.Button(control_frame, text="Start All", command=self.toggle_all_devices, font=('Arial', 12), bg='#4CAF50', fg='white', width=12, height=2)
        self.toggle_all_btn.pack(side='left', padx=5)
        self.earthquake_btn = tk.Button(control_frame, text="Start Earthquake", command=self.start_earthquake, font=('Arial', 12), bg='#FF9800', fg='white', width=15, height=2)
        self.earthquake_btn.pack(side='left', padx=5)
        self.stop_all_btn = tk.Button(control_frame, text="Stop All", command=self.stop_all_devices, font=('Arial', 12), bg='#F44336', fg='white', width=12, height=2)
        self.stop_all_btn.pack(side='left', padx=5)
        self.stats_frame = tk.Frame(self.root, bg='#2a2a2a')
        self.stats_frame.pack(fill='x', padx=10, pady=5)
        self.total_label = tk.Label(self.stats_frame, text="Total: 10", font=('Arial', 12), fg='white', bg='#2a2a2a')
        self.total_label.pack(side='left', padx=20, pady=10)
        self.online_label = tk.Label(self.stats_frame, text="Online: 0", font=('Arial', 12), fg='white', bg='#2a2a2a')
        self.online_label.pack(side='left', padx=20, pady=10)
        self.active_label = tk.Label(self.stats_frame, text="Active: 0", font=('Arial', 12), fg='white', bg='#2a2a2a')
        self.active_label.pack(side='left', padx=20, pady=10)
        self.devices_frame = tk.Frame(self.root, bg='#1a1a1a')
        self.devices_frame.pack(fill='both', expand=True, padx=10, pady=10)
        self.device_widgets = {}
        row=0; col=0
        for device_id, simulator in self.simulators.items():
            device_frame = tk.Frame(self.devices_frame, bg='#2a2a2a', relief='raised', bd=2)
            device_frame.grid(row=row, column=col, padx=10, pady=10, sticky='nsew')
            id_label = tk.Label(device_frame, text=device_id, font=('Arial',14,'bold'), fg='white', bg='#2a2a2a')
            id_label.pack(pady=10)
            status_btn = tk.Button(device_frame, text="Offline", command=lambda d=device_id: self.toggle_device(d), font=('Arial',10), bg='#666666', fg='white', width=10, height=2)
            status_btn.pack(pady=5)
            gforce_label = tk.Label(device_frame, text="G-Force: 0.0", font=('Arial',10), fg='white', bg='#2a2a2a')
            gforce_label.pack(pady=5)
            gforce_slider = ttk.Scale(device_frame, from_=0.0, to=10.0, orient='horizontal', length=200, command=lambda value,d=device_id:self.update_gforce(d,value))
            gforce_slider.set(0.0)
            gforce_slider.pack(pady=5)
            gforce_value = tk.Label(device_frame, text="0.0", font=('Arial',12,'bold'), fg='#4CAF50', bg='#2a2a2a')
            gforce_value.pack(pady=5)
            count_label = tk.Label(device_frame, text="Sent: 0", font=('Arial',10), fg='white', bg='#2a2a2a')
            count_label.pack(pady=5)
            self.device_widgets[device_id] = {'frame':device_frame,'status_btn':status_btn,'gforce_label':gforce_label,'gforce_slider':gforce_slider,'gforce_value':gforce_value,'count_label':count_label}
            col+=1
            if col>=5: col=0; row+=1
        for i in range(2):
            self.devices_frame.grid_rowconfigure(i, weight=1)
        for i in range(5):
            self.devices_frame.grid_columnconfigure(i, weight=1)

    def update_stats(self):
        online_count=sum(1 for s in self.simulators.values() if s.online)
        active_count=sum(1 for s in self.simulators.values() if s.active)
        self.online_label.config(text=f"Online: {online_count}")
        self.active_label.config(text=f"Active: {active_count}")
        for device_id,simulator in self.simulators.items():
            widgets=self.device_widgets[device_id]
            widgets['status_btn'].config(text="Online" if simulator.online else "Offline", bg='#4CAF50' if simulator.online else '#666666')
            widgets['gforce_label'].config(text=f"G-Force: {simulator.g_force}")
            widgets['gforce_value'].config(text=f"{simulator.g_force:.1f}")
            widgets['count_label'].config(text=f"Sent: {simulator.send_count}")
        self.root.after(1000, self.update_stats)

    def toggle_device(self, device_id):
        self.simulators[device_id].toggle_online()

    def update_gforce(self, device_id, value):
        g_force=round(float(value),1)
        self.simulators[device_id].set_gforce(g_force)

    def register_all_devices(self):
        for simulator in self.simulators.values():
            simulator.register_device()

    def toggle_all_devices(self):
        online_count=sum(1 for s in self.simulators.values() if s.online)
        if online_count==0:
            self.register_all_devices()
            for simulator in self.simulators.values():
                if simulator.g_force==0:
                    simulator.g_force=1.0
                simulator.start()
            self.toggle_all_btn.config(text="Stop All", bg='#F44336')
        else:
            for simulator in self.simulators.values():
                simulator.stop()
            self.toggle_all_btn.config(text="Start All", bg='#4CAF50')

    def start_earthquake(self):
        earthquake_active=any(s.active and s.g_force>1.0 for s in self.simulators.values())
        if not earthquake_active:
            for simulator in self.simulators.values():
                if simulator.online:
                    simulator.set_gforce(round(random.uniform(1.5,5.0),1))
            self.earthquake_btn.config(text="Stop Earthquake", bg='#F44336')
        else:
            for simulator in self.simulators.values():
                if simulator.online and simulator.g_force>1.0:
                    simulator.set_gforce(1.0)
            self.earthquake_btn.config(text="Start Earthquake", bg='#FF9800')

    def stop_all_devices(self):
        for simulator in self.simulators.values():
            simulator.stop()
        self.toggle_all_btn.config(text="Start All", bg='#4CAF50')
        self.earthquake_btn.config(text="Start Earthquake", bg='#FF9800')

if __name__=='__main__':
    root=tk.Tk()
    app=EarthquakeEmulator(root)
    root.mainloop()
