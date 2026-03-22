"""
Stage 1: Local Image Preprocessing & Forensic Feature Extraction
No API calls — runs entirely on local machine using Pillow and NumPy.
Extracts objective forensic signals: ELA, FFT, metadata, statistics.
"""
import io
import base64
import numpy as np
from PIL import Image, ImageChops

# ─── HELPERS ────────────────────────────────────────────────────

def _decode_base64_image(base64_data):
    """Decode a base64 data-URL string into a PIL Image."""
    if "," in base64_data:
        base64_data = base64_data.split(",", 1)[1]
    img_bytes = base64.b64decode(base64_data)
    return Image.open(io.BytesIO(img_bytes))


def _image_to_np(img):
    """Convert a PIL Image (RGB) to a float64 NumPy array."""
    return np.array(img.convert("RGB"), dtype=np.float64)


# ─── ELA (Error Level Analysis) ────────────────────────────────

def _compute_ela(img, quality=90, scale=15):
    """
    Re-compress at a given JPEG quality and compute the absolute
    pixel-level difference from the original.

    Real photos: variable ELA (edited regions glow brighter).
    AI-generated: very uniform ELA across the whole image.
    """
    buffer = io.BytesIO()
    img_rgb = img.convert("RGB")
    img_rgb.save(buffer, "JPEG", quality=quality)
    buffer.seek(0)
    recompressed = Image.open(buffer)

    ela_img = ImageChops.difference(img_rgb, recompressed)
    ela_np = np.array(ela_img, dtype=np.float64)

    # Brighten for visibility
    extrema = img_rgb.getextrema()
    max_diff = max(ex[1] for ex in extrema) if extrema else 255
    scale_factor = 255.0 / (max_diff * 0.2 + 1)
    ela_np = np.clip(ela_np * scale_factor, 0, 255)

    # Statistics
    mean_intensity = float(np.mean(ela_np))
    std_intensity = float(np.std(ela_np))
    high_diff_ratio = float(np.sum(ela_np > 128) / ela_np.size)

    return {
        "mean_intensity": round(mean_intensity, 2),
        "std_intensity": round(std_intensity, 2),
        "high_diff_ratio": round(high_diff_ratio, 4),
        "uniformity_score": round(1.0 - min(std_intensity / 60.0, 1.0), 2)
    }


# ─── FFT (Frequency Domain Analysis) ──────────────────────────

def _compute_fft_features(img):
    """
    Compute the 2D FFT magnitude spectrum of the grayscale image.
    GAN-generated images often show distinctive grid-like patterns
    in the frequency domain (spectral peaks).
    """
    gray = np.array(img.convert("L"), dtype=np.float64)
    f_transform = np.fft.fft2(gray)
    f_shift = np.fft.fftshift(f_transform)
    magnitude = np.log1p(np.abs(f_shift))

    # Spectral statistics
    center = np.array(magnitude.shape) // 2
    h, w = magnitude.shape
    
    # Ratio of energy in high-frequency vs low-frequency bands
    low_freq_mask = np.zeros_like(magnitude, dtype=bool)
    radius = min(h, w) // 6
    y, x = np.ogrid[:h, :w]
    low_freq_mask[(y - center[0])**2 + (x - center[1])**2 <= radius**2] = True

    low_energy = float(np.mean(magnitude[low_freq_mask]))
    high_energy = float(np.mean(magnitude[~low_freq_mask]))

    # GAN artifacts show as unusual spikes in high frequencies
    spectral_ratio = high_energy / (low_energy + 1e-10)

    return {
        "low_freq_energy": round(low_energy, 2),
        "high_freq_energy": round(high_energy, 2),
        "spectral_ratio": round(spectral_ratio, 4),
        "spectral_flatness": round(float(np.std(magnitude) / (np.mean(magnitude) + 1e-10)), 4)
    }


# ─── METADATA EXTRACTION ──────────────────────────────────────

def _extract_metadata(img):
    """Extract basic image metadata and EXIF data."""
    meta = {
        "width": img.width,
        "height": img.height,
        "format": img.format or "unknown",
        "mode": img.mode,
        "has_exif": False,
        "exif_summary": ""
    }

    try:
        exif = img._getexif()
        if exif:
            meta["has_exif"] = True
            # Known EXIF tags
            tag_map = {271: "Make", 272: "Model", 274: "Orientation", 
                       306: "DateTime", 36867: "DateTimeOriginal"}
            parts = []
            for tag_id, name in tag_map.items():
                if tag_id in exif:
                    parts.append(f"{name}: {exif[tag_id]}")
            meta["exif_summary"] = "; ".join(parts) if parts else "EXIF present but no camera info"
    except Exception:
        pass

    return meta


# ─── FORENSIC SCORING ─────────────────────────────────────────

def _compute_forensic_score(ela_results, fft_results, metadata):
    """
    Compute a 0-100 forensic suspicion score from local features.
    Higher = more likely AI-generated.
    """
    score = 0.0

    # ELA: High uniformity → typical of AI-generated images (0-35 pts)
    uniformity = ela_results["uniformity_score"]
    score += uniformity * 35

    # ELA: Very low high-diff ratio → synthetic (0-15 pts)
    if ela_results["high_diff_ratio"] < 0.01:
        score += 15
    elif ela_results["high_diff_ratio"] < 0.05:
        score += 8

    # FFT: Unusual spectral patterns (0-25 pts)
    if fft_results["spectral_ratio"] > 0.7:
        score += 15
    elif fft_results["spectral_ratio"] > 0.5:
        score += 8

    if fft_results["spectral_flatness"] > 0.6:
        score += 10
    elif fft_results["spectral_flatness"] > 0.4:
        score += 5

    # Metadata: No EXIF at all is slightly suspicious (0-10 pts)
    if not metadata["has_exif"]:
        score += 10

    # Metadata: Perfect square/power-of-2 dimensions hint at AI (0-15 pts)
    w, h = metadata["width"], metadata["height"]
    if w == h and w in (256, 512, 768, 1024, 2048):
        score += 15
    elif w == h:
        score += 5

    return int(min(round(score), 100))


# ─── PUBLIC API ────────────────────────────────────────────────

def preprocess_and_extract(base64_image_data):
    """
    Run the full local forensic pipeline on a base64-encoded image.
    Returns a dict with all forensic features and a summary string.
    """
    try:
        img = _decode_base64_image(base64_image_data)

        metadata = _extract_metadata(img)
        ela_results = _compute_ela(img)
        fft_results = _compute_fft_features(img)
        forensic_score = _compute_forensic_score(ela_results, fft_results, metadata)

        # Build a concise text summary for downstream VLM agents
        summary_parts = []
        if forensic_score >= 60:
            summary_parts.append(f"HIGH forensic suspicion ({forensic_score}/100)")
        elif forensic_score >= 35:
            summary_parts.append(f"MODERATE forensic suspicion ({forensic_score}/100)")
        else:
            summary_parts.append(f"LOW forensic suspicion ({forensic_score}/100)")

        if ela_results["uniformity_score"] > 0.7:
            summary_parts.append("ELA shows unusually uniform error levels (typical of AI generation)")
        if not metadata["has_exif"]:
            summary_parts.append("No camera EXIF metadata found")
        if fft_results["spectral_ratio"] > 0.6:
            summary_parts.append("Frequency analysis shows unusual spectral distribution")

        return {
            "forensic_score": forensic_score,
            "metadata": metadata,
            "ela": ela_results,
            "fft": fft_results,
            "summary": ". ".join(summary_parts) + "."
        }

    except Exception as e:
        print(f"Preprocessing Error: {e}")
        return {
            "forensic_score": 0,
            "metadata": {"width": 0, "height": 0, "format": "unknown", "mode": "unknown", "has_exif": False, "exif_summary": ""},
            "ela": {"mean_intensity": 0, "std_intensity": 0, "high_diff_ratio": 0, "uniformity_score": 0},
            "fft": {"low_freq_energy": 0, "high_freq_energy": 0, "spectral_ratio": 0, "spectral_flatness": 0},
            "summary": f"Preprocessing failed: {str(e)}"
        }
