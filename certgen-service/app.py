"""
CertVault Certificate Generator Service
Generates PDF certificates from templates; uploads to Cloudinary.

Endpoints:
  POST /generate - Single certificate
  POST /generate-batch - Multiple certificates
  POST /preview - Preview image (base64)
  GET /health - Health check

Env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (or CLOUDINARY_URL)
     PORT (default 5050)
"""
import os
import io
import hashlib
import base64
import subprocess
import glob
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

try:
    from dotenv import load_dotenv
    for path in [
        os.path.join(os.path.dirname(__file__), '.env'),
        os.path.join(os.path.dirname(__file__), '..', '.env'),
    ]:
        if os.path.isfile(path):
            load_dotenv(path)
            break
except ImportError:
    pass

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import cloudinary
import cloudinary.uploader

app = Flask(__name__)
CORS(app)

cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
api_key = os.getenv('CLOUDINARY_API_KEY')
api_secret = os.getenv('CLOUDINARY_API_SECRET')
cloudinary_url = os.getenv('CLOUDINARY_URL')

if cloud_name and api_key and api_secret:
    cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret)
elif cloudinary_url:
    cloudinary.config(cloudinary_url=cloudinary_url)
else:
    print("[CertGen] WARNING: Cloudinary not configured.")

cfg = cloudinary.config()
print(f"[CertGen] Cloudinary: cloud_name_set={bool(cfg.cloud_name)} api_key_set={bool(cfg.api_key)}")

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), 'templates')
FONTS_DIR = os.path.join(os.path.dirname(__file__), 'fonts')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')
os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(FONTS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

SERVICE_VERSION = os.getenv("CERTGEN_VERSION", "2026-04-25-font-hardening")
COMMON_FONT_DIRS = [
    FONTS_DIR,
    "/usr/share/fonts",
    "/usr/local/share/fonts",
    "/Library/Fonts",
    "/System/Library/Fonts",
]
FONT_ALIASES = {
    "georgia": {"regular": ["DejaVuSerif.ttf"], "bold": ["DejaVuSerif-Bold.ttf"]},
    "playfair display": {"regular": ["DejaVuSerif.ttf"], "bold": ["DejaVuSerif-Bold.ttf"]},
    "source serif 4": {"regular": ["DejaVuSerif.ttf"], "bold": ["DejaVuSerif-Bold.ttf"]},
    "eb garamond": {"regular": ["DejaVuSerif.ttf"], "bold": ["DejaVuSerif-Bold.ttf"]},
    "times new roman": {"regular": ["DejaVuSerif.ttf"], "bold": ["DejaVuSerif-Bold.ttf"]},
    "inter": {"regular": ["DejaVuSans.ttf"], "bold": ["DejaVuSans-Bold.ttf"]},
    "manrope": {"regular": ["DejaVuSans.ttf"], "bold": ["DejaVuSans-Bold.ttf"]},
    "montserrat": {"regular": ["DejaVuSans.ttf"], "bold": ["DejaVuSans-Bold.ttf"]},
    "arial": {"regular": ["LiberationSans-Regular.ttf", "DejaVuSans.ttf"], "bold": ["LiberationSans-Bold.ttf", "DejaVuSans-Bold.ttf"]},
    "helvetica": {"regular": ["LiberationSans-Regular.ttf", "DejaVuSans.ttf"], "bold": ["LiberationSans-Bold.ttf", "DejaVuSans-Bold.ttf"]},
    "dejavu sans": {"regular": ["DejaVuSans.ttf"], "bold": ["DejaVuSans-Bold.ttf"]},
    "dejavu serif": {"regular": ["DejaVuSerif.ttf"], "bold": ["DejaVuSerif-Bold.ttf"]},
}
LAST_FONT_RESOLUTION = {}
LAST_SIZE_NORMALIZATION = {}


def parse_font_family(font_family):
    if not font_family:
        return None
    family = str(font_family).split(",")[0].strip().strip("'\"")
    return family or None


def normalize_font_size(raw_size, width, height, role):
    defaults = {
        "name": 60,
        "verify": 14,
        "certificate_id": 20,
    }
    minimums = {
        "name": max(48, min(76, round(height * 0.08))),
        "verify": max(12, min(18, round(height * 0.022))),
        "certificate_id": max(16, min(24, round(height * 0.03))),
    }
    maximums = {
        "name": max(minimums["name"], round(height * 0.18)),
        "verify": max(minimums["verify"], round(height * 0.045)),
        "certificate_id": max(minimums["certificate_id"], round(height * 0.06)),
    }

    try:
        size = float(raw_size if raw_size is not None else defaults[role])
    except (TypeError, ValueError):
        size = defaults[role]

    # Treat accidental ratio-style sizes as a percentage of template height.
    if 0 < size <= 1:
        size = size * height

    normalized = int(round(max(minimums[role], min(size, maximums[role]))))
    LAST_SIZE_NORMALIZATION[role] = {
        "input": raw_size,
        "output": normalized,
        "min": minimums[role],
        "max": maximums[role],
        "width": width,
        "height": height,
    }
    return normalized


@lru_cache(maxsize=256)
def find_font_file(filename):
    for base_dir in COMMON_FONT_DIRS:
        if not os.path.isdir(base_dir):
            continue
        direct_path = os.path.join(base_dir, filename)
        if os.path.exists(direct_path):
            return direct_path
        matches = glob.glob(os.path.join(base_dir, "**", filename), recursive=True)
        for match in matches:
            if os.path.exists(match):
                return match
    return None


@lru_cache(maxsize=128)
def resolve_font_path(font_family, weight="Regular"):
    family = parse_font_family(font_family)
    if not family:
        return None

    alias = FONT_ALIASES.get(family.lower())
    if alias:
        candidates = alias["bold" if weight.lower() == "bold" else "regular"]
        for candidate in candidates:
            resolved = find_font_file(candidate)
            if resolved:
                return resolved

    patterns = []
    if weight:
        patterns.append(f"{family}:style={weight}")
    patterns.append(family)

    for pattern in patterns:
        try:
            result = subprocess.run(
                ["fc-match", "-f", "%{file}\n", pattern],
                capture_output=True,
                text=True,
                check=True,
            )
            candidate = result.stdout.strip()
            if candidate and os.path.exists(candidate):
                return candidate
        except Exception:
            continue

    return None


def get_font(font_path, size, font_family=None, weight="Regular"):
    resolved_path = font_path if font_path and os.path.exists(font_path) else resolve_font_path(font_family, weight)
    resolution_key = f"{parse_font_family(font_family) or 'default'}:{weight.lower()}"
    try:
        if resolved_path and os.path.exists(resolved_path):
            LAST_FONT_RESOLUTION[resolution_key] = resolved_path
            return ImageFont.truetype(resolved_path, size)
    except Exception as e:
        print(f"[CertGen] Font load error: {e}")
    try:
        fallback_candidates = [
            resolve_font_path("DejaVu Sans", "Bold" if weight.lower() == "bold" else "Regular"),
            resolve_font_path("Arial", weight),
            resolve_font_path("Helvetica", weight),
        ]
        for candidate in fallback_candidates:
            if candidate and os.path.exists(candidate):
                LAST_FONT_RESOLUTION[resolution_key] = candidate
                return ImageFont.truetype(candidate, size)
    except Exception:
        pass
    family = (parse_font_family(font_family) or '').lower()
    wants_bold = weight.lower() == "bold"
    deterministic_fallbacks = (
        ["DejaVuSerif-Bold.ttf", "DejaVuSerif.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans.ttf"]
        if ('serif' in family or any(token in family for token in ['garamond', 'georgia', 'playfair', 'source serif', 'times']))
        else ["DejaVuSans-Bold.ttf", "DejaVuSans.ttf", "LiberationSans-Bold.ttf", "LiberationSans-Regular.ttf", "DejaVuSerif-Bold.ttf", "DejaVuSerif.ttf"]
    )
    if not wants_bold:
        deterministic_fallbacks = [name.replace("-Bold", "") if "-Bold" in name and name.replace("-Bold", "") in deterministic_fallbacks else name for name in deterministic_fallbacks]
    seen = set()
    for candidate_name in deterministic_fallbacks:
        if candidate_name in seen:
            continue
        seen.add(candidate_name)
        candidate_path = find_font_file(candidate_name)
        if not candidate_path:
            continue
        try:
            LAST_FONT_RESOLUTION[resolution_key] = candidate_path
            return ImageFont.truetype(candidate_path, size)
        except Exception:
            continue

    raise RuntimeError(f"Could not resolve a production-safe font for family={font_family!r} weight={weight!r}")


def fit_font_to_width(draw, text, font_path, size, font_family, weight, max_width, min_size, role):
    fitted_size = int(size)
    min_size = min(int(min_size), fitted_size)
    while fitted_size > min_size:
        font = get_font(font_path, fitted_size, font_family, weight)
        bbox = draw.textbbox((0, 0), text, font=font)
        if (bbox[2] - bbox[0]) <= max_width:
            LAST_SIZE_NORMALIZATION[role]["fitted"] = fitted_size
            return font, fitted_size
        fitted_size -= 2

    font = get_font(font_path, min_size, font_family, weight)
    LAST_SIZE_NORMALIZATION[role]["fitted"] = min_size
    LAST_SIZE_NORMALIZATION[role]["fit_floor_used"] = True
    return font, min_size


def font_health():
    checks = {}
    for family in ["Georgia", "Playfair Display", "Source Serif 4", "EB Garamond", "Inter", "Manrope", "Montserrat"]:
        checks[family] = {
            "regular": resolve_font_path(family, "Regular"),
            "bold": resolve_font_path(family, "Bold"),
        }
    return checks


def generate_certificate_image(template_path, recipient_name, certificate_id=None, settings=None):
    settings = settings or {}
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found: {template_path}")
    loaded = Image.open(template_path)
    if loaded.mode == 'RGBA':
        background = Image.new('RGBA', loaded.size, (255, 255, 255, 255))
        background.paste(loaded, (0, 0), loaded)
        img = background.convert('RGB')
    else:
        img = loaded.convert('RGB')
    if img.size[0] < 10 or img.size[1] < 10:
        raise ValueError(f"Template image too small: {img.size}")
    draw = ImageDraw.Draw(img)
    width, height = img.size
    text_x = settings.get('text_x', 0.5) * width
    text_y = settings.get('text_y', 0.5) * height
    font_size = normalize_font_size(settings.get('font_size', 60), width, height, "name")
    font_color = settings.get('font_color', '#000000')
    font_path = settings.get('font_path')
    font_family = settings.get('font_family')
    font, font_size = fit_font_to_width(
        draw,
        recipient_name,
        font_path,
        font_size,
        font_family,
        'Bold',
        width * 0.78,
        max(32, round(height * 0.045)),
        "name",
    )
    bbox = draw.textbbox((0, 0), recipient_name, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    name_x = text_x - text_width / 2
    name_y = text_y - text_height / 2
    stroke_width = settings.get('stroke_width', 0)
    stroke_color = settings.get('stroke_color', '#FFFFFF')
    if stroke_width > 0:
        draw.text((name_x, name_y), recipient_name, font=font, fill=font_color,
                  stroke_width=stroke_width, stroke_fill=stroke_color)
    else:
        draw.text((name_x, name_y), recipient_name, font=font, fill=font_color)
    if certificate_id and settings.get('show_cert_id', True):
        cert_id_x = settings.get('cert_id_x', 0.5) * width
        cert_id_y = settings.get('cert_id_y', 0.9) * height
        cert_id_size = normalize_font_size(settings.get('cert_id_size', 20), width, height, "certificate_id")
        cert_id_color = settings.get('cert_id_color', '#666666')
        id_font, cert_id_size = fit_font_to_width(
            draw,
            certificate_id,
            font_path,
            cert_id_size,
            font_family,
            'Regular',
            width * 0.55,
            max(12, round(height * 0.02)),
            "certificate_id",
        )
        bbox = draw.textbbox((0, 0), certificate_id, font=id_font)
        id_width = bbox[2] - bbox[0]
        id_x = cert_id_x - id_width / 2
        draw.text((id_x, cert_id_y), certificate_id, font=id_font, fill=cert_id_color)
    verify_line = settings.get('verify_line_text')
    if verify_line:
        verify_line = str(verify_line).replace('{certificate_id}', certificate_id or '').replace('{id}', certificate_id or '')
        vx = settings.get('verify_line_x', 0.5) * width
        vy = settings.get('verify_line_y', 0.92) * height
        vsize = normalize_font_size(settings.get('verify_line_size', 14), width, height, "verify")
        vcolor = settings.get('verify_line_color', '#666666')
        verify_font_family = settings.get('verify_line_font') or font_family
        vfont, vsize = fit_font_to_width(
            draw,
            verify_line,
            font_path,
            vsize,
            verify_font_family,
            'Regular',
            width * 0.82,
            max(10, round(height * 0.016)),
            "verify",
        )
        vbbox = draw.textbbox((0, 0), verify_line, font=vfont)
        vw = vbbox[2] - vbbox[0]
        vh = vbbox[3] - vbbox[1]
        draw.text((vx - vw / 2, vy - vh / 2), verify_line, font=vfont, fill=vcolor)
    return img


def image_to_pdf(img, output_path=None):
    img_width, img_height = img.size
    if img_width < 1 or img_height < 1:
        raise ValueError(f"Invalid image dimensions: {img_width}x{img_height}")
    # Use the image's pixel size as the PDF page size (1:1 match)
    page_size = (img_width, img_height)
    if output_path:
        c = canvas.Canvas(output_path, pagesize=page_size)
    else:
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=page_size)
    if img.mode == 'RGBA':
        rgb_img = Image.new('RGB', img.size, (255, 255, 255))
        rgb_img.paste(img, mask=img.split()[3] if len(img.split()) == 4 else None)
        img = rgb_img
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='JPEG', quality=95, optimize=True)
    img_buffer.seek(0)
    # Draw the image at (0, 0) to fill the page exactly
    c.drawImage(ImageReader(img_buffer), 0, 0, img_width, img_height)
    c.save()
    if output_path:
        return output_path
    buffer.seek(0)
    return buffer.getvalue()


def resolve_template_path(template, temp_prefix='temp_template'):
    template_value = str(template or '')
    if template_value.startswith('data:') or len(template_value) > 500:
        raw = template_value.split(',', 1)[1] if ',' in template_value else template_value
        img_data = base64.b64decode(raw)
        template_path = os.path.join(OUTPUT_DIR, f'{temp_prefix}_{hashlib.md5(img_data).hexdigest()[:8]}.png')
        with open(template_path, 'wb') as f:
            f.write(img_data)
        return template_path, template_path
    return os.path.join(TEMPLATES_DIR, template_value), None


def cleanup_temp_template(path):
    if not path:
        return
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass


def upload_to_cloudinary(pdf_bytes, public_id, folder="certvault"):
    result = cloudinary.uploader.upload(
        pdf_bytes,
        resource_type="raw",
        public_id=public_id,
        folder=folder,
        format="pdf",
        access_control=[{"access_type": "anonymous"}],
    )
    return {'secure_url': result.get('secure_url'), 'public_id': result.get('public_id')}


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'service': 'certgen',
        'version': SERVICE_VERSION,
        'timestamp': datetime.utcnow().isoformat(),
        'font_health': font_health(),
        'last_font_resolution': LAST_FONT_RESOLUTION,
        'last_size_normalization': LAST_SIZE_NORMALIZATION,
    })


@app.route('/generate', methods=['POST'])
def generate():
    temp_template_path = None
    try:
        data = request.json or {}
        template = data.get('template')
        recipient_name = data.get('recipient_name')
        certificate_id = data.get('certificate_id')
        settings = data.get('settings', {})
        upload = data.get('upload_to_cloudinary', True)
        folder = data.get('cloudinary_folder', 'certvault')
        if not template or not recipient_name:
            return jsonify({'success': False, 'error': 'template and recipient_name are required'}), 400
        template_path, temp_template_path = resolve_template_path(template, 'temp_template')
        cert_img = generate_certificate_image(template_path, recipient_name, certificate_id, settings)
        pdf_bytes = image_to_pdf(cert_img)
        if upload:
            public_id = f"{certificate_id or recipient_name.replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            result = upload_to_cloudinary(pdf_bytes, public_id, folder)
            return jsonify({
                'success': True,
                'pdf_url': result['secure_url'],
                'public_id': result['public_id'],
                'generator_version': SERVICE_VERSION,
                'font_resolution': LAST_FONT_RESOLUTION,
                'size_normalization': LAST_SIZE_NORMALIZATION,
            })
        return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True,
                         download_name=f"{certificate_id or 'certificate'}.pdf")
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cleanup_temp_template(temp_template_path)


@app.route('/generate-batch', methods=['POST'])
def generate_batch():
    temp_template_path = None
    try:
        data = request.json or {}
        template = data.get('template')
        recipients = data.get('recipients', [])
        settings = data.get('settings', {})
        folder = data.get('cloudinary_folder', 'certvault')
        if not template or not recipients:
            return jsonify({'success': False, 'error': 'template and recipients are required'}), 400
        template_path, temp_template_path = resolve_template_path(template, 'temp_template')
        results = []
        errors = []

        def process_one(recipient):
            name = recipient.get('name')
            cert_id = recipient.get('certificate_id')
            if not name:
                return None, {'recipient': recipient, 'error': 'name is required'}
            try:
                cert_img = generate_certificate_image(template_path, name, cert_id, settings)
                pdf_bytes = image_to_pdf(cert_img)
                public_id = f"{cert_id or name.replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
                upload_result = upload_to_cloudinary(pdf_bytes, public_id, folder)
                return {
                    'name': name, 'certificate_id': cert_id,
                    'pdf_url': upload_result['secure_url'], 'public_id': upload_result['public_id']
                }, None
            except Exception as e:
                return None, {'recipient': recipient, 'error': str(e)}

        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(process_one, r) for r in recipients]
            for future in futures:
                result, error = future.result()
                if result:
                    results.append(result)
                if error:
                    errors.append(error)
        return jsonify({
            'success': True, 'generated': len(results), 'failed': len(errors),
            'results': results, 'errors': errors if errors else None,
            'generator_version': SERVICE_VERSION,
            'font_resolution': LAST_FONT_RESOLUTION,
            'size_normalization': LAST_SIZE_NORMALIZATION,
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cleanup_temp_template(temp_template_path)


@app.route('/preview', methods=['POST'])
def preview():
    temp_template_path = None
    try:
        data = request.json or {}
        template = data.get('template')
        name = data.get('name', 'Sample Name')
        certificate_id = data.get('certificate_id', 'CV-2026-SAMPLE')
        settings = data.get('settings', {})
        if not template:
            return jsonify({'success': False, 'error': 'template is required'}), 400
        template_path, temp_template_path = resolve_template_path(template, 'temp_preview')
        cert_img = generate_certificate_image(template_path, name, certificate_id, settings)
        width, height = cert_img.size
        preview_max_width = 1600
        if width > preview_max_width:
            cert_img = cert_img.resize((preview_max_width, int(height * preview_max_width / width)), Image.LANCZOS)
        buf = io.BytesIO()
        cert_img.save(buf, format='PNG', optimize=True)
        buf.seek(0)
        preview_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return jsonify({
            'success': True,
            'preview': f'data:image/png;base64,{preview_b64}',
            'generator_version': SERVICE_VERSION,
            'font_resolution': LAST_FONT_RESOLUTION,
            'size_normalization': LAST_SIZE_NORMALIZATION,
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        cleanup_temp_template(temp_template_path)


if __name__ == '__main__':
    port = int(os.getenv('PORT', os.getenv('CERTGEN_PORT', 5050)))
    print(f"[CertGen] Starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
