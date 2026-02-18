import os, io, zipfile
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
    return FileResponse(path) if os.path.exists(path) else Response(status_code=404)

@app.post("/api/convert")
async def convert_images(
    files: List[UploadFile] = File(...),
    quality: int = Form(80),
    width: int = Form(0),
    height: int = Form(0)
):
    try:
        processed_files = []
        
        for file in files:
            content = await file.read()
            if len(content) > 15 * 1024 * 1024: continue 
            
            with Image.open(io.BytesIO(content)) as img:
                # Resize logic
                if width > 0 or height > 0:
                    w = width if width > 0 else img.width
                    h = height if height > 0 else img.height
                    img = img.resize((w, h), Image.Resampling.LANCZOS)
                
                output = io.BytesIO()
                img.save(output, format="WEBP", quality=quality, optimize=True)
                processed_files.append(
                    {
                        "name": f"{os.path.splitext(file.filename)[0]}.webp",
                        "data": output.getvalue(),
                    }
                )

        if not processed_files: raise HTTPException(status_code=400, detail="No valid files processed")

        # Return single image or ZIP
        if len(processed_files) == 1:
            return Response(content=processed_files[0]["data"], media_type="image/webp")
        
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for f in processed_files:
                zip_file.writestr(f["name"], f["data"])
        
        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=converted_images.zip"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
