const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const results = document.getElementById('results');

const maxFileSizeBytes = 10 * 1024 * 1024;

let workerPort;
let requestSeq = 0;
const pending = new Map();

const workerReady = initSharedWorker();

async function initSharedWorker() {
    if (!('SharedWorker' in window)) {
        alert('SharedWorker is not supported in this browser.');
        return;
    }

    const worker = new SharedWorker('/sw.js', { name: 'upload-shared-worker' });
    workerPort = worker.port;
    workerPort.start();

    workerPort.addEventListener('message', (event) => {
        const message = event.data;

        if (message?.type !== 'UPLOAD_RESULT') return;

        const slot = pending.get(message.requestId);
        if (!slot) return;

        clearTimeout(slot.timeoutId);
        pending.delete(message.requestId);
        slot.resolve(message.result);
    });
}

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    files.forEach(uploadViaWorker);
});

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
    const files = [...fileInput.files].filter(f => f.type.startsWith('image/'));
    files.forEach(uploadViaWorker);
    fileInput.value = '';
});

async function uploadViaWorker(file) {
    await workerReady;

    if (!workerPort) return;

    if (file.size > maxFileSizeBytes) {
        alert(`${file.name}: 10MBを超えるためアップロードできません。`);
        return;
    }

    const requestId = `${Date.now()}-${++requestSeq}`;

    const resultPromise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            pending.delete(requestId);
            reject(new Error('Worker response timeout'));
        }, 30000);

        pending.set(requestId, { resolve, timeoutId });
    });

    workerPort.postMessage({
        type: 'UPLOAD_IMAGE',
        requestId,
        payload: { file }
    });

    const result = await resultPromise;

    if (!result?.success) {
        alert(`Upload failed: ${result?.error ?? 'unknown error'}`);
        return;
    }

    appendResult(result.url);
}

function appendResult(url) {
    const item = document.createElement('div');
    item.className = 'item';

    const img = document.createElement('img');

    const showButton = document.createElement('button');
    showButton.type = 'button';
    showButton.textContent = 'サムネイルを表示';
    showButton.addEventListener('click', () => {
        img.src = url;
        img.alt = 'uploaded image';
        showButton.disabled = true;
        showButton.textContent = '表示済み';
    });

    const link = document.createElement('a');
    link.href = url;
    link.textContent = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    item.appendChild(showButton);
    item.appendChild(img);
    item.appendChild(link);
    results.prepend(item);
}
