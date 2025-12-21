# EEWS — Earthquake Early Warning System

This project is an Earthquake Early Warning System (EEWS) that aims to provide **quick alerts when earthquake**, using an IoT device as the first line of detection.  
Data is transmitted to the backend instantly and displayed in the dashboard and mobile app in **real-time magnitude readings**, enabling rapid awareness for users.

---

# Project Vision

The goal of EEWS is to detect P-Wave ground shaking at the **earliest moment** directly at the edge (IoT device), then immediately send alerts to the cloud for distribution.

The system is designed for:

- **Fast reaction time** with minimal processing delays  
- **Accurate magnitude detection** from the device  
- **Real-time streaming of earthquake events** to the dashboard and mobile app  
- **Low-latency communication** using optimized API architecture  

This project focuses on simplicity, reliability, and speed — ensuring users receive alerts as early as possible.

---

# Architecture Overview

IoT Device  
→ API ingest endpoint  
→ Pair-Pipeline backend (validation, transform, event dispatch)  
→ Database  
→ Realtime dashboard + mobile app

Backend structure reference:  
https://github.com/lolenseu/pair-pipeline

---

# Components

## 1. IoT Device (Edge Sensor Node)

**Hardware:**  
- ESP32  
- MPU6050 accelerometer  
- Optional: buzzer, LED indicator, small display

**Responsibilities:**  
- Measure acceleration (ax, ay, az)  
- Compute **total magnitude (total_g)**  
- Detect earthquake-level motion  
- Immediately POST data to the API  
- Emit optional local alerts (buzzer / LED)  
- Maintain stable operation with minimal latency  

---

## 2. API & Pair-Pipeline Backend

The backend handles:

- Receiving sensor data  
- Validating and processing magnitude readings  
- Storing events  
- Broadcasting earthquake alerts to the dashboard + mobile app  
- Ensuring efficient, low-latency event flow  

Repository (pair pipeline):  
https://github.com/lolenseu/pair-pipeline

---

## 3. Web Dashboard

Displays real-time earthquake detection data:

- Live stream of magnitude readings  
- Device status (online/offline)  
- Earthquake event logs  
- Alert history  

Dashboard goal: **instant visibility of shaking as it happens**.

---

## 4. Mobile App

Receives:

- Live magnitude updates  
- Instant earthquake alerts  
- Event history and recent detections  

Designed to be lightweight and responsive.

---

# Example API Payload

```
POST /pipeline/eews/devices>

{
  "device_id": "R1-001",
  "auth_seed": "12345678",
  "ax": 0.02,
  "ay": -0.01,
  "az": 1.03,
  "total_g": 1.31,
  "timestamp": 1700000000
}
```

```
GET /pipeline/eews/warning

{
  "type": "earthquake_alert",
  "device_id": "R1-001",
  "timestamp": 1700000003,
  "total_g": 2.59,
  "severity": "high"
}
```

# Security Notes

- Use HTTPS for all API traffic  
- Protect device API keys  
- Validate all incoming data  
- Avoid exposing exact device GPS unless necessary  

---

# License

This project is licensed under:

**GPL-3.0**

