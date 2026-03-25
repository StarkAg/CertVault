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
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

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


def get_font(font_path, size):
    try:
        if font_path and os.path.exists(font_path):
            return ImageFont.truetype(font_path, size)
    except Exception as e:
        print(f"[CertGen] Font load error: {e}")
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
    except Exception:
        return ImageFont.load_default()


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
    font_size = settings.get('font_size', 60)
    font_color = settings.get('font_color', '#000000')
    font_path = settings.get('font_path')
    font = get_font(font_path, font_size)
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
        cert_id_size = settings.get('cert_id_size', 20)
        cert_id_color = settings.get('cert_id_color', '#666666')
        id_font = get_font(font_path, cert_id_size)
        bbox = draw.textbbox((0, 0), certificate_id, font=id_font)
        id_width = bbox[2] - bbox[0]
        id_x = cert_id_x - id_width / 2
        draw.text((id_x, cert_id_y), certificate_id, font=id_font, fill=cert_id_color)
    verify_line = settings.get('verify_line_text')
    if verify_line:
        verify_line = str(verify_line).replace('{certificate_id}', certificate_id or '').replace('{id}', certificate_id or '')
        vx = settings.get('verify_line_x', 0.5) * width
        vy = settings.get('verify_line_y', 0.92) * height
        vsize = settings.get('verify_line_size', 14)
        vcolor = settings.get('verify_line_color', '#666666')
        vfont = get_font(font_path, vsize)
        vbbox = draw.textbbox((0, 0), verify_line, font=vfont)
        vw = vbbox[2] - vbbox[0]
        draw.text((vx - vw / 2, vy), verify_line, font=vfont, fill=vcolor)
    return img


def image_to_pdf(img, output_path=None):
    img_width, img_height = img.size
    if img_width < 1 or img_height < 1:
        raise ValueError(f"Invalid image dimensions: {img_width}x{img_height}")
    pdf_width, pdf_height = landscape(A4)
    scale = min(pdf_width / img_width, pdf_height / img_height)
    scaled_width = img_width * scale
    scaled_height = img_height * scale
    x_offset = (pdf_width - scaled_width) / 2
    y_offset = (pdf_height - scaled_height) / 2
    if output_path:
        c = canvas.Canvas(output_path, pagesize=landscape(A4))
    else:
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=landscape(A4))
    if img.mode == 'RGBA':
        rgb_img = Image.new('RGB', img.size, (255, 255, 255))
        rgb_img.paste(img, mask=img.split()[3] if len(img.split()) == 4 else None)
        img = rgb_img
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='JPEG', quality=95, optimize=True)
    img_buffer.seek(0)
    c.drawImage(ImageReader(img_buffer), x_offset, y_offset, scaled_width, scaled_height)
    c.save()
    if output_path:
        return output_path
    buffer.seek(0)
    return buffer.getvalue()


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
    return jsonify({'status': 'ok', 'service': 'certgen', 'timestamp': datetime.utcnow().isoformat()})


@app.route('/generate', methods=['POST'])
def generate():
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
        if template.startswith('data:') or len(template) > 500:
            raw = template.split(',')[1] if ',' in template else template
            img_data = base64.b64decode(raw)
            template_path = os.path.join(OUTPUT_DIR, f'temp_template_{hashlib.md5(img_data).hexdigest()[:8]}.png')
            with open(template_path, 'wb') as f:
                f.write(img_data)
        else:
            template_path = os.path.join(TEMPLATES_DIR, template)
        cert_img = generate_certificate_image(template_path, recipient_name, certificate_id, settings)
        pdf_bytes = image_to_pdf(cert_img)
        if upload:
            public_id = f"{certificate_id or recipient_name.replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            result = upload_to_cloudinary(pdf_bytes, public_id, folder)
            return jsonify({'success': True, 'pdf_url': result['secure_url'], 'public_id': result['public_id']})
        return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True,
                         download_name=f"{certificate_id or 'certificate'}.pdf")
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/generate-batch', methods=['POST'])
def generate_batch():
    try:
        data = request.json or {}
        template = data.get('template')
        recipients = data.get('recipients', [])
        settings = data.get('settings', {})
        folder = data.get('cloudinary_folder', 'certvault')
        if not template or not recipients:
            return jsonify({'success': False, 'error': 'template and recipients are required'}), 400
        if template.startswith('data:') or len(template) > 500:
            raw = template.split(',')[1] if ',' in template else template
            img_data = base64.b64decode(raw)
            template_path = os.path.join(OUTPUT_DIR, f'temp_template_{hashlib.md5(img_data).hexdigest()[:8]}.png')
            with open(template_path, 'wb') as f:
                f.write(img_data)
        else:
            template_path = os.path.join(TEMPLATES_DIR, template)
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
            'results': results, 'errors': errors if errors else None
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/preview', methods=['POST'])
def preview():
    try:
        data = request.json or {}
        template = data.get('template')
        name = data.get('name', 'Sample Name')
        settings = data.get('settings', {})
        if not template:
            return jsonify({'success': False, 'error': 'template is required'}), 400
        if template.startswith('data:') or len(template) > 500:
            raw = template.split(',')[1] if ',' in template else template
            img_data = base64.b64decode(raw)
            template_path = os.path.join(OUTPUT_DIR, f'temp_preview_{hashlib.md5(img_data).hexdigest()[:8]}.png')
            with open(template_path, 'wb') as f:
                f.write(img_data)
        else:
            template_path = os.path.join(TEMPLATES_DIR, template)
        cert_img = generate_certificate_image(template_path, name, 'CV-2025-SAMPLE', settings)
        width, height = cert_img.size
        if width > 800:
            cert_img = cert_img.resize((800, int(height * 800 / width)), Image.LANCZOS)
        buf = io.BytesIO()
        cert_img.save(buf, format='JPEG', quality=85)
        buf.seek(0)
        preview_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return jsonify({'success': True, 'preview': f'data:image/jpeg;base64,{preview_b64}'})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', os.getenv('CERTGEN_PORT', 5050)))
    print(f"[CertGen] Starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
