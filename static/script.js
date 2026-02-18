document.addEventListener('DOMContentLoaded', () => {
    // REFERENCIAS AL DOM
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

    let fileQueue = [];
    let isProcessing = false;

    // --- TEMA ---
    el.theme.onclick = () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
        el.theme.innerText = isDark ? '🌙' : '☀️';
    };

    // --- SLIDER ---
    el.quality.oninput = (e) => el.qVal.innerText = e.target.value + '%';

    // --- RENDER ---
    function render() {
        el.list.innerHTML = '';
        
        if (fileQueue.length === 0) {
            el.list.innerHTML = '<div class="empty-msg">No files selected</div>';
            el.btnAll.disabled = true;
            el.count.innerText = '0 Files';
            return;
        }

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
                    <div style="font-size:11px; color:#888;">${(item.file.size/1024).toFixed(0)} KB</div>
                </div>
                ${actions}
            `;
            el.list.appendChild(div);
        });

        const pending = fileQueue.filter(f => f.status === 'pending').length;
        el.count.innerText = `${fileQueue.length} Files`;
        el.btnAll.disabled = isProcessing || pending === 0;
        el.btnAll.innerText = isProcessing ? "Processing..." : "Convert All";
    }

    // --- MANEJO DE ARCHIVOS ---
    function addFiles(files) {
        Array.from(files).forEach(f => {
            if (f.type.startsWith('image/')) {
                fileQueue.push({ file: f, status: 'pending', url: null });
            }
        });
        render();
    }

    // Funciones globales para que el HTML pueda acceder
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
        if (!res.ok) throw new Error("Error");
        return await res.blob();
    }

    // --- PROCESOS ---
    window.processOne = async (index) => {
        if (isProcessing) return;
        const item = fileQueue[index];
        item.status = 'loading';
        render();

        try {
            const blob = await convertApi(item.file);
            item.url = URL.createObjectURL(blob);
            item.newName = item.file.name.split('.')[0] + '.webp';
            item.status = 'done';
        } catch (e) {
            item.status = 'error';
        }
        render();
    };

    el.btnAll.onclick = async () => {
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
                fileQueue[idx].url = URL.createObjectURL(blob);
                fileQueue[idx].newName = fileQueue[idx].file.name.split('.')[0] + '.webp';
                fileQueue[idx].status = 'done';
            } catch (e) {
                fileQueue[idx].status = 'error';
            }
            
            completed++;
            el.globalBar.style.width = `${(completed / total) * 100}%`;
            // Pequeña pausa para que la UI respire
            await new Promise(r => setTimeout(r, 50)); 
        }

        isProcessing = false;
        setTimeout(() => { el.globalBar.style.width = '0%'; }, 500);
        render();
    };

    // --- EVENTOS DE ENTRADA ---
    // Click
    el.drop.onclick = () => el.input.click();
    
    // Change
    el.input.onchange = (e) => {
        addFiles(e.target.files);
        el.input.value = ''; 
    };

    // Drag & Drop
    el.drop.ondragover = (e) => { e.preventDefault(); el.drop.style.borderColor = 'var(--primary)'; };
    el.drop.ondragleave = () => { el.drop.style.borderColor = 'var(--border)'; };
    el.drop.ondrop = (e) => {
        e.preventDefault();
        el.drop.style.borderColor = 'var(--border)';
        addFiles(e.dataTransfer.files);
    };

    // Paste (Ctrl + V)
    window.addEventListener('paste', (e) => {
        const {items} = e.clipboardData;
        const pasted = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const b = items[i].getAsFile();
                if (!b.name || b.name === 'image.png') b.name = `pasted_${Date.now()}.png`;
                pasted.push(b);
            }
        }
        if (pasted.length) addFiles(pasted);
    });

    console.log("Script cargado y listo");
});