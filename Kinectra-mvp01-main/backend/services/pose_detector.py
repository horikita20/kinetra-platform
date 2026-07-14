import os
import sys
import urllib.request
import cv2
import numpy as np
import onnxruntime as ort
from utils.config import config

class PoseDetector:
    def __init__(self):
        self.session = None
        self._check_and_download_model()
        self._init_session()

    def _check_and_download_model(self):
        """Checks if the YOLOv8-pose ONNX model exists, downloads it if not."""
        model_path = config.MODEL_PATH
        if not os.path.exists(model_path):
            print(f"Model file not found at {model_path}. Downloading from {config.MODEL_URL}...")
            try:
                # Show simple download progress
                def progress(count, block_size, total_size):
                    percent = int(count * block_size * 100 / total_size)
                    sys.stdout.write(f"\rDownloading: {percent}%")
                    sys.stdout.flush()
                
                urllib.request.urlretrieve(config.MODEL_URL, model_path, reporthook=progress)
                print("\nDownload complete.")
            except Exception as e:
                print(f"Error downloading model: {e}")
                raise RuntimeError(f"Could not download model from {config.MODEL_URL}")
        else:
            print(f"Model file already exists at {model_path}.")

    def _init_session(self):
        """Initializes the ONNX inference session with QNN and CPU failover."""
        # Try loading with QNNExecutionProvider if configured
        if config.USE_QNN:
            try:
                print("Attempting to load ONNX Runtime session with QNNExecutionProvider...")
                import onnxruntime_qnn as qnn_ep
                ep_lib_path = qnn_ep.get_library_path()
                print(f"QNN execution provider library path found: {ep_lib_path}")
                
                # Register execution provider library
                ort.register_execution_provider_library("QNNExecutionProvider", ep_lib_path)
                
                providers = ["QNNExecutionProvider", "CPUExecutionProvider"]
                provider_options = [
                    {"backend_path": config.QNN_BACKEND_PATH},
                    {}
                ]
                
                self.session = ort.InferenceSession(
                    config.MODEL_PATH,
                    providers=providers,
                    provider_options=provider_options
                )
                print("ONNX Runtime initialized with QNNExecutionProvider successfully!")
                return
            except Exception as e:
                print(f"Failed to register or run with QNNExecutionProvider: {e}")
                print("Falling back to CPUExecutionProvider...")
        
        # CPU Fallback (or default execution provider fallback)
        try:
            self.session = ort.InferenceSession(
                config.MODEL_PATH,
                providers=["CPUExecutionProvider"]
            )
            print("ONNX Runtime initialized with CPUExecutionProvider successfully.")
        except Exception as e:
            print(f"Failed to initialize CPUExecutionProvider: {e}")
            raise e

    def detect(self, image: np.ndarray) -> list:
        """
        Runs pose detection on the input image.
        Returns a list of 17 keypoints for the primary person detected:
        [{"x": float, "y": float, "confidence": float}, ...]
        If no person is detected, returns an empty list.
        """
        h_orig, w_orig = image.shape[:2]

        # 1. Preprocessing
        # YOLOv8-pose input: 1x3x640x640, RGB, normalized to [0, 1]
        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        img_resized = cv2.resize(img_rgb, (640, 640))
        img_data = img_resized.transpose(2, 0, 1)  # HWC to CHW
        img_data = np.expand_dims(img_data, axis=0).astype(np.float32) / 255.0

        # 2. Inference
        input_name = self.session.get_inputs()[0].name
        outputs = self.session.run(None, {input_name: img_data})
        output = outputs[0]  # Shape: (1, 56, 8400)

        # 3. Postprocessing
        # Shape output is (1, 56, 8400). Let's reshape it to (56, 8400) and transpose to (8400, 56)
        predictions = np.squeeze(output).T  # Shape: (8400, 56)

        # Extract box confidence/score (index 4)
        scores = predictions[:, 4]
        
        # Filter by confidence threshold
        conf_threshold = 0.4
        valid_indices = np.where(scores > conf_threshold)[0]
        
        if len(valid_indices) == 0:
            return []

        # Find the highest confidence detection (primary athlete)
        best_idx = valid_indices[np.argmax(scores[valid_indices])]
        best_pred = predictions[best_idx]

        # Keypoints: indices 5 to 55 represent 17 keypoints (x, y, confidence)
        keypoints = []
        for i in range(17):
            start_idx = 5 + i * 3
            # YOLOv8 keypoints are in the 640x640 space
            kp_x = float(best_pred[start_idx] * w_orig / 640.0)
            kp_y = float(best_pred[start_idx + 1] * h_orig / 640.0)
            kp_conf = float(best_pred[start_idx + 2])
            
            keypoints.append({
                "x": kp_x,
                "y": kp_y,
                "confidence": kp_conf
            })

        return keypoints
