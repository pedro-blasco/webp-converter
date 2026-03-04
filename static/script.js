document.addEventListener('DOMContentLoaded', () => {
    // Agrupación de elementos del DOM (Clean Code)
    const DOM = {
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

    let fileQueue =[];
    let isProcessing = false;

    // --- TEMA (Dark mode toggle) ---
    DOM.theme.onclick = () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
        DOM.theme.innerText = isDark ? '🌙' : '☀️';
    };

    DOM.quality.oninput = (e) => DOM.qVal.innerText = `${e.target.value}%`;

    // --- RENDERIZADO DOM ---
    function render() {
        DOM.list.innerHTML = '';
        
        if (fileQueue.length === 0) {
            DOM.list.innerHTML = '<div class="empty-msg">No files selected</div>';
            updateMainButton(false, "Convert All", 'btn-primary');
            DOM.count.innerText = '0 Files';
            return;
        }

        const pendingCount = fileQueue.filter(f => f.status === 'pending' || f.status === 'loading').length;
        const allConverted = (pendingCount === 0 && fileQueue.length > 0);

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

            const sizeKB = (item.file.size / 1024).toFixed(0);
            div.innerHTML = `
                <div class="file-info">
                    <div class="file-name" title="${item.file.name}">${item.file.name}</div>
                    <div style="font-size:11px; color:var(--sub);">${sizeKB} KB</div>
                </div>
                ${actions}
            `;
            DOM.list.appendChild(div);
        });

        DOM.count.innerText = `${fileQueue.length} Files`;
        
        // Estado del botón principal
        if (isProcessing) {
            updateMainButton(true, "Processing...", 'btn-primary');
        } else if (allConverted) {
            updateMainButton(false, "Download All (ZIP)", 'btn-success', downloadAllZip);
        } else {
            updateMainButton(pendingCount === 0, "Convert All", 'btn-primary', convertAllSequence);
        }
    }

    function updateMainButton(disabled, text, className, clickHandler = null) {
        DOM.btnAll.disabled = disabled;
        DOM.btnAll.innerText = text;
        DOM.btnAll.className = `btn-primary ${className}`;
        DOM.btnAll.onclick = clickHandler;
    }

    // --- MANEJO DE ARCHIVOS ---
    function addFiles(files) {
        Array.from(files).forEach(f => {
            if (f.type.startsWith('image/')) {
                fileQueue.push({ file: f, status: 'pending', url: null, blob: null });
            }
        });
        render();
    }

    // ⚡ FIX MEMORY LEAK: Liberar memoria del navegador al eliminar archivo
    window.removeFile = (index) => {
        if (fileQueue[index].url) URL.revokeObjectURL(fileQueue[index].url);
        fileQueue.splice(index, 1);
        render();
    };

    // ⚡ FIX MEMORY LEAK: Liberar toda la memoria al limpiar
    DOM.clear.onclick = () => {
        fileQueue.forEach(item => {
            if (item.url) URL.revokeObjectURL(item.url);
        });
        fileQueue =[];
        render();
    };

    // --- API CALL ---
    async function convertApi(file) {
        const fd = new FormData();
        fd.append("files", file);
        fd.append("quality", DOM.quality.value);
        
        const res = await fetch('/api/convert', { method: 'POST', body: fd });
        if (!res.ok) throw new Error("Server error");
        return await res.blob();
    }

    async function processItem(idx) {
        fileQueue[idx].status = 'loading';
        render(); // Spinner
        try {
            const blob = await convertApi(fileQueue[idx].file);
            fileQueue[idx].blob = blob;
            fileQueue[idx].url = URL.createObjectURL(blob);
            fileQueue[idx].newName = fileQueue[idx].file.name.split('.')[0] + '.webp';
            fileQueue[idx].status = 'done';
        } catch (e) {
            fileQueue[idx].status = 'error';
        }
    }

    window.processOne = async (index) => {
        if (isProcessing) return;
        await processItem(index);
        render();
    };

    // --- CONVERSIÓN EN LOTE (BATCH) ---
    async function convertAllSequence() {
        const indices = fileQueue.map((item, idx) => item.status === 'pending' ? idx : -1).filter(i => i !== -1);
        if (indices.length === 0) return;

        isProcessing = true;
        render();

        let completed = 0;
        const total = indices.length;

        // Bucle en lotes de 2 para no saturar la red del cliente
        for (let i = 0; i < total; i += 2) {
            const batch = [processItem(indices[i])];
            if (i + 1 < total) batch.push(processItem(indices[i + 1]));

            await Promise.all(batch);
            
            completed += batch.length;
            DOM.globalBar.style.width = `${(completed / total) * 100}%`;
            render();
            
            // Pausa microscópica para evitar congelar la UI
            await new Promise(r => setTimeout(r, 10)); 
        }

        isProcessing = false;
        setTimeout(() => { DOM.globalBar.style.width = '0%'; }, 500);
        render();
    }

    // --- ZIP EXPORT ---
    async function downloadAllZip() {
        const zip = new JSZip();
        fileQueue.forEach(item => {
            if (item.status === 'done' && item.blob) {
                zip.file(item.newName, item.blob);
            }
        });
        const content = await zip.generateAsync({type:"blob"});
        const url = URL.createObjectURL(content);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = "images_optimized.zip";
        a.click();
        
        // Liberar la memoria del zip después de descargar
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // --- EVENT LISTENERS ---
    DOM.drop.onclick = () => DOM.input.click();
    DOM.input.onchange = (e) => { addFiles(e.target.files); DOM.input.value = ''; };
    
    DOM.drop.ondragover = (e) => { 
        e.preventDefault(); 
        DOM.drop.style.borderColor = 'var(--primary)'; 
    };
    DOM.drop.ondragleave = () => { 
        DOM.drop.style.borderColor = 'var(--border)'; 
    };
    DOM.drop.ondrop = (e) => { 
        e.preventDefault(); 
        DOM.drop.style.borderColor = 'var(--border)'; 
        addFiles(e.dataTransfer.files); 
    };

    window.addEventListener('paste', (e) => {
        const {items} = e.clipboardData;
        const p =[];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const b = items[i].getAsFile();
                if (!b.name || b.name === 'image.png') b.name = `pasted_${Date.now()}.png`;
                p.push(b);
            }
        }
        if (p.length) addFiles(p);
    });
});