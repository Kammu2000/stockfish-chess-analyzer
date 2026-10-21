import { Color } from "../types";

export const colorFromPly = (ply: number): Color => (ply % 2 === 0 ? "w" : "b");
