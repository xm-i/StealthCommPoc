const endpoint = '/api/upload/images';

self.addEventListener('connect', (event) => {
    const port = event.ports[0];
    port.start();

    port.addEventListener('message', async (msgEvent) => {
        const message = msgEvent.data;
        if (message?.type !== 'UPLOAD_IMAGE') return;

        const result = await upload(message.payload?.file);

        port.postMessage({
            type: 'UPLOAD_RESULT',
            requestId: message.requestId,
            result
        });
    });
});

async function upload(file) {
    if (!file) return { success: false, error: 'No file provided.' };

    try {
        const formData = new FormData();
        formData.append('file', file, file.name);

        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
        }

        const json = await response.json();
        return { success: true, ...json, uploadedVia: 'SharedWorker' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}
