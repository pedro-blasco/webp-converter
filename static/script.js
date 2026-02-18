const el = {
    drop: document.getElementById('dropZone'),
    input: document.getElementById('fileInput'),
    list: document.getElementById('fileList'),
    count: document.getElementById('fileCount'),
    btnAll: document.getElementById('btnConvertAll'),
    clear: document.getElementById('clearAll'),
    theme: document.getElementById('themeToggle'),
    mainBarWrapper: document.getElementById('mainProgressWrapper'),
    mainBar: document.getElementById('mainProgressBar')
};

let filesQueue = [];
let isProcessing = false; // Bloqueo global

// --- TEMA ---
el.theme.onclick = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    el.theme.innerText = isDark ? '🌙' : '☀️';
};

// --- RENDERIZADO ---
function render() {
    el.list.innerHTML = '';
    
    if (filesQueue.length === 0) {
        el.list.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">No files selected</div>';
        el.btnAll.disabled = true;
        el.count.innerText = '0 Files';
        return;
    }

    filesQueue.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        
        let rightSide = '';

        if (item.status === 'pending') {
            // Botón de texto CONVERT
            rightSide = `
                <button onclick="processSingle(${index})" class="btn-sm btn-convert" ${isProcessing ? 'disabled' : ''}>Convert</button>
                <button onclick="remove(${index})" class="btn-sm btn-remove" ${isProcessing ? 'disabled' : ''}>×</button>
            `;
        } else if (item.status === 'loading') {
            // Barrita cargando
            rightSide = `<div class="mini-loader"></div>`;
        } else if (item.status === 'done') {
            // Botón DOWNLOAD
            rightSide = `
                <a href="${item.url}" download="${item.newName}" class="btn-sm btn-download">Download</a>
                <button onclick="remove(${index})" class="btn-sm btn-remove">×</button>
            `;
        } else if (item.status === 'error') {
            rightSide = `<span style="color:red; font-size:11px;">Error</span> <button onclick="remove(${index})" class="btn-sm btn-remove">×</button>`;
        }

        div.innerHTML = `
            <div class="file-info">
                <div class="file-name" title="${item.file.name}">${item.file.name}</div>
                <div class="file-status">${(item.file.size/1024).toFixed(0)} KB</div>
            </div>
            <div class="actions-group">
                ${rightSide}
            </div>
        `;
        el.list.appendChild(div);
    });

    // Contadores
    const pendingCount = filesQueue.filter(f => f.status === 'pending').length;
    el.count.innerText = `${filesQueue.length} Files`;
    
    // El botón Convert All se deshabilita si está procesando o si no hay nada pendiente
    el.btnAll.disabled = isProcessing || pendingCount === 0;
    el.btnAll.innerText = isProcessing ? "Processing..." : "Convert Remaining";
    el.clear.disabled = isProcessing;
}

// --- LOGICA ---
function addFiles(list) {
    Array.from(list).forEach(f => {
        if (f.type.startsWith('image/')) {
            filesQueue.push({ file: f, status: 'pending', url: null });
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

// API
async function convertOne(fileObj) {
    const fd = new FormData();
    fd.append("files", fileObj);
    fd.append("quality", 80); // Calidad fija para UI limpia

    const res = await fetch('/api/convert', { method: 'POST', body: fd });
    if (!res.ok) throw new Error("Err");
    return await res.blob();
}

// PROCESAR UNO
window.processSingle = async (index) => {
    if (isProcessing) return;
    
    const item = filesQueue[index];
    item.status = 'loading';
    render();

    try {
        const blob = await convertOne(item.file);
        item.url = URL.createObjectURL(blob);
        item.newName = item.file.name.split('.')[0] + '.webp';
        item.status = 'done';
    } catch (e) {
        item.status = 'error';
    }
    render();
};

// PROCESAR TODOS (Secuencial para ver progreso real)
el.btnAll.onclick = async () => {
    const pendingIndices = filesQueue
        .map((item, index) => item.status === 'pending' ? index : -1)
        .filter(i => i !== -1);

    if (pendingIndices.length === 0) return;

    isProcessing = true;
    el.mainBarWrapper.style.display = 'block';
    
    let completed = 0;
    const total = pendingIndices.length;

    // Procesamos uno por uno (Secuencial) para no matar al server
    // y para que el usuario vea la barra avanzar bonito.
    for (const index of pendingIndices) {
        filesQueue[index].status = 'loading';
        render(); // Actualiza UI para mostrar spinner en el actual

        try {
            const blob = await convertOne(filesQueue[index].file);
            filesQueue[index].url = URL.createObjectURL(blob);
            filesQueue[index].newName = filesQueue[index].file.name.split('.')[0] + '.webp';
            filesQueue[index].status = 'done';
        } catch (e) {
            filesQueue[index].status = 'error';
        }
        
        completed++;
        el.mainBar.style.width = `${(completed / total) * 100}%`;
        
        // Pequeña pausa para que la UI respire
        render(); 
    }

    isProcessing = false;
    setTimeout(() => {
        el.mainBarWrapper.style.display = 'none';
        el.mainBar.style.width = '0%';
    }, 1000);
    render();
};

// DRAG DROP & PASTE
el.drop.onclick = () => el.input.click();
el.input.onchange = (e) => { addFiles(e.target.files); el.input.value = ''; };
el.drop.ondragover = (e) => { e.preventDefault(); el.drop.classList.add('dragover'); };
el.drop.ondragleave = () => el.drop.classList.remove('dragover');
el.drop.ondrop = (e) => { e.preventDefault(); el.drop.classList.remove('dragover'); addFiles(e.dataTransfer.files); };

window.addEventListener('paste', (e) => {
    const {items} = e.clipboardData;
    const p = [];
    for (let i=0; i<items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            const b = items[i].getAsFile();
            if (!b.name || b.name === 'image.png') b.name = `pasted_${Date.now()}.png`;
            p.push(b);
        }
    }
    if (p.length) addFiles(p);
});