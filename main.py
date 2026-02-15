import os
import io
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

app = FastAPI(docs_url=None, redoc_url=None)

# 1. CONFIGURACIÓN DE RUTAS ABSOLUTAS
# Esto asegura que Render encuentre los archivos sin importar la carpeta
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
INDEX_PATH = os.path.join(STATIC_DIR, "index.html")

# 2. CONFIGURACIÓN DE SEGURIDAD Y LÍMITES
MAX_FILE_SIZE_MB = 10
MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 90000000 

# 3. MONTAR ARCHIVOS ESTÁTICOS (CSS, JS)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# 4. RUTA PRINCIPAL (Acepta GET para usuarios y HEAD para Render)
@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    if os.path.exists(INDEX_PATH):
        return FileResponse(INDEX_PATH)
    return Response(content="Error: index.html not found", status_code=404)

# 5. MOTOR DE CONVERSIÓN
@app.post("/api/convert")
async def convert_image(file: UploadFile = File(...)):
    # Validar tamaño del archivo
    await file.seek(0, os.SEEK_END)
    file_size = await file.tell()
    await file.seek(0)

    if file_size > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large")

    try:
        # Leer imagen
        content = await file.read()
        
        # Procesar con Pillow
        with Image.open(io.BytesIO(content)) as img:
            # Convertir a RGB si es necesario (para evitar errores con transparencias)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            output_buffer = io.BytesIO()
            # Guardar como WebP optimizado (rápido)
            img.save(output_buffer, format="WEBP", quality=80, optimize=True)
            output_buffer.seek(0)
            
            return Response(
                content=output_buffer.getvalue(),
                media_type="image/webp"
            )

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=400, detail="Invalid image file")