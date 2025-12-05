import requests

from iot.configs.config import VERSION_URL

try:
    response = requests.get(VERSION_URL)
    print("Response status code:", response.status_code)
    response.close()
    
    if response.status_code == 200:
        response_text = response.text.strip()
        
        if response_text:
            response_status = response_text[0:4]
            response_version = response_text[7:]
            print("Response status:", response_status)
            print("Response version:", response_version)
    
        print("Successfully fetched version info")
         
    else:
        print("Failed to fetch version info")
        
    
        
except Exception as e:
    print(f"Error: {e}")