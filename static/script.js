const el = {
    drop: document.getElementById('dropZone'),
    input: document.getElementById('fileInput'),
    list: document.getElementById('fileList'),
    count: document.getElementById('fileCount'),
    clear: document.getElementById('clearAll'),
    btn: document.getElementById('btnConvert'),
    dl: document.getElementById('btnDownload'),
    quality: document.getElementById('quality'),
    qVal: document.getElementById('qVal'),
    theme: document.getElementById('themeToggle'),
    msg: document.getElementById('statusMsg')
};

// --- ESTADO ---
let filesQueue = []; // Aquí guardamos los archivos

// --- TEMA ---
el.theme.onclick = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    el.theme.innerText = isDark ? '🌙' : '☀️';
};

// --- RENDERIZADO DE LISTA ---
function render() {
    el.list.innerHTML = '';
    
    if (filesQueue.length === 0) {
        el.list.innerHTML = '<div class="empty-state">No files selected</div>';
        el.btn.disabled = true;
        el.count.innerText = '0 Files';
        return;
    }

    filesQueue.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <span class="file-name" title="${file.name}">📄 ${file.name}</span>
            <button onclick="remove(${index})" class="remove-btn" title="Remove">×</button>
        `;
        el.list.appendChild(div);
    });

    el.count.innerText = `${filesQueue.length} Files`;
    el.btn.disabled = false;
    // Ocultar botón de descarga si se modifica la lista
    el.dl.style.display = 'none';
    el.btn.style.display = 'inline-block';
}

// --- LOGICA DE ARCHIVOS ---
function addFiles(newFiles) {
    el.msg.innerText = '';
    Array.from(newFiles).forEach(f => {
        // Solo imágenes
        if (f.type.startsWith('image/')) {
            filesQueue.push(f);
        }
    });
    render();
}

window.remove = (index) => {
    filesQueue.splice(index, 1);
    render();
};

el.clear.onclick = () => {
    filesQueue = [];
    render();
};

// --- EVENTOS DRAG & DROP & CLICK ---
el.drop.onclick = () => el.input.click();
el.input.onchange = (e) => {
    addFiles(e.target.files);
    el.input.value = ''; // Reset input para permitir subir el mismo archivo
};

el.drop.ondragover = (e) => { e.preventDefault(); el.drop.classList.add('dragover'); };
el.drop.ondragleave = () => el.drop.classList.remove('dragover');
el.drop.ondrop = (e) => {
    e.preventDefault();
    el.drop.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
};

// --- FIX: PEGAR (CTRL+V) ---
// Escuchamos en toda la ventana para capturar el paste
window.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    const pastedFiles = [];
    
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            const blob = items[i].getAsFile();
            // Truco: Si pegas una imagen, a veces no tiene nombre. Le damos uno.
            if (!blob.name || blob.name === 'image.png') {
                blob.name = `pasted_${Date.now()}.png`;
            }
            pastedFiles.push(blob);
        }
    }
    
    if (pastedFiles.length > 0) {
        addFiles(pastedFiles);
    }
});

// --- SLIDER CALIDAD ---
el.quality.oninput = (e) => el.qVal.innerText = e.target.value;

// --- CONVERTIR ---
el.btn.onclick = async () => {
    if (filesQueue.length === 0) return;

    el.btn.disabled = true;
    el.btn.innerText = "Processing...";
    el.msg.innerText = "";

    const fd = new FormData();
    filesQueue.forEach(f => fd.append("files", f));
    fd.append("quality", el.quality.value);

    try {
        const res = await fetch('/api/convert', { method: 'POST', body: fd });
        
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || "Conversion error");
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        // Configurar botón de descarga
        el.dl.href = url;
        const isZip = blob.type.includes('zip');
        el.dl.download = isZip ? "images_optimized.zip" : filesQueue[0].name.split('.')[0] + '.webp';
        el.dl.innerText = isZip ? "Download ZIP" : "Download WebP";
        
        // Cambiar botones
        el.btn.style.display = 'none';
        el.dl.style.display = 'inline-block';
        
    } catch (e) {
        console.error(e);
        el.msg.innerText = "Error: " + e.message;
        el.btn.disabled = false;
    } finally {
        el.btn.innerText = "Convert All";
    }
};