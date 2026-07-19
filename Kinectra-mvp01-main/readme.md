# KINETRA — Multi-Device Edge AI Sports Intelligence Platform

Built for the Snapdragon Multiverse Hackathon, Noida 2026.

---

### The Problem We Are Solving

Elite biomechanics coaching is traditionally locked behind expensive laboratories and specialized high-cost equipment. At the grassroots level, young athletes and players practice sports without access to real-time posture analysis. This leads to inefficient movement patterns, poor sports form, and a significantly higher risk of physical injuries. 

We wanted to change this by democratizing access to elite biomechanics coaching, putting high-quality real-time form feedback directly in the hands of everyday players and coaches at the grassroots level.

---

### Our Solution

**Kinetra** is a real-time, multi-device Edge AI sports intelligence platform. It runs a biomechanical computer vision model that orchestrates distributed AI workflows across local devices to keep processing local, fast, and latency-free. 

By running pose estimation and biomechanics calculations directly at the edge, Kinetra analyzes athletic movements (like cricket bowling and batting) as they happen. It then triggers physical, instantaneous sensory feedback (lights, buzzers, and haptics) to guide the player's form without requiring them to look at a screen.

---

### The Hardware & How It Works

Kinetra divides its workload across edge hardware:

1. **📱 Edge Capture & Landmark Detection (OnePlus 15 Mobile)**
   The OnePlus 15 acts as the edge capture device. It records the athlete’s movement, extracts the 33 landmark body points to evaluate their form, and streams the body coordinate metadata directly to the local host PC via WebSockets.

2. **💻 Deep Inference & Analytics Engine (Surface Laptop 7 with Snapdragon X Elite)**
   The laptop hosts our core backend. It processes the incoming stream, handles inference, runs biomechanical joint-angle calculations (elbow extension, knee bend, spine tilt, shoulder alignment, and balance stability), and quantizes pose data to calculate a real-time performance score (0-100).

3. **🔌 Instant Sensory Feedback (Arduino UNO Q)**
   Connected to the PC via USB serial, the Arduino UNO Q receives instant state commands based on the computed form score. It fires physical indicators—color-coded LEDs, custom buzzer frequencies, and haptic vibration motors—to immediately notify the athlete if their form is correct, sub-optimal, or hazardous.

4. **☁️ Longitudinal Tracking (Qualcomm Cloud AI 100)**
   Session summaries and historical trends are uploaded to the cloud for longitudinal performance tracking and analytics dashboards.

---

### Team
- **Sharad** — Architecture & Presentation  
- **Monika** — Software & AI Development  
- **Harsh** — Hardware & Arduino Integration  

---

### Project Structure

Here is where the core parts of the system live:
* [main.py](file:///c:/Users/ggaur/Downloads/Kinectra-mvp01-main%20%281%29/Kinectra-mvp01-main/backend/main.py) — The FastAPI backend entry point.
* [pose_detector.py](file:///c:/Users/ggaur/Downloads/Kinectra-mvp01-main%20%281%29/Kinectra-mvp01-main/backend/services/pose_detector.py) — Manages ONNX Runtime sessions, YOLOv8 pose models, and QNN NPU execution provider settings.
* [angle_calculator.py](file:///c:/Users/ggaur/Downloads/Kinectra-mvp01-main%20%281%29/Kinectra-mvp01-main/backend/services/angle_calculator.py) — Handles all the biomechanics math (calculating angles between joint vectors).
* [arduino_serial.py](file:///c:/Users/ggaur/Downloads/Kinectra-mvp01-main%20%281%29/Kinectra-mvp01-main/backend/services/arduino_serial.py) — Manages the USB connection and control codes sent to the Arduino.
* [session_manager.py](file:///c:/Users/ggaur/Downloads/Kinectra-mvp01-main%20%281%29/Kinectra-mvp01-main/backend/services/session_manager.py) — Aggregates and stores session summaries.
* [analysis.py](file:///c:/Users/ggaur/Downloads/Kinectra-mvp01-main%20%281%29/Kinectra-mvp01-main/backend/routes/analysis.py) — WebSocket handler that accepts the base64 frame/metadata stream.
* [pages/](file:///c:/Users/ggaur/Downloads/Kinectra-mvp01-main%20%281%29/Kinectra-mvp01-main/frontend/src/pages/) — The React UI pages (dashboard, sessions, and live analysis).
* [use-kinetra-analysis.ts](file:///c:/Users/ggaur/Downloads/Kinectra-mvp01-main%20%281%29/Kinectra-mvp01-main/frontend/src/hooks/use-kinetra-analysis.ts) — The frontend WebSocket coordinator.

---

### Setup & Execution

#### Option A: Full Multi-Device Mode (Recommended / Snapdragon Hackathon Setup)

This mode runs inference on the Snapdragon NPU and coordinates with all edge hardware.

1. **Flash the Arduino:**
   * Open `backend/arduino/kinetra_arduino.ino` in the Arduino IDE.
   * Flash the code onto your **Arduino UNO Q** and connect it to your PC via USB.

2. **Run the PC Backend:**
   * Navigate to the backend directory, install the dependencies, and start the server:
     ```bash
     cd backend
     pip install -r requirements.txt
     python main.py
     ```
   * The server runs on port `8000`. It will auto-detect the connected Arduino and prepare the YOLOv8-pose model for `onnxruntime-qnn` on the NPU.

3. **Start the Frontend Web App:**
   * Go to the project root, install dependencies, and start the development server:
     ```bash
     pnpm install
     pnpm --filter @workspace/kinetra run dev
     ```

4. **Connect the Capture Phone:**
   * Open the web browser on your **OnePlus 15** (or secondary capture device) and go to `http://<YOUR_PC_IP>:5173`.
   * Enable camera access. The device will capture form, resolve the 33 body landmarks, and start streaming metrics to the PC via WebSockets.

---

#### Option B: Browser-Only Fallback Mode (No Hardware Required)

If you don't have the external phone, NPU-capable laptop, or Arduino, you can run a local browser emulation mode utilizing WASM-compiled MediaPipe.

1. **Install and Run:**
   * Ensure a Postgres database is available and set your `DATABASE_URL` environment variable.
   * Run the local API server and frontend:
     ```bash
     pnpm install
     pnpm --filter @workspace/api-server run dev
     pnpm --filter @workspace/kinetra run dev
     ```
   * Open `http://localhost:5173` on your PC, select local mode, and use your PC webcam to test the interface.

---

### Biomechanical Metrics & Scoring

Kinetra calculates technique scores based on joint angles computed from keypoints:
* **Elbow Angle**: Detects throws or illegal arm extensions (e.g. 15-degree limit in cricket bowling).
* **Knee Angle**: Ensures optimal front knee bending during delivery stride.
* **Spine Tilt**: Measures lateral lean and posture stability.
* **Shoulder Alignment**: Tracks rotation symmetry throughout the action.

The overall form score is weighted as:
`Overall Score = Posture (30%) + Alignment (25%) + Stability (25%) + Efficiency (20%)`

---

### License

MIT License — Open Source and free to use.

