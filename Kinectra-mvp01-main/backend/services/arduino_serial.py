import serial
import time
import threading
from utils.config import config

class ArduinoSerialController:
    def __init__(self):
        self.serial_port = None
        self.lock = threading.Lock()
        self.enabled = config.SERIAL_ENABLED
        
        if self.enabled:
            self._connect()
        else:
            print("Arduino serial communication is disabled in config.")

    def _connect(self):
        """Attempts to open the serial port to the Arduino."""
        try:
            print(f"Connecting to Arduino on serial port {config.SERIAL_PORT} at {config.SERIAL_BAUD} baud...")
            self.serial_port = serial.Serial(
                port=config.SERIAL_PORT,
                baudrate=config.SERIAL_BAUD,
                timeout=1.0,
                write_timeout=1.0
            )
            # Give Arduino some time to reset after opening port
            time.sleep(2)
            print("Successfully connected to Arduino!")
        except Exception as e:
            print(f"WARNING: Could not connect to Arduino on {config.SERIAL_PORT}: {e}")
            print("Arduino serial commands will be logged but not physically transmitted (Mock Mode).")
            self.serial_port = None

    def send_command(self, score: float):
        """
        Sends form status command to Arduino based on the technique score:
        - 'G' (Good) for score > 80
        - 'W' (Warning) for score 60-80
        - 'D' (Danger) for score < 60
        """
        if score > 80:
            command = 'G'
        elif score >= 60:
            command = 'W'
        else:
            command = 'D'

        if not self.enabled:
            return

        with self.lock:
            if self.serial_port and self.serial_port.is_open:
                try:
                    self.serial_port.write(command.encode('utf-8'))
                    self.serial_port.flush()
                    # print(f"Transmitted command '{command}' to Arduino (score: {score})")
                except Exception as e:
                    print(f"Error writing to Arduino serial port: {e}. Attempting reconnect...")
                    self.serial_port = None
            else:
                # Log command in Mock Mode
                print(f"[Arduino MOCK] Score: {score:.1f} => Transmitted command: '{command}'")
                # Try to reconnect occasionally in the background
                if self.serial_port is None:
                    # Non-blocking reconnect attempt check
                    pass

    def close(self):
        """Closes the serial connection on shutdown."""
        with self.lock:
            if self.serial_port and self.serial_port.is_open:
                try:
                    self.serial_port.close()
                    print("Closed Arduino serial connection.")
                except Exception as e:
                    print(f"Error closing Arduino serial port: {e}")
                finally:
                    self.serial_port = None
