# /// script
# requires-python = ">=3.10,<3.14"
# dependencies = ["torch==2.8.*", "spandrel", "onnx", "onnxruntime", "numpy"]
# ///
"""Export Real-ESRGAN weights (BSD-3, xinntao/Real-ESRGAN) to ONNX and validate against PyTorch.

  uv run tools/export_onnx.py export          # writes public/models/*.onnx
  uv run tools/export_onnx.py check PATH      # validate a third-party x4plus ONNX

spandrel builds the right architecture (SRVGGNetCompact / RRDBNet) from the .pth, so
basicsr (incompatible with current torchvision) is not needed.
"""
import pathlib
import sys
import urllib.request

import numpy as np
import onnxruntime as ort
import torch
from spandrel import ModelLoader

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "temp" / "weights"
OUT = ROOT / "public" / "models"
WEIGHTS = {
    "realesr-general-x4v3": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth",
    "realesrgan-x4plus-anime-6b": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth",
    "realesrgan-x4plus": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
}
EXPORT = ["realesr-general-x4v3", "realesrgan-x4plus-anime-6b"]


def load(name: str) -> torch.nn.Module:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{name}.pth"
    if not path.exists():
        urllib.request.urlretrieve(WEIGHTS[name], path)
    desc = ModelLoader().load_from_file(str(path))
    assert desc.scale == 4, f"{name}: scale {desc.scale}"
    return desc.model.eval()


def validate(model: torch.nn.Module, onnx_path: pathlib.Path) -> None:
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    inp = sess.get_inputs()[0]
    print(f"  input {inp.name} {inp.shape}, output {sess.get_outputs()[0].shape}")
    for h, w in [(64, 64), (48, 80)]:
        x = torch.rand(1, 3, h, w)
        with torch.no_grad():
            ref = model(x).numpy()
        got = sess.run(None, {inp.name: x.numpy()})[0]
        assert got.shape == ref.shape, f"shape {got.shape} != {ref.shape}"
        diff = float(np.abs(got - ref).max())
        assert diff < 1e-3, f"{onnx_path.name} {h}x{w}: max diff {diff}"
        print(f"  {onnx_path.name} {h}x{w}: max diff {diff:.2e} OK")


def export(name: str) -> None:
    model = load(name)
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{name}.onnx"
    torch.onnx.export(
        model,
        torch.rand(1, 3, 64, 64),
        str(out),
        opset_version=17,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {2: "h", 3: "w"}, "output": {2: "h4", 3: "w4"}},
        dynamo=False,
    )
    validate(model, out)
    print(f"{out.name}: {out.stat().st_size} bytes")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "export":
        for n in EXPORT:
            export(n)
    elif cmd == "check" and len(sys.argv) == 3:
        validate(load("realesrgan-x4plus"), pathlib.Path(sys.argv[2]))
    else:
        sys.exit(__doc__)
