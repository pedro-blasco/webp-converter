const el = {
    drop: document.getElementById('dropZone'),
    input: document.getElementById('fileInput'),
    list: document.getElementById('fileList'),
    count: document.getElementById('listCount'),
    convertAll: document.getElementById('btnConvertAll'),
    clear: document.getElementById('clearAll'),
    q: document.getElementById('quality'),
    qVal: document.getElementById('qVal'),
    w: document.getElementById('wInput'),
    h: document.getElementById('hInput'),
    theme: document.getElementById('themeToggle')
};

// STATE
let fileQueue = []; 

// THEME
el.theme.onclick = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    el.theme.innerText = isDark ? '🌙' : '☀️';
};

// UI UPDATES
el.q.oninput = (e) => el.qVal.innerText = e.target.value;

function renderList() {
    el.list.innerHTML = '';
    el.count.innerText = `${fileQueue.length} Files`;
    el.convertAll.disabled = fileQueue.length === 0;

    fileQueue.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <span class="file-name" title="${item.file.name}">${item.file.name}</span>
            <div class="file-actions" id="actions-${index}">
                ${getActionsHTML(item, index)}
            </div>
        `;
        el.list.appendChild(div);
    });
}

function getActionsHTML(item, index) {
    if (item.status === 'done') {
        return `<a href="${item.url}" download="${item.newName}" class="btn-icon btn-down">⬇️</a>
                <button onclick="removeFile(${index})" class="btn-icon btn-del">✖️</button>`;
    } else if (item.status === 'loading') {
        return `<span style="font-size:12px;">⏳</span>`;
    } else {
        return `<button onclick="processSingle(${index})" class="btn-icon btn-run">▶️</button>
                <button onclick="removeFile(${index})" class="btn-icon btn-del">✖️</button>`;
    }
}

// LOGIC
function addFiles(newFiles) {
    Array.from(newFiles).forEach(f => {
        if (f.type.startsWith('image/')) {
            fileQueue.push({ file: f, status: 'pending', url: null });
        }
    });
    renderList();
}

window.removeFile = (index) => {
    fileQueue.splice(index, 1);
    renderList();
};

el.clear.onclick = () => {
    fileQueue = [];
    renderList();
};

// DRAG & DROP & PASTE
el.drop.onclick = () => el.input.click();
el.input.onchange = (e) => addFiles(e.target.files);

el.drop.ondragover = (e) => { e.preventDefault(); el.drop.classList.add('dragover'); };
el.drop.ondragleave = () => el.drop.classList.remove('dragover');
el.drop.ondrop = (e) => {
    e.preventDefault();
    el.drop.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
};

window.addEventListener('paste', (e) => {
    const {items} = e.clipboardData;
    const files = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            const blob = items[i].getAsFile();
            // Assign a random name if pasted from buffer without name
            if (!blob.name) blob.name = `pasted_image_${Date.now()}.png`; 
            files.push(blob);
        }
    }
    if (files.length > 0) addFiles(files);
});

// API CALLS
async function callApi(filesToConvert) {
    const fd = new FormData();
    filesToConvert.forEach(f => fd.append("files", f));
    fd.append("quality", el.q.value);
    fd.append("width", el.w.value || 0);
    fd.append("height", el.h.value || 0);

    const res = await fetch('/api/convert', { method: 'POST', body: fd });
    if (!res.ok) throw new Error("Error");
    return await res.blob();
}

// SINGLE CONVERT
window.processSingle = async (index) => {
    const item = fileQueue[index];
    item.status = 'loading';
    renderList();

    try {
        const blob = await callApi([item.file]);
        item.url = URL.createObjectURL(blob);
        item.newName = item.file.name.split('.')[0] + '.webp';
        item.status = 'done';
    } catch (e) {
        item.status = 'error';
        alert("Error converting this file");
    }
    renderList();
};

// BATCH CONVERT
el.convertAll.onclick = async () => {
    const pending = fileQueue.filter(i => i.status === 'pending');
    if (pending.length === 0) return alert("No pending files");

    el.convertAll.innerText = "Processing...";
    el.convertAll.disabled = true;

    try {
        // We send ONLY the raw files to backend
        const filesOnly = pending.map(p => p.file);
        const blob = await callApi(filesOnly);
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filesOnly.length === 1 ? "image.webp" : "images_batch.zip";
        a.click();
        
        // Mark all as done (simplified for batch)
        pending.forEach(p => p.status = 'done');
        // Note: Batch ZIP doesn't allow individual download links easily
        // so we just mark them done or clear them. Lets clear logic:
        alert("Batch conversion downloaded!");
        
    } catch (e) {
        alert("Batch error");
    }
    
    el.convertAll.innerText = "Convert All to ZIP";
    el.convertAll.disabled = false;
    renderList();
};