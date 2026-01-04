export async function computeFileSha256(file: File): Promise<string | null> {
    if (!globalThis.crypto?.subtle) {
        return null;
    }

    try {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        console.warn('[OCR] Failed to compute SHA-256:', error);
        return null;
    }
}
