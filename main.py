import os
import io
import asyncio
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

app = FastAPI(docs_url=None, redoc_url=None)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Montar carpeta estática
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def root():
    path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="index.html missing")

def process_image(content: bytes, quality: int) -> bytes:
    """
    Función síncrona aislada para procesamiento intensivo de CPU.
    """
    try:
        with Image.open(io.BytesIO(content)) as img:
            # Prevenir errores con formatos de color incompatibles (ej. P o CMYK)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA") if "A" in img.mode else img.convert("RGB")
            
            out = io.BytesIO()
            # method=0 para velocidad máxima, optimize=False ahorra tiempo de CPU
            img.save(out, format="WEBP", quality=quality, method=0, optimize=False)
            return out.getvalue()
    except UnidentifiedImageError:
        raise ValueError("El archivo no es una imagen válida.")

@app.post("/api/convert")
async def convert_image(files: list[UploadFile] = File(...), quality: int = Form(80)):
    # Tomamos el primer archivo (el frontend envía de a uno)
    file = files[0]
    content = await file.read()
    
    # Límite de 20MB
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (Max 20MB)")

    try:
        # ⚡ MAGIA AQUÍ: Enviamos el trabajo de CPU a un thread pool. 
        # Esto permite a FastAPI seguir recibiendo miles de peticiones mientras procesa.
        webp_bytes = await asyncio.to_thread(process_image, content, quality)
        return Response(content=webp_bytes, media_type="image/webp")
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")