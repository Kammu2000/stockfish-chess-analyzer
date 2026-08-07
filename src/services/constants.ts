const SOUNDS_BASE = "/sounds/";

export const SOUND_FILES = {
    move: `${SOUNDS_BASE}move-self.mp3`,
    moveBack: `${SOUNDS_BASE}move-opponent.mp3`,
    capture: `${SOUNDS_BASE}capture.mp3`,
    castle: `${SOUNDS_BASE}castle.mp3`,
    check: `${SOUNDS_BASE}move-check.mp3`,
    analysisDone: `${SOUNDS_BASE}game-end.mp3`,
} as const;
