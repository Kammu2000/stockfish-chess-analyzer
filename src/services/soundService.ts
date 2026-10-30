// utils
import { AppError } from "../utils/errors/appError";

// constants
import { SOUND_FILES } from "./constants";

type SoundKey = keyof typeof SOUND_FILES;

class SoundService {
    private ctx: AudioContext | null = null;
    // One decode per sound; a failed load is evicted so a later play can try again.
    private buffers = new Map<SoundKey, Promise<AudioBuffer>>();

    private getCtx(): AudioContext {
        if (!this.ctx || this.ctx.state === "closed") {
            this.ctx = new AudioContext();
        }

        if (this.ctx.state === "suspended") {
            void this.ctx.resume().catch(() => undefined);
        }

        return this.ctx;
    }

    private load(key: SoundKey): Promise<AudioBuffer> {
        let buffer = this.buffers.get(key);
        if (!buffer) {
            const ctx = this.getCtx();
            buffer = fetch(SOUND_FILES[key])
                .then((r) => {
                    if (!r.ok)
                        throw new AppError(
                            "NetworkError",
                            `Download failed (${r.status}): ${r.url}`
                        );
                    return r.arrayBuffer();
                })
                .then((ab) => ctx.decodeAudioData(ab));
            buffer.catch(() => this.buffers.delete(key));
            this.buffers.set(key, buffer);
        }
        return buffer;
    }

    private async play(key: SoundKey, volume = 1): Promise<void> {
        let buf: AudioBuffer;
        try {
            buf = await this.load(key);
        } catch (err) {
            console.warn(`[SoundService] couldn't load "${key}"`, err);
            return;
        }

        const ctx = this.getCtx();
        const src = ctx.createBufferSource();
        src.buffer = buf;

        if (volume !== 1) {
            const gain = ctx.createGain();
            gain.gain.value = volume;
            src.connect(gain);
            gain.connect(ctx.destination);
        } else {
            src.connect(ctx.destination);
        }

        src.start();
    }

    preload(): void {
        for (const key of Object.keys(SOUND_FILES) as SoundKey[]) {
            this.load(key).catch(() => undefined); // play() reports failures
        }
    }

    playMove(): void {
        void this.play("move");
    }
    playMoveBack(): void {
        void this.play("moveBack", 0.6);
    }
    playCapture(): void {
        void this.play("capture");
    }
    playCastle(): void {
        void this.play("castle");
    }
    playCheck(): void {
        void this.play("check");
    }
    playAnalysisDone(): void {
        void this.play("analysisDone");
    }
}

export const soundService = new SoundService();
