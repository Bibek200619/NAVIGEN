# Models

Exported ONNX traversability segmentation models go here (e.g. `traversability_320x240.onnx`).
The active model path is set in `ros2_ws/src/navigen_perception/config/perception.yaml`.
Models are interchangeable: any backend implementing `SegmentationBackend` works without
touching navigation code. Training utilities (PyTorch) are added in Phase 7.
