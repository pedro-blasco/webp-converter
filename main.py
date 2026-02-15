from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
import io
import os

app = FastAPI(docs_url=None, redoc_url=None)

# --- RUTAS ABSOLUTAS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
INDEX_PATH = os.path.join(STATIC_DIR, "index.html")

# Montar archivos estáticos
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# CORRECCIÓN: Usamos api_route para permitir GET y HEAD correctamente
@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    if not os.path.exists(INDEX_PATH):
        return Response(content="index.html not found", status_code=404)
    return FileResponse(INDEX_PATH)

# --- MOTOR DE CONVERSIÓN ---
MAX_FILE_SIZE_MB = 10
MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 90000000 

@app.post("/api/convert")
async def convert_image(file: UploadFile = File(...)):
    # Validar tamaño
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large")

    try:
        content = await file.read()
        with Image.open(io.BytesIO(content)) as img:
            output_buffer = io.BytesIO()
            img.save(output_buffer, format="WEBP", quality=80, optimize=True)
            output_buffer.seek(0)
            return Response(
                content=output_buffer.getvalue(), 
                media_type="image/webp"
            )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")