const el = {
    drop: document.getElementById('dropZone'),
    input: document.getElementById('fileInput'),
    list: document.getElementById('fileList'),
    count: document.getElementById('fileCount'),
    clear: document.getElementById('clearAll'),
    btnAll: document.getElementById('btnConvertAll'),
    bar: document.getElementById('globalProgress'),
    quality: document.getElementById('quality'),
    qVal: document.getElementById('qVal'),
    theme: document.getElementById('themeToggle'),
    msg: document.getElementById('statusMsg')
};

// ESTADO: Array de objetos { file: File, status: 'pending'|'loading'|'done', url: string }
let fileQueue = []; 

// THEME
el.theme.onclick = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    el.theme.innerText = isDark ? '🌙' : '☀️';
};

el.quality.oninput = (e) => el.qVal.innerText = e.target.value;

// RENDERIZADO (El corazón del script)
function render() {
    el.list.innerHTML = '';
    
    if (fileQueue.length === 0) {
        el.list.innerHTML = '<div class="empty-state">No files selected</div>';
        el.btnAll.disabled = true;
        el.count.innerText = '0 Files';
        return;
    }

    fileQueue.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        
        let actionsHTML = '';

        if (item.status === 'pending') {
            // Botón Play (Convertir este solo)
            actionsHTML = `
                <button onclick="processSingle(${index})" class="action-btn btn-convert" title="Convert This">▶</button>
                <button onclick="remove(${index})" class="action-btn btn-delete" title="Remove">×</button>
            `;
        } else if (item.status === 'loading') {
            // Spinner de carga
            actionsHTML = `<div class="loader"></div>`;
        } else if (item.status === 'done') {
            // Botón Descargar y Borrar
            actionsHTML = `
                <a href="${item.url}" download="${item.newName}" class="action-btn btn-download" title="Download">⬇</a>
                <button onclick="remove(${index})" class="action-btn btn-delete" title="Remove">×</button>
            `;
        }

        div.innerHTML = `
            <div class="file-info">
                <span>📄</span>
                <span class="file-name" title="${item.file.name}">${item.file.name}</span>
            </div>
            <div class="file-actions">
                ${actionsHTML}
            </div>
        `;
        el.list.appendChild(div);
    });

    el.count.innerText = `${fileQueue.length} Files`;
    el.btnAll.disabled = false;
}

// GESTIÓN DE ARCHIVOS
function addFiles(newFiles) {
    el.msg.innerText = '';
    Array.from(newFiles).forEach(f => {
        if (f.type.startsWith('image/')) {
            // Añadimos al estado inicial
            fileQueue.push({ file: f, status: 'pending', url: null });
        }
    });
    render();
}

window.remove = (index) => {
    fileQueue.splice(index, 1);
    render();
};

el.clear.onclick = () => {
    fileQueue = [];
    render();
};

// API CALL (Genérica para 1 o varios)
async function sendToApi(filesList) {
    const fd = new FormData();
    filesList.forEach(f => fd.append("files", f));
    fd.append("quality", el.quality.value);
    
    const res = await fetch('/api/convert', { method: 'POST', body: fd });
    if (!res.ok) throw new Error("Conversion failed");
    return await res.blob();
}

// PROCESO INDIVIDUAL (El botón ▶)
window.processSingle = async (index) => {
    const item = fileQueue[index];
    
    // UI: Poner cargando este item
    item.status = 'loading';
    render();

    try {
        // Enviar SOLO este archivo
        const blob = await sendToApi([item.file]);
        
        // Actualizar estado con URL
        item.url = URL.createObjectURL(blob);
        item.newName = item.file.name.split('.')[0] + '.webp';
        item.status = 'done';
        
    } catch (e) {
        item.status = 'pending'; // Volver a permitir intento
        alert("Error converting this file");
    }
    render();
};

// PROCESO GLOBAL (Convert All)
el.btnAll.onclick = async () => {
    const pendingItems = fileQueue.filter(i => i.status === 'pending');
    if (pendingItems.length === 0) return alert("All files already converted!");

    // UI: Barra global cargando
    el.bar.style.width = '50%';
    el.btnAll.disabled = true;
    el.btnAll.innerText = "Processing...";

    try {
        // Enviar TODOS los pendientes
        const filesOnly = pendingItems.map(i => i.file);
        const blob = await sendToApi(filesOnly);
        
        // Completar barra
        el.bar.style.width = '100%';

        // Descargar ZIP automático
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filesOnly.length === 1 ? "image.webp" : "images_optimized.zip";
        a.click();

        // Opcional: Marcar todos como 'done' en la lista?
        // En batch zip es difícil mapear URL individuales, así que reiniciamos barra.
        setTimeout(() => { el.bar.style.width = '0%'; }, 1000);

    } catch (e) {
        el.msg.innerText = "Batch conversion error";
        el.bar.style.width = '0%';
    } finally {
        el.btnAll.disabled = false;
        el.btnAll.innerText = "Convert All to ZIP";
    }
};

// DRAG & DROP & PASTE
el.drop.onclick = () => el.input.click();
el.input.onchange = (e) => { addFiles(e.target.files); el.input.value = ''; };

el.drop.ondragover = (e) => { e.preventDefault(); el.drop.classList.add('dragover'); };
el.drop.ondragleave = () => el.drop.classList.remove('dragover');
el.drop.ondrop = (e) => { e.preventDefault(); el.drop.classList.remove('dragover'); addFiles(e.dataTransfer.files); };

window.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    const pasted = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            const blob = items[i].getAsFile();
            if (!blob.name || blob.name === 'image.png') blob.name = `pasted_${Date.now()}.png`;
            pasted.push(blob);
        }
    }
    if (pasted.length > 0) addFiles(pasted);
});