import os, io, gc
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

app = FastAPI(docs_url=None, redoc_url=None)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(path):
        return FileResponse(path)
    return Response(content="index.html missing", status_code=404)

@app.post("/api/convert")
async def convert_image(files: List[UploadFile] = File(...), quality: int = Form(80)):
    try:
        file = files[0]
        content = await file.read()
        
        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large")

        with Image.open(io.BytesIO(content)) as img:
            out = io.BytesIO()
            # method=0 para velocidad máxima
            img.save(out, format="WEBP", quality=quality, method=0, optimize=False)
            val = out.getvalue()
            
            del content
            del out
            gc.collect()
            
            return Response(content=val, media_type="image/webp")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from Exception in e