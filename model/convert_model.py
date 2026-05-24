"""
convert_model.py
================
Konversi model Keras (.h5) ke format TensorFlow.js
agar bisa diload oleh @tensorflow/tfjs-node di server Node.js.

Usage:
    python convert_model.py
    python convert_model.py --model_path path/to/model.h5 --output_dir ../server/ml-model
"""

import os
import sys
import argparse


def convert_keras_to_tfjs(model_path: str, output_dir: str) -> None:
    """Convert a Keras .h5 model to TensorFlow.js format."""
    import tensorflowjs as tfjs
    import tensorflow as tf

    print(f"📦 Loading model from: {model_path}")
    model = tf.keras.models.load_model(model_path)
    model.summary()

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    print(f"\n🔄 Converting to TensorFlow.js format...")
    print(f"   Output directory: {output_dir}")

    tfjs.converters.save_keras_model(model, output_dir)

    # List output files
    print(f"\n✅ Conversion complete! Output files:")
    for f in sorted(os.listdir(output_dir)):
        size = os.path.getsize(os.path.join(output_dir, f))
        size_str = f"{size / 1024:.1f} KB" if size < 1024 * 1024 else f"{size / (1024*1024):.1f} MB"
        print(f"   📄 {f} ({size_str})")

    print(f"\n💡 To use in Node.js:")
    print(f'   const model = await tf.loadLayersModel("file://{os.path.abspath(output_dir)}/model.json");')


def main():
    parser = argparse.ArgumentParser(description="Convert Keras model to TFJS format")
    parser.add_argument(
        "--model_path",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "waste_classifier.h5"),
        help="Path to the Keras .h5 model file",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "..", "server", "ml-model"),
        help="Output directory for TFJS model files",
    )
    args = parser.parse_args()

    if not os.path.exists(args.model_path):
        print(f"❌ Model file not found: {args.model_path}")
        print(f"   Please run train_model.py first to generate the model.")
        sys.exit(1)

    convert_keras_to_tfjs(args.model_path, args.output_dir)


if __name__ == "__main__":
    main()
