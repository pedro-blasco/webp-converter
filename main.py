import os, io, zipfile, asyncio, gc
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

app = FastAPI(docs_url=None, redoc_url=None)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# --- INGENIERÍA DE RECURSOS (RENDER FREE TIER) ---
# 1. SEMÁFORO: Con 0.1 CPU, no podemos procesar más de 2 imágenes pesadas a la vez.
# El resto se quedará en cola esperando su turno (millisecondos) en lugar de crashear el server.
CONCURRENCY_LIMIT = asyncio.Semaphore(2)

# 2. LIMITES:
MAX_FILE_SIZE = 15 * 1024 * 1024 # 15MB
Image.MAX_IMAGE_PIXELS = 60000000 # Evitar bombas de descompresión

@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    path = os.path.join(STATIC_DIR, "index.html")
    return FileResponse(path) if os.path.exists(path) else Response(status_code=404)

@app.post("/api/convert")
async def convert_images(
    files: List[UploadFile] = File(...),
    quality: int = Form(80)
):
    # Entramos en la zona del semáforo. Si ya hay 2 procesando, esperamos aquí.
    async with CONCURRENCY_LIMIT:
        try:
            processed = []
            for file in files:
                # Leemos el archivo
                content = await file.read()
                
                # Validación rápida de tamaño
                if len(content) > MAX_FILE_SIZE: continue

                # Procesamiento
                with Image.open(io.BytesIO(content)) as img:
                    out = io.BytesIO()
                    
                    # --- OPTIMIZACIÓN DE VELOCIDAD ---
                    # method=3: Balance perfecto velocidad/compresión (Default es 6, muy lento)
                    # optimize=True: Lo mantenemos porque ahorra espacio, pero con method=3 es rápido.
                    img.save(out, format="WEBP", quality=quality, optimize=True, method=3)
                    
                    processed.append(
                    {
                        "name": f"{os.path.splitext(file.filename)[0]}.webp",
                        "data": out.getvalue()
                    }
                    )
                
                # Liberar memoria de la imagen original inmediatamente
                del content
            
            # 3. LIMPIEZA FORZADA (GC):
            # En servidores de 512MB RAM, no esperamos a Python. Limpiamos YA.
            gc.collect()

            if not processed: 
                raise HTTPException(status_code=400, detail="Error converting files")

            # Retorno Unico
            if len(processed) == 1:
                return Response(content=processed[0]["data"], media_type="image/webp")
            
            # Retorno ZIP
            zip_buf = io.BytesIO()
            with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
                for f in processed:
                    zf.writestr(f["name"], f["data"])
            
            # Limpiamos variables procesadas antes de enviar
            result_bytes = zip_buf.getvalue()
            del processed
            del zip_buf
            gc.collect()

            return Response(
                content=result_bytes,
                media_type="application/zip",
                headers={"Content-Disposition": "attachment; filename=images.zip"}
            )

        except Exception as e:
            print(f"Error: {e}")
            raise HTTPException(status_code=400, detail=str(e))