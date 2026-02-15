import os
import io
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

app = FastAPI(docs_url=None, redoc_url=None)

# 1. RUTAS ABSOLUTAS
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
INDEX_PATH = os.path.join(STATIC_DIR, "index.html")

# Límites
MAX_FILE_SIZE_MB = 10
MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    if os.path.exists(INDEX_PATH):
        return FileResponse(INDEX_PATH)
    return Response(content="index.html not found", status_code=404)

@app.post("/api/convert")
async def convert_image(file: UploadFile = File(...)):
    try:
        # Leemos el contenido del archivo primero
        content = await file.read()
        
        # Validamos el tamaño basándonos en los bytes leídos
        if len(content) > MAX_BYTES:
            raise HTTPException(status_code=413, detail=f"File too large (Max {MAX_FILE_SIZE_MB}MB)")

        # Intentamos abrir la imagen con Pillow
        # Usamos un bloque 'with' para asegurar que la memoria se limpie
        with Image.open(io.BytesIO(content)) as img:
            
            # NOTA: Eliminé la conversión forzada a RGB para que 
            # si subes un PNG transparente, el WebP SIGA siendo transparente.
            
            output_buffer = io.BytesIO()
            
            # Guardamos como WebP
            img.save(output_buffer, format="WEBP", quality=80, optimize=True)
            output_buffer.seek(0)
            
            return Response(
                content=output_buffer.getvalue(),
                media_type="image/webp"
            )

    except Exception as e:
        # Esto imprimirá el error real en los logs de Render para que lo veas
        print(f"DETALLE DEL ERROR: {str(e)}")
        # Devolvemos el error real al frontend para saber qué pasó
        raise HTTPException(status_code=400, detail=str(e))