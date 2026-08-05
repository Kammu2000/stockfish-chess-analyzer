// constants
import { SOUND_FILES } from './constants'

// types
import { SoundKey } from './types'

class SoundService {
    private ctx: AudioContext | null = null
    private buffers = new Map<SoundKey, AudioBuffer>()
    private loading = new Map<SoundKey, Promise<void>>()

    private getCtx(): AudioContext {
        if (!this.ctx || this.ctx.state === 'closed') {
            this.ctx = new AudioContext()
        }

        if (this.ctx.state === 'suspended') {
            this.ctx.resume()
        }

        return this.ctx
    }

    private async load(key: SoundKey): Promise<void> {
        if (this.buffers.has(key)) return
        if (this.loading.has(key)) return this.loading.get(key)!

        const ctx = this.getCtx()
        const promise = fetch(SOUND_FILES[key])
            .then((r) => r.arrayBuffer())
            .then((ab) => ctx.decodeAudioData(ab))
            .then((buf) => {
                this.buffers.set(key, buf)
            })
            .catch(() => {
                console.error('unreachable')
            })

        this.loading.set(key, promise)
        return promise
    }

    private play(key: SoundKey, volume = 1): void {
        const ctx = this.getCtx()
        const buf = this.buffers.get(key)

        if (!buf) {
            this.load(key).then(() => this.play(key, volume))
            return
        }

        const src = ctx.createBufferSource()
        src.buffer = buf

        if (volume !== 1) {
            const gain = ctx.createGain()
            gain.gain.value = volume
            src.connect(gain)
            gain.connect(ctx.destination)
        } else {
            src.connect(ctx.destination)
        }

        src.start()
    }

    preload(): void {
        for (const key of Object.keys(SOUND_FILES) as SoundKey[]) {
            this.load(key)
        }
    }

    playMove(): void {
        this.play('move')
    }
    playMoveBack(): void {
        this.play('moveBack', 0.6)
    }
    playCapture(): void {
        this.play('capture')
    }
    playCastle(): void {
        this.play('castle')
    }
    playCheck(): void {
        this.play('check')
    }
    playAnalysisDone(): void {
        this.play('analysisDone')
    }
}

export const soundService = new SoundService()
