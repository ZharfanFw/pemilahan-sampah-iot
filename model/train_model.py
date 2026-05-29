"""
train_model.py
==============
Training script untuk model klasifikasi sampah Organik vs Anorganik
menggunakan MobileNetV2 transfer learning.

Dataset: Kaggle "Waste Classification Data" by Sashaank Sekar
    - https://www.kaggle.com/datasets/techsash/waste-classification-data
    - 2 kelas: O (Organic) dan R (Recyclable/Anorganik)
    - ~22.564 training images, ~2.513 test images

Usage (Lokal):
    pip install -r requirements.txt
    python train_model.py

Usage (Google Colab):
    1. Upload file ini ke Colab
    2. Jalankan cell demi cell, atau:
       !pip install -r requirements.txt
       !python train_model.py

Output:
    - waste_classifier.h5          (Keras model)
    - training_history.png         (Plot training curves)
    - confusion_matrix.png         (Confusion matrix)
    - classification_report.txt    (Precision, Recall, F1)
"""

import os
import sys
import json
import numpy as np
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend (server/Colab friendly)
import matplotlib.pyplot as plt
import seaborn as sns

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, callbacks
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.preprocessing.image import ImageDataGenerator

from sklearn.metrics import classification_report, confusion_matrix

# ============================================================================
# Configuration
# ============================================================================

CONFIG = {
    # Paths
    "dataset_dir": os.path.join(os.path.dirname(__file__), "dataset"),
    "output_dir": os.path.dirname(__file__),

    # Model hyperparameters
    "img_size": (224, 224),
    "batch_size": 32,
    "epochs_phase1": 15,      # Train custom head only
    "epochs_phase2": 10,      # Fine-tune top layers
    "learning_rate_phase1": 1e-3,
    "learning_rate_phase2": 1e-5,
    "fine_tune_from_layer": 100,  # Unfreeze from this layer onwards (MobileNetV2 has 155 layers)
    "dropout_rate": 0.3,
    "dense_units": 128,

    # Class labels
    "class_names": ["Organik", "Anorganik"],  # O = Organik, R = Recyclable (Anorganik)
}


# ============================================================================
# Step 1: Download / Prepare Dataset
# ============================================================================

def download_dataset(dataset_dir: str) -> str:
    """
    Download Waste Classification dataset dari Kaggle.
    Requires: kaggle.json credential file atau opendatasets.

    Returns path to dataset root.
    """
    train_dir = os.path.join(dataset_dir, "DATASET", "TRAIN")
    test_dir = os.path.join(dataset_dir, "DATASET", "TEST")

    # Check if already downloaded
    if os.path.exists(train_dir) and os.path.exists(test_dir):
        print("✅ Dataset sudah ada, skip download.")
        return dataset_dir

    print("📥 Downloading dataset dari Kaggle...")
    print("   Dataset: techsash/waste-classification-data\n")

    try:
        import opendatasets as od
        od.download(
            "https://www.kaggle.com/datasets/techsash/waste-classification-data",
            data_dir=dataset_dir,
        )
        # opendatasets saves to a subfolder
        downloaded_path = os.path.join(dataset_dir, "waste-classification-data")
        if os.path.exists(downloaded_path):
            # Move contents up
            import shutil
            for item in os.listdir(downloaded_path):
                src = os.path.join(downloaded_path, item)
                dst = os.path.join(dataset_dir, item)
                if not os.path.exists(dst):
                    shutil.move(src, dst)
            shutil.rmtree(downloaded_path, ignore_errors=True)

    except ImportError:
        print("❌ opendatasets tidak terinstall.")
        print("   Jalankan: pip install opendatasets")
        print("\n   Atau download manual:")
        print("   1. Buka: https://www.kaggle.com/datasets/techsash/waste-classification-data")
        print("   2. Download dan extract ke folder: model/dataset/")
        print("   3. Pastikan struktur folder:")
        print("      model/dataset/DATASET/TRAIN/O/  (gambar organik)")
        print("      model/dataset/DATASET/TRAIN/R/  (gambar recyclable)")
        print("      model/dataset/DATASET/TEST/O/")
        print("      model/dataset/DATASET/TEST/R/")
        sys.exit(1)

    # Verify
    if not os.path.exists(train_dir):
        print(f"❌ Dataset structure tidak sesuai. Expected: {train_dir}")
        print("   Pastikan struktur folder:")
        print("   model/dataset/DATASET/TRAIN/O/")
        print("   model/dataset/DATASET/TRAIN/R/")
        sys.exit(1)

    print("✅ Dataset berhasil didownload!")
    return dataset_dir


# ============================================================================
# Step 2: Create Data Generators
# ============================================================================

def create_data_generators(dataset_dir: str):
    """
    Buat ImageDataGenerator untuk training dan validation.
    Training data menggunakan augmentation, test data hanya rescale.

    Struktur dataset:
        DATASET/TRAIN/O/  → Organik
        DATASET/TRAIN/R/  → Recyclable (Anorganik)
        DATASET/TEST/O/
        DATASET/TEST/R/
    """
    img_size = CONFIG["img_size"]
    batch_size = CONFIG["batch_size"]

    train_dir = os.path.join(dataset_dir, "DATASET", "TRAIN")
    test_dir = os.path.join(dataset_dir, "DATASET", "TEST")

    # Training data dengan augmentation
    train_datagen = ImageDataGenerator(
        rescale=1.0 / 255,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.15,
        zoom_range=0.2,
        horizontal_flip=True,
        brightness_range=[0.8, 1.2],
        fill_mode="nearest",
        validation_split=0.15,  # 15% dari training untuk validation
    )

    # Test data tanpa augmentation
    test_datagen = ImageDataGenerator(rescale=1.0 / 255)

    print(f"📂 Loading training data dari: {train_dir}")
    train_generator = train_datagen.flow_from_directory(
        train_dir,
        target_size=img_size,
        batch_size=batch_size,
        class_mode="binary",      # O=0, R=1
        subset="training",
        shuffle=True,
        seed=42,
    )

    print(f"📂 Loading validation data dari: {train_dir} (15% split)")
    val_generator = train_datagen.flow_from_directory(
        train_dir,
        target_size=img_size,
        batch_size=batch_size,
        class_mode="binary",
        subset="validation",
        shuffle=False,
        seed=42,
    )

    print(f"📂 Loading test data dari: {test_dir}")
    test_generator = test_datagen.flow_from_directory(
        test_dir,
        target_size=img_size,
        batch_size=batch_size,
        class_mode="binary",
        shuffle=False,
    )

    # Print class mapping
    print(f"\n📊 Class mapping: {train_generator.class_indices}")
    print(f"   Training samples  : {train_generator.samples}")
    print(f"   Validation samples: {val_generator.samples}")
    print(f"   Test samples      : {test_generator.samples}")

    return train_generator, val_generator, test_generator


# ============================================================================
# Step 3: Build Model
# ============================================================================

def build_model() -> keras.Model:
    """
    Build MobileNetV2 transfer learning model.

    Architecture:
        MobileNetV2 (pretrained, frozen)
        → GlobalAveragePooling2D
        → Dropout(0.3)
        → Dense(128, relu)
        → Dropout(0.3)
        → Dense(1, sigmoid)
    """
    img_size = CONFIG["img_size"]
    dropout_rate = CONFIG["dropout_rate"]
    dense_units = CONFIG["dense_units"]

    print("\n🏗️  Building MobileNetV2 model...")

    # Base model: MobileNetV2 pretrained on ImageNet
    base_model = MobileNetV2(
        weights="imagenet",
        include_top=False,
        input_shape=(*img_size, 3),
    )

    # Freeze all base model layers
    base_model.trainable = False

    # Build custom classification head
    model = keras.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dropout(dropout_rate),
        layers.Dense(dense_units, activation="relu"),
        layers.Dropout(dropout_rate),
        layers.Dense(1, activation="sigmoid"),  # Binary classification
    ], name="waste_classifier")

    model.summary()

    print(f"\n📐 Total params     : {model.count_params():,}")
    print(f"   Trainable params : {sum(tf.keras.backend.count_params(w) for w in model.trainable_weights):,}")
    print(f"   Non-trainable    : {sum(tf.keras.backend.count_params(w) for w in model.non_trainable_weights):,}")

    return model


# ============================================================================
# Step 4: Train Model
# ============================================================================

def train_model(model: keras.Model, train_gen, val_gen):
    """
    Two-phase training:
        Phase 1: Train custom head only (base frozen)
        Phase 2: Fine-tune top layers of MobileNetV2
    """

    # --- Phase 1: Train custom head ---
    print("\n" + "=" * 60)
    print("🎯 PHASE 1: Training custom head (base model frozen)")
    print("=" * 60)

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=CONFIG["learning_rate_phase1"]),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )

    phase1_callbacks = [
        callbacks.EarlyStopping(
            monitor="val_loss",
            patience=5,
            restore_best_weights=True,
            verbose=1,
        ),
        callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=3,
            min_lr=1e-7,
            verbose=1,
        ),
    ]

    history1 = model.fit(
        train_gen,
        epochs=CONFIG["epochs_phase1"],
        validation_data=val_gen,
        callbacks=phase1_callbacks,
        verbose=1,
    )

    # --- Phase 2: Fine-tune ---
    print("\n" + "=" * 60)
    print("🎯 PHASE 2: Fine-tuning top layers of MobileNetV2")
    print("=" * 60)

    # Unfreeze base model from a certain layer
    base_model = model.layers[0]  # MobileNetV2
    base_model.trainable = True

    # Freeze all layers before `fine_tune_from_layer`
    for layer in base_model.layers[:CONFIG["fine_tune_from_layer"]]:
        layer.trainable = False

    trainable_count = sum(1 for layer in base_model.layers if layer.trainable)
    print(f"   Unfrozen layers: {trainable_count} / {len(base_model.layers)}")

    # Recompile with lower learning rate
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=CONFIG["learning_rate_phase2"]),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )

    phase2_callbacks = [
        callbacks.EarlyStopping(
            monitor="val_loss",
            patience=5,
            restore_best_weights=True,
            verbose=1,
        ),
        callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=2,
            min_lr=1e-8,
            verbose=1,
        ),
        callbacks.ModelCheckpoint(
            filepath=os.path.join(CONFIG["output_dir"], "waste_classifier_best.h5"),
            monitor="val_accuracy",
            save_best_only=True,
            verbose=1,
        ),
    ]

    history2 = model.fit(
        train_gen,
        epochs=CONFIG["epochs_phase2"],
        validation_data=val_gen,
        callbacks=phase2_callbacks,
        verbose=1,
    )

    # Merge histories
    history = {}
    for key in history1.history:
        history[key] = history1.history[key] + history2.history[key]

    return history


# ============================================================================
# Step 5: Evaluate Model
# ============================================================================

def evaluate_model(model: keras.Model, test_gen, output_dir: str):
    """
    Evaluasi model pada test set.
    Generate: confusion matrix, classification report.
    """
    print("\n" + "=" * 60)
    print("📊 Evaluating model on test set...")
    print("=" * 60)

    # Evaluate
    loss, accuracy = model.evaluate(test_gen, verbose=1)
    print(f"\n   Test Loss    : {loss:.4f}")
    print(f"   Test Accuracy: {accuracy:.4f} ({accuracy * 100:.1f}%)")

    # Predictions
    predictions = model.predict(test_gen, verbose=1)
    y_pred = (predictions > 0.5).astype(int).flatten()
    y_true = test_gen.classes

    # Class names based on generator mapping
    # Generator maps: O=0, R=1
    # Our labels: O=Organik, R=Anorganik
    class_names = CONFIG["class_names"]  # ["Organik", "Anorganik"]

    # Classification report
    report = classification_report(y_true, y_pred, target_names=class_names)
    print(f"\n📋 Classification Report:\n{report}")

    report_path = os.path.join(output_dir, "classification_report.txt")
    with open(report_path, "w") as f:
        f.write(f"Test Loss    : {loss:.4f}\n")
        f.write(f"Test Accuracy: {accuracy:.4f} ({accuracy * 100:.1f}%)\n\n")
        f.write(report)
    print(f"   Saved to: {report_path}")

    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(8, 6))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=class_names,
        yticklabels=class_names,
    )
    plt.title("Confusion Matrix", fontsize=14, fontweight="bold")
    plt.xlabel("Predicted Label")
    plt.ylabel("True Label")
    plt.tight_layout()

    cm_path = os.path.join(output_dir, "confusion_matrix.png")
    plt.savefig(cm_path, dpi=150)
    plt.close()
    print(f"   Confusion matrix saved to: {cm_path}")

    return accuracy


def plot_training_history(history: dict, output_dir: str):
    """Plot training/validation accuracy dan loss curves."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    epochs = range(1, len(history["accuracy"]) + 1)

    # Accuracy
    ax1.plot(epochs, history["accuracy"], "b-o", label="Training Accuracy", markersize=3)
    ax1.plot(epochs, history["val_accuracy"], "r-o", label="Validation Accuracy", markersize=3)
    ax1.set_title("Model Accuracy", fontsize=13, fontweight="bold")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Accuracy")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # Loss
    ax2.plot(epochs, history["loss"], "b-o", label="Training Loss", markersize=3)
    ax2.plot(epochs, history["val_loss"], "r-o", label="Validation Loss", markersize=3)
    ax2.set_title("Model Loss", fontsize=13, fontweight="bold")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Loss")
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()

    hist_path = os.path.join(output_dir, "training_history.png")
    plt.savefig(hist_path, dpi=150)
    plt.close()
    print(f"   Training history plot saved to: {hist_path}")


# ============================================================================
# Step 6: Export Model
# ============================================================================

def export_model(model: keras.Model, output_dir: str):
    """Save model in .h5 format and convert to TFJS."""
    # Save Keras .h5
    h5_path = os.path.join(output_dir, "waste_classifier.h5")
    model.save(h5_path)
    h5_size = os.path.getsize(h5_path) / (1024 * 1024)
    print(f"\n💾 Model saved: {h5_path} ({h5_size:.1f} MB)")

    # Convert to TFJS
    tfjs_dir = os.path.join(output_dir, "..", "server", "ml-model")
    try:
        import tensorflowjs as tfjs
        os.makedirs(tfjs_dir, exist_ok=True)
        tfjs.converters.save_keras_model(model, tfjs_dir)
        print(f"✅ TFJS model saved to: {tfjs_dir}")
        for f in sorted(os.listdir(tfjs_dir)):
            size = os.path.getsize(os.path.join(tfjs_dir, f))
            size_str = f"{size / 1024:.1f} KB" if size < 1024 * 1024 else f"{size / (1024*1024):.1f} MB"
            print(f"   📄 {f} ({size_str})")
    except ImportError:
        print("⚠️  tensorflowjs belum terinstall, jalankan convert_model.py secara terpisah.")
        print("   pip install tensorflowjs")
        print(f"   python convert_model.py --model_path {h5_path} --output_dir {tfjs_dir}")

    # Save config metadata
    metadata = {
        "model_name": "waste_classifier",
        "architecture": "MobileNetV2 (transfer learning)",
        "input_size": list(CONFIG["img_size"]) + [3],
        "classes": CONFIG["class_names"],
        "class_mapping": {"O": 0, "R": 1},
        "preprocessing": {
            "rescale": "1.0 / 255.0",
            "target_size": list(CONFIG["img_size"]),
        },
        "threshold": 0.5,
        "description": "Binary classifier: score < 0.5 = Organik, score >= 0.5 = Anorganik",
    }

    meta_path = os.path.join(output_dir, "model_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"📋 Model metadata saved to: {meta_path}")


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 60)
    print("🗑️  WASTE CLASSIFICATION MODEL TRAINING")
    print("   Organik vs Anorganik (MobileNetV2)")
    print("=" * 60)

    # Check GPU
    gpus = tf.config.list_physical_devices("GPU")
    if gpus:
        print(f"\n🚀 GPU detected: {gpus}")
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
    else:
        print("\n⚠️  No GPU detected, training will use CPU (slower)")

    print(f"   TensorFlow version: {tf.__version__}")

    # Step 1: Download dataset
    dataset_dir = download_dataset(CONFIG["dataset_dir"])

    # Step 2: Create data generators
    train_gen, val_gen, test_gen = create_data_generators(dataset_dir)

    # Step 3: Build model
    model = build_model()

    # Step 4: Train model
    history = train_model(model, train_gen, val_gen)

    # Step 5: Evaluate
    output_dir = CONFIG["output_dir"]
    accuracy = evaluate_model(model, test_gen, output_dir)
    plot_training_history(history, output_dir)

    # Step 6: Export
    export_model(model, output_dir)

    print("\n" + "=" * 60)
    print(f"🎉 Training complete! Test accuracy: {accuracy * 100:.1f}%")
    print("=" * 60)
    print("\nNext steps:")
    print("  1. Review confusion_matrix.png dan training_history.png")
    print("  2. Pastikan model TFJS ada di server/ml-model/")
    print("  3. Jalankan server: cd server && npm run dev")
    print("  4. Test: curl -X POST http://localhost:5000/api/classify \\")
    print('       -H "Content-Type: image/jpeg" --data-binary @test_image.jpg')


if __name__ == "__main__":
    main()
