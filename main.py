from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
import io

app = FastAPI(docs_url=None, redoc_url=None)

# Configuraciones
MAX_FILE_SIZE_MB = 10
MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 90000000 

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    return FileResponse('static/index.html')

@app.post("/api/convert")
async def convert_image(file: UploadFile = File(...)):
    # 1. Validar tamaño
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large")

    try:
        content = await file.read()
        
        with Image.open(io.BytesIO(content)) as img:
            output_buffer = io.BytesIO()
            
            # --- CORRECCIÓN DE VELOCIDAD ---
            # Quitamos 'method=6'. 'optimize=True' es suficiente y mucho más rápido.
            img.save(output_buffer, format="WEBP", quality=80, optimize=True)
            
            output_buffer.seek(0)
            
            return Response(
                content=output_buffer.getvalue(),
                media_type="image/webp"
            )

    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")