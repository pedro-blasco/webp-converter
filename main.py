import os, io
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

app = FastAPI(docs_url=None, redoc_url=None)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
INDEX_PATH = os.path.join(STATIC_DIR, "index.html")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return FileResponse(INDEX_PATH) if os.path.exists(INDEX_PATH) else Response(status_code=404)

@app.post("/api/convert")
async def convert_image(file: UploadFile = File(...)):
    try:
        content = await file.read()
        if len(content) > 10 * 1024 * 1024: raise HTTPException(status_code=413)
        with Image.open(io.BytesIO(content)) as img:
            output = io.BytesIO()
            img.save(output, format="WEBP", quality=80, optimize=True)
            output.seek(0)
            return Response(content=output.getvalue(), media_type="image/webp")
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))