import { SessionInputAnalysisType } from "@workspace/api-client-react";

export interface ArduinoHardwareInterface {
  // LED status indicator: "off" | "searching" | "active" | "warning" | "success"
  setLedStatus(status: "off" | "searching" | "active" | "warning" | "success"): void;

  // Buzzer notifications: trigger chime/alarm pattern
  triggerBuzzer(pattern: "short_beep" | "double_beep" | "success_chime" | "warning_alarm"): void;

  // Rotary knob input for switching sports: subscribe callback
  onSportSwitch(callback: (sport: "cricket" | "basketball" | "yoga") => void): () => void;
}

class MockArduinoHardware implements ArduinoHardwareInterface {
  private listeners: ((sport: "cricket" | "basketball" | "yoga") => void)[] = [];

  setLedStatus(status: "off" | "searching" | "active" | "warning" | "success"): void {
    console.log(`%c[Arduino Hardware LED]: Status -> ${status.toUpperCase()}`, "color: #ff8800; font-weight: bold; font-family: monospace;");
    // Web Serial / Serial connection placeholders can be wired here
  }

  triggerBuzzer(pattern: "short_beep" | "double_beep" | "success_chime" | "warning_alarm"): void {
    console.log(`%c[Arduino Hardware Buzzer]: Play sound -> ${pattern.toUpperCase()}`, "color: #ef4444; font-weight: bold; font-family: monospace;");
    // Trigger audio beeps in browser for interactive feedback
    try {
      if (typeof window !== "undefined" && (window as any).AudioContext) {
        const audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (pattern === "short_beep") {
          oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
          gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.1);
        } else if (pattern === "double_beep") {
          oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
          gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.1);
          
          setTimeout(() => {
            const audioCtx2 = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
            const osc2 = audioCtx2.createOscillator();
            const gain2 = audioCtx2.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx2.destination);
            osc2.frequency.setValueAtTime(880, audioCtx2.currentTime);
            gain2.gain.setValueAtTime(0.08, audioCtx2.currentTime);
            osc2.start();
            osc2.stop(audioCtx2.currentTime + 0.1);
          }, 150);
        } else if (pattern === "success_chime") {
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
          oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
          oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
          gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.35);
        } else if (pattern === "warning_alarm") {
          oscillator.type = "sawtooth";
          oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
          gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.2);
        }
      }
    } catch (e) {
      console.warn("AudioContext block by browser context", e);
    }
  }

  onSportSwitch(callback: (sport: "cricket" | "basketball" | "yoga") => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  simulateRotarySwitch(sport: "cricket" | "basketball" | "yoga"): void {
    console.log(`%c[Arduino Hardware Rotary Knob]: Simulating knob turn to -> ${sport.toUpperCase()}`, "color: #22c55e; font-weight: bold; font-family: monospace;");
    this.listeners.forEach((l) => l(sport));
  }
}

export const arduinoHardware = new MockArduinoHardware();

// Bind to window for console demo testing
if (typeof window !== "undefined") {
  (window as any).arduinoHardware = arduinoHardware;
}
