export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

export const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

export const fetchWithProgress = async (
    url: string,
    onChunk: (loadedDelta: number, total: number) => void
): Promise<ArrayBuffer> => {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
        throw new Error(`${response.status}: ${response.url}`);
    }

    const total = Number(response.headers.get("Content-Length") ?? 0);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        onChunk(value.length, total);
    }

    const bytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return bytes.buffer;
};
