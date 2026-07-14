# KINETRA — Multi-Device Edge AI Cricket Coaching

> Built for Snapdragon Multiverse Hackathon, Noida 2026

Real-time cricket biomechanics coaching platform that distributes AI intelligence across 4 Snapdragon devices.

## Team
- Sharad Gaur — Architecture & Presentation  
- Monica — Software & AI Development
- Harsh — Hardware & Arduino Integration

## Multi-Device Architecture

| Device | Role |
|--------|------|
| 📱 OnePlus 15 (Mobile) | Live video capture → streams frames via WebSocket |
| 💻 Surface Laptop 7 Snapdragon X Elite | Pose estimation via onnxruntime-qnn on NPU |
| 🔌 Arduino UNO Q | Real-time LED/buzzer/haptic feedback |
| ☁️ Qualcomm Cloud AI 100 | Session storage + long-term analytics |

## Setup & Run

### Option A — Full Multi-Device Mode (Hackathon Demo)

**PC Backend (Snapdragon X Elite):**
```bash
cd Kinectra-mvp01-main/backend
pip install -r requirements.txt
python main.py
# Starts on 0.0.0.0:8000
# Auto-detects Arduino on USB
# Loads YOLOv8-pose via onnxruntime-qnn
```

**Frontend:**
```bash
cd Kinectra-mvp01-main
pnpm install
pnpm --filter @workspace/kinetra run dev
```

**Arduino:**
- Open `backend/arduino/kinetra_arduino.ino` in Arduino IDE App Lab
- Flash to Arduino UNO Q
- Connect via USB to PC

**Mobile:**
- Open browser on OnePlus 15
- Go to `http://<PC-IP>:5173`
- Allow camera access
- Frames stream to PC automatically via WebSocket

### Option B — Browser-Only Mode (Fallback)
```bash
cd Kinectra-mvp01-main
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/kinetra run dev
```
Required env: `DATABASE_URL` — Postgres connection string

## How the Multi-Device Flow Works
1. 📱 Mobile camera captures live bowling session
2. 📡 Frames streamed to PC via WebSocket (ws://PC-IP:8000/ws/stream)
3. 💻 PC runs YOLOv8-pose via onnxruntime-qnn on Snapdragon NPU
4. 📐 Joint angles calculated: elbow, knee, spine, shoulder, balance
5. 🎯 Technique score generated (0-100)
6. 🔌 Arduino receives serial command: G (good) / W (warning) / D (danger)
7. 💡 LED + buzzer + vibration fires instantly
8. ☁️ Session data synced to Qualcomm Cloud AI 100
9. 📊 Player history and trends available on dashboard

## Tech Stack

**Multi-device layer:**
- PC ML: onnxruntime-qnn (QNNExecutionProvider — Snapdragon NPU)
- CV Model: YOLOv8-pose ONNX
- IoT: Arduino UNO Q via pyserial
- Cloud: Qualcomm Cloud AI 100 REST API
- Device comms: WebSocket + Serial

**Application layer:**
- Frontend: React + Vite + TailwindCSS + Framer Motion
- Browser CV: MediaPipe Tasks Vision (WASM fallback)
- Backend: FastAPI (Python) + Express 5 (Node)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, drizzle-zod
- Build: pnpm workspaces, esbuild

## Scoring Formula
`overall = posture * 0.30 + alignment * 0.25 + stability * 0.25 + efficiency * 0.20`

## Architecture Decisions
- Primary inference on Snapdragon NPU via onnxruntime-qnn — not cloud, not browser
- MediaPipe WASM kept as browser fallback mode
- Arduino feedback is physical and instantaneous — no screen needed
- Cloud AI 100 used only for longitudinal analytics (not primary inference)
- Edge-first design: works fully offline except Cloud sync

## Where Things Live
- `backend/main.py` — FastAPI entry point
- `backend/services/pose_detector.py` — YOLOv8 + QNN inference
- `backend/services/angle_calculator.py` — joint angle math
- `backend/services/arduino_serial.py` — serial communication
- `backend/services/session_manager.py` — session telemetry
- `backend/routes/analysis.py` — WebSocket endpoint
- `frontend/src/pages/` — 4 app pages
- `frontend/src/hooks/use-kinetra-analysis.ts` — CV pipeline

## License
MIT — Open source, freely available
