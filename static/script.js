const elements = {
    input: document.getElementById('fileInput'),
    info: document.getElementById('fileInfo'),
    name: document.getElementById('fileName'),
    type: document.getElementById('fileType'),
    btn: document.getElementById('btnConvert'),
    progress: document.getElementById('progressContainer'),
    bar: document.getElementById('progressBar'),
    dl: document.getElementById('btnDownload'),
    err: document.getElementById('error-msg')
};

let file = null;

elements.input.onchange = (e) => {
    file = e.target.files[0];
    if (file) {
        elements.name.innerText = file.name;
        elements.type.innerText = file.name.split('.').pop().toUpperCase();
        elements.info.style.display = 'flex';
        elements.btn.disabled = false;
        elements.btn.style.display = 'block';
        elements.progress.style.display = 'none';
        elements.dl.style.display = 'none';
        elements.err.innerText = '';
    }
};

elements.btn.onclick = async () => {
    elements.btn.style.display = 'none';
    elements.progress.style.display = 'block';
    setTimeout(() => elements.bar.style.width = '40%', 50);

    const fd = new FormData();
    fd.append("file", file);

    try {
        const res = await fetch('/api/convert', { method: 'POST', body: fd });
        if (!res.ok) throw new Error("Error");
        elements.bar.style.width = '90%';
        const blob = await res.blob();
        elements.bar.style.width = '100%';
        setTimeout(() => {
            elements.progress.style.display = 'none';
            elements.dl.href = URL.createObjectURL(blob);
            elements.dl.download = file.name.split('.')[0] + '.webp';
            elements.dl.style.display = 'inline-block';
        }, 500);
    } catch (e) {
        elements.progress.style.display = 'none';
        elements.btn.style.display = 'block';
        elements.err.innerText = "Conversion failed";
    }
};