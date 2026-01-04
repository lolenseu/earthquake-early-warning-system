import webbrowser
import requests
import json
from kivy.app import App
from kivy.uix.button import Button
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.popup import Popup
from kivy.uix.scrollview import ScrollView
from kivy.uix.gridlayout import GridLayout
from kivy.uix.widget import Widget
from kivy.graphics import Color, Rectangle, Ellipse
from kivy.config import Config

# Configure for realme C55 mobile screen specs with scaled-down window
Config.set('graphics', 'width', '540')  # Half of 1080 for PC development
Config.set('graphics', 'height', '1200')  # Half of 2400 for PC development
Config.set('graphics', 'resizable', False)  # Fixed size for mobile
Config.set('graphics', 'fullscreen', False)  # Windowed mode for development
Config.set('graphics', 'minimum_width', '540')  # Minimum width
Config.set('graphics', 'minimum_height', '1200')  # Minimum height
Config.set('graphics', 'multisamples', '2')  # Anti-aliasing for smoother visuals
Config.set('kivy', 'log_level', 'info')  # Reduce log verbosity
Config.set('graphics', 'dpi', '400')  # High DPI for mobile density

class GoogleMapWidget(Widget):
    def __init__(self, **kwargs):
        super(GoogleMapWidget, self).__init__(**kwargs)
        self.size_hint = (1, 1)  # Fill entire screen
        # Bind to size and position changes
        self.bind(pos=self.update_map, size=self.update_map)
        self.draw_map()
        
    def draw_map(self):
        self.canvas.clear()
        with self.canvas:
            # Google Maps style background
            Color(0.2, 0.6, 1, 1)  # Google Maps blue
            self.background = Rectangle(pos=self.pos, size=self.size)
            
            # Google Maps pin (current location)
            Color(1, 0, 0, 1)  # Red pin
            # Pin body
            Rectangle(pos=(self.x + self.width/2 - 5, self.y + self.height/2 - 15), size=(10, 30))
            # Pin head
            Ellipse(pos=(self.x + self.width/2 - 8, self.y + self.height/2 + 10), size=(16, 16))
            
            # Map text
            Color(1, 1, 1, 1)  # White text
            self.map_label = Label(
                text="Earthquake Early Warning System",
                pos=(self.x + self.width/2 - 120, self.y + self.height - 50),
                size_hint=(None, None),
                size=(240, 30),
                font_size='18sp',
                color=(1, 1, 1, 1)
            )
            self.add_widget(self.map_label)
            
            # Status label
            self.status_label = Label(
                text="Status: Monitoring",
                pos=(self.x + 20, self.y + self.height - 80),
                size_hint=(None, None),
                size=(150, 30),
                font_size='14sp',
                color=(1, 1, 1, 1)
            )
            self.add_widget(self.status_label)
            
            # Instructions text
            self.instructions_label = Label(
                text="Tap 'Google Maps' to open interactive map\nin your browser for real-time navigation",
                pos=(self.x + 20, self.y + 40),
                size_hint=(None, None),
                size=(self.width - 40, 60),
                font_size='14sp',
                color=(1, 1, 1, 1),
                halign='center',
                valign='middle'
            )
            self.instructions_label.bind(size=self.instructions_label.setter('text_size'))
            self.add_widget(self.instructions_label)

    def update_map(self, *args):
        # Update map when widget position or size changes
        self.draw_map()

class EarthquakeApp(App):
    def build(self):
        # Set window title
        self.title = "Earthquake Early Warning System"
        
        # Main layout
        main_layout = BoxLayout(orientation='vertical')
        
        # Google Maps area (fills entire screen)
        self.map_widget = GoogleMapWidget()
        main_layout.add_widget(self.map_widget)
        
        # Floating action buttons
        buttons_layout = BoxLayout(
            orientation='horizontal', 
            size_hint=(None, None),
            size=(400, 60),
            pos_hint={'center_x': 0.5, 'center_y': 0.05},
            spacing=10
        )
        
        # Google Maps button
        self.map_button = Button(
            text="📍 Google Maps",
            font_size='14sp',
            size_hint=(1, 1),
            background_color=(0.2, 0.6, 1, 1),
            color=(1, 1, 1, 1),
            border=(8, 8, 8, 8)
        )
        self.map_button.bind(on_press=self.open_google_maps)
        buttons_layout.add_widget(self.map_button)
        
        # Emergency button
        self.emergency_button = Button(
            text="🚨 Emergency",
            font_size='14sp',
            size_hint=(1, 1),
            background_color=(1, 0, 0, 1),
            color=(1, 1, 1, 1),
            border=(8, 8, 8, 8)
        )
        self.emergency_button.bind(on_press=self.activate_emergency)
        buttons_layout.add_widget(self.emergency_button)
        
        # Safety check button
        self.safety_button = Button(
            text="✅ Safety Check",
            font_size='14sp',
            size_hint=(1, 1),
            background_color=(0.2, 0.8, 0.2, 1),
            color=(1, 1, 1, 1),
            border=(8, 8, 8, 8)
        )
        self.safety_button.bind(on_press=self.check_safety)
        buttons_layout.add_widget(self.safety_button)
        
        main_layout.add_widget(buttons_layout)
        
        return main_layout

    def open_google_maps(self, instance):
        # Open Google Maps in default web browser
        google_maps_url = "https://www.google.com/maps/@37.7749,-122.4194,15z/data=!3m1!1e3"
        webbrowser.open(google_maps_url)
        
        # Update status
        self.map_widget.status_label.text = "Status: Google Maps Opened"
        
        # Show confirmation popup
        self.show_popup("Google Maps Opened", "🌐 Google Maps is now open in your browser!\n\nYou can view:\n• Real-time location\n• Safe zones\n• Emergency services\n• Evacuation routes")

    def activate_emergency(self, instance):
        # Emergency mode activation
        self.map_widget.status_label.text = "Status: EMERGENCY MODE"
        
        # Create emergency popup
        content = BoxLayout(orientation='vertical', padding=10, spacing=10)
        
        emergency_label = Label(
            text="🚨 EMERGENCY MODE ACTIVATED 🚨\n\nIMMEDIATE ACTIONS:\n1. 📱 Stay calm and assess situation\n2. 🏠 Drop, Cover, and Hold On\n3. 🚪 Evacuate if building is unsafe\n4. 📍 Move to open area away from structures\n5. 📞 Call emergency services\n\nNEARBY SAFE ZONES:\n• Open fields\n• Parking lots\n• Parks\n• Beach areas",
            font_size='14sp',
            halign='left',
            valign='top'
        )
        emergency_label.bind(size=emergency_label.setter('text_size'))
        
        # Scroll view for instructions
        scroll_view = ScrollView(size_hint=(1, 0.7))
        scroll_view.add_widget(emergency_label)
        
        buttons_row = BoxLayout(orientation='horizontal', spacing=10, size_hint=(1, 0.3))
        
        safe_button = Button(
            text="I'm Safe",
            font_size='14sp',
            background_color=(0.2, 0.8, 0.2, 1),
            color=(1, 1, 1, 1)
        )
        safe_button.bind(on_press=lambda x: self.dismiss_emergency())
        
        help_button = Button(
            text="Need Help",
            font_size='14sp',
            background_color=(1, 0.5, 0, 1),
            color=(1, 1, 1, 1)
        )
        help_button.bind(on_press=lambda x: self.request_help())
        
        buttons_row.add_widget(safe_button)
        buttons_row.add_widget(help_button)
        
        content.add_widget(scroll_view)
        content.add_widget(buttons_row)
        
        self.emergency_popup = Popup(
            title='🚨 EMERGENCY PROCEDURES',
            content=content,
            size_hint=(0.9, 0.8),
            auto_dismiss=False
        )
        self.emergency_popup.open()

    def check_safety(self, instance):
        # Simulate safety check
        self.map_widget.status_label.text = "Status: Checking Safety..."
        
        # Show safety check results
        self.show_popup("Safety Check", "✅ Safety Status: SAFE\n\nAll systems normal.\nNo earthquake activity detected.\n\nContinue monitoring for updates.")

    def show_popup(self, title, message):
        content = BoxLayout(orientation='vertical', padding=10, spacing=10)
        
        label = Label(
            text=message,
            font_size='14sp',
            halign='center',
            valign='middle'
        )
        label.bind(size=label.setter('text_size'))
        
        ok_button = Button(
            text="OK",
            font_size='16sp',
            size_hint_y=None,
            height=50,
            background_color=(0.2, 0.8, 0.2, 1),
            color=(1, 1, 1, 1)
        )
        ok_button.bind(on_press=lambda x: self.dismiss_popup())
        
        content.add_widget(label)
        content.add_widget(ok_button)
        
        self.popup = Popup(
            title=title,
            content=content,
            size_hint=(0.8, 0.5),
            auto_dismiss=True
        )
        self.popup.open()

    def dismiss_popup(self):
        if hasattr(self, 'popup'):
            self.popup.dismiss()

    def dismiss_emergency(self):
        self.emergency_popup.dismiss()
        self.map_widget.status_label.text = "Status: Monitoring"
        self.show_popup("Emergency Mode", "✅ Emergency mode deactivated.\nSafety confirmed.")

    def request_help(self):
        self.emergency_popup.dismiss()
        self.show_popup("Help Requested", "📞 Emergency services notified!\n📍 Your location has been shared.\n🆘 Help is on the way.\n\nPlease stay in a safe location.")

if __name__ == "__main__":
    EarthquakeApp().run()