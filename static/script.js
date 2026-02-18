const el = {
    drop: document.getElementById('dropZone'),
    input: document.getElementById('fileInput'),
    info: document.getElementById('fileInfo'),
    name: document.getElementById('fileName'),
    count: document.getElementById('fileCount'),
    btn: document.getElementById('btnConvert'),
    dl: document.getElementById('btnDownload'),
    prog: document.getElementById('progressContainer'),
    bar: document.getElementById('progressBar'),
    err: document.getElementById('error-msg'),
    qual: document.getElementById('quality'),
    qualVal: document.getElementById('qualityVal'),
    w: document.getElementById('width'),
    h: document.getElementById('height'),
    theme: document.getElementById('themeToggle')
};

let files = [];

// Theme Toggle
el.theme.onclick = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    el.theme.innerText = isDark ? '🌙' : '☀️';
};

// Quality Slider Update
el.qual.oninput = (e) => el.qualVal.innerText = e.target.value;

// File Handling
const handleFiles = (fileList) => {
    files = Array.from(fileList);
    if (files.length > 0) {
        el.name.innerText = files.length === 1 ? files[0].name : `${files.length} images selected`;
        el.count.innerText = files.length === 1 ? (files[0].size/1024).toFixed(0)+'KB' : 'BATCH';
        el.info.style.display = 'flex';
        el.btn.disabled = false;
        el.btn.style.display = 'block';
        el.dl.style.display = 'none';
        el.err.innerText = '';
    }
};

el.drop.onclick = () => el.input.click();
el.input.onchange = (e) => handleFiles(e.target.files);

// Drag & Drop
el.drop.ondragover = (e) => { e.preventDefault(); el.drop.classList.add('dragover'); };
el.drop.ondragleave = () => el.drop.classList.remove('dragover');
el.drop.ondrop = (e) => {
    e.preventDefault();
    el.drop.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
};

// Paste from Clipboard
window.onpaste = (e) => {
    const items = e.clipboardData.items;
    const pastedFiles = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) pastedFiles.push(items[i].getAsFile());
    }
    if (pastedFiles.length > 0) handleFiles(pastedFiles);
};

// Convert
el.btn.onclick = async () => {
    el.btn.style.display = 'none';
    el.prog.style.display = 'block';
    el.bar.style.width = '20%';

    const fd = new FormData();
    files.forEach(f => fd.append("files", f));
    fd.append("quality", el.qual.value);
    fd.append("width", el.w.value || 0);
    fd.append("height", el.h.value || 0);

    try {
        const res = await fetch('/api/convert', { method: 'POST', body: fd });
        if (!res.ok) throw new Error("Processing failed");
        
        el.bar.style.width = '80%';
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        
        el.bar.style.width = '100%';
        setTimeout(() => {
            el.prog.style.display = 'none';
            el.dl.href = url;
            // Detectar si es ZIP o Imagen simple
            const isZip = blob.type.includes("zip");
            el.dl.download = isZip ? "optimized_images.zip" : files[0].name.split('.')[0] + '.webp';
            el.dl.innerText = isZip ? "Download ZIP" : "Download WebP";
            el.dl.style.display = 'inline-block';
        }, 500);

    } catch (e) {
        el.prog.style.display = 'none';
        el.btn.style.display = 'block';
        el.err.innerText = e.message;
    }
};