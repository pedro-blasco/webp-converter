document.addEventListener('DOMContentLoaded', () => {
    const el = {
        drop: document.getElementById('dropZone'),
        input: document.getElementById('fileInput'),
        list: document.getElementById('fileList'),
        count: document.getElementById('fileCount'),
        clear: document.getElementById('clearAll'),
        btnAll: document.getElementById('btnConvertAll'),
        globalBar: document.getElementById('globalBar'),
        quality: document.getElementById('quality'),
        qVal: document.getElementById('qVal'),
        theme: document.getElementById('themeToggle')
    };

    // Almacena { file, status, blob (imagen convertida), url }
    let fileQueue = [];
    let isProcessing = false;
    let allConverted = false;

    // --- TEMA ---
    el.theme.onclick = () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
        el.theme.innerText = isDark ? '🌙' : '☀️';
    };

    el.quality.oninput = (e) => el.qVal.innerText = e.target.value + '%';

    // --- RENDERIZADO ---
    function render() {
        el.list.innerHTML = '';
        
        if (fileQueue.length === 0) {
            el.list.innerHTML = '<div class="empty-msg">No files selected</div>';
            el.btnAll.disabled = true;
            el.btnAll.innerText = "Convert All";
            el.btnAll.classList.remove('btn-success');
            el.count.innerText = '0 Files';
            return;
        }

        // Verificar si todos están listos para activar modo ZIP
        const pendingCount = fileQueue.filter(f => f.status === 'pending' || f.status === 'loading').length;
        const doneCount = fileQueue.filter(f => f.status === 'done').length;
        allConverted = (pendingCount === 0 && doneCount > 0);

        fileQueue.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'file-item';
            
            let actions = '';
            
            if (item.status === 'pending') {
                actions = `
                    <div class="btn-row">
                        <button onclick="processOne(${index})" class="btn-sm btn-convert" ${isProcessing ? 'disabled' : ''}>Convert</button>
                        <button onclick="removeFile(${index})" class="btn-sm btn-remove" ${isProcessing ? 'disabled' : ''}>×</button>
                    </div>`;
            } else if (item.status === 'loading') {
                actions = `<div class="loader"></div>`;
            } else if (item.status === 'done') {
                actions = `
                    <div class="btn-row">
                        <a href="${item.url}" download="${item.newName}" class="btn-sm btn-download">Download</a>
                        <button onclick="removeFile(${index})" class="btn-sm btn-remove">×</button>
                    </div>`;
            } else {
                actions = `<span style="color:red; font-size:11px;">Error</span> <button onclick="removeFile(${index})" class="btn-sm btn-remove">×</button>`;
            }

            div.innerHTML = `
                <div class="file-info">
                    <div class="file-name" title="${item.file.name}">${item.file.name}</div>
                    <div style="font-size:11px; color:var(--sub);">${(item.file.size/1024).toFixed(0)} KB</div>
                </div>
                ${actions}
            `;
            el.list.appendChild(div);
        });

        el.count.innerText = `${fileQueue.length} Files`;
        
        // Lógica del Botón Principal
        if (isProcessing) {
            el.btnAll.disabled = true;
            el.btnAll.innerText = "Processing...";
            el.btnAll.classList.remove('btn-success');
        } else if (allConverted) {
            // MODO ZIP: Todo convertido
            el.btnAll.disabled = false;
            el.btnAll.innerText = "Download All (ZIP)";
            el.btnAll.classList.add('btn-success');
            el.btnAll.onclick = downloadAllZip; // Cambiamos la acción del botón
        } else {
            // MODO CONVERTIR: Hay pendientes
            el.btnAll.disabled = pendingCount === 0;
            el.btnAll.innerText = "Convert All";
            el.btnAll.classList.remove('btn-success');
            el.btnAll.onclick = convertAllSequence; // Acción normal
        }
    }

    // --- MANEJO ARCHIVOS ---
    function addFiles(files) {
        Array.from(files).forEach(f => {
            if (f.type.startsWith('image/')) {
                fileQueue.push({ file: f, status: 'pending', url: null, blob: null });
            }
        });
        render();
    }

    window.removeFile = (index) => {
        fileQueue.splice(index, 1);
        render();
    };

    el.clear.onclick = () => {
        fileQueue = [];
        render();
    };

    // --- API ---
    async function convertApi(file) {
        const fd = new FormData();
        fd.append("files", file);
        fd.append("quality", el.quality.value);
        const res = await fetch('/api/convert', { method: 'POST', body: fd });
        if (!res.ok) throw new Error("Err");
        return await res.blob();
    }

    // --- PROCESO UNICO ---
    window.processOne = async (index) => {
        if (isProcessing) return;
        const item = fileQueue[index];
        item.status = 'loading';
        render();

        try {
            const blob = await convertApi(item.file);
            item.blob = blob; // Guardamos el blob para el ZIP
            item.url = URL.createObjectURL(blob);
            item.newName = item.file.name.split('.')[0] + '.webp';
            item.status = 'done';
        } catch (e) {
            item.status = 'error';
        }
        render();
    };

    // --- PROCESO SECUENCIAL (CONVERT ALL) ---
    async function convertAllSequence() {
        const indices = fileQueue.map((item, idx) => item.status === 'pending' ? idx : -1).filter(i => i !== -1);
        if (indices.length === 0) return;

        isProcessing = true;
        render();

        let completed = 0;
        const total = indices.length;

        for (const idx of indices) {
            fileQueue[idx].status = 'loading';
            render();

            try {
                const blob = await convertApi(fileQueue[idx].file);
                fileQueue[idx].blob = blob; // Guardamos para ZIP
                fileQueue[idx].url = URL.createObjectURL(blob);
                fileQueue[idx].newName = fileQueue[idx].file.name.split('.')[0] + '.webp';
                fileQueue[idx].status = 'done';
            } catch (e) {
                fileQueue[idx].status = 'error';
            }
            
            completed++;
            el.globalBar.style.width = `${(completed / total) * 100}%`;
            // Pequeña pausa
            await new Promise(r => setTimeout(r, 20)); 
        }

        isProcessing = false;
        setTimeout(() => { el.globalBar.style.width = '0%'; }, 500);
        render(); // Al renderizar, detectará "allConverted" y cambiará el botón a ZIP
    };

    // --- GENERAR ZIP (CLIENT SIDE) ---
    async function downloadAllZip() {
        const zip = new JSZip();
        
        // Agregamos todos los archivos convertidos al ZIP
        fileQueue.forEach(item => {
            if (item.status === 'done' && item.blob) {
                zip.file(item.newName, item.blob);
            }
        });

        // Generamos el archivo ZIP
        const content = await zip.generateAsync({type:"blob"});
        
        // Descargamos
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = "images_optimized.zip";
        a.click();
    }

    // --- EVENTOS ---
    el.drop.onclick = () => el.input.click();
    el.input.onchange = (e) => { addFiles(e.target.files); el.input.value = ''; };
    el.drop.ondragover = (e) => { e.preventDefault(); el.drop.style.borderColor = 'var(--primary)'; };
    el.drop.ondragleave = () => { el.drop.style.borderColor = 'var(--border)'; };
    el.drop.ondrop = (e) => { e.preventDefault(); el.drop.style.borderColor = 'var(--border)'; addFiles(e.dataTransfer.files); };

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
});