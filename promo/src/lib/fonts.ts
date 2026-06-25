import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadSpace } from "@remotion/google-fonts/SpaceGrotesk";

// Limit weights/subsets so renders don't fire 100+ font network requests.
const opt = { weights: ["400", "600", "700"], subsets: ["latin"], ignoreTooManyRequestsWarning: true } as const;
const optHead = { weights: ["700", "800"], subsets: ["latin"], ignoreTooManyRequestsWarning: true } as const;

export const inter = loadInter("normal", opt);
export const jakarta = loadJakarta("normal", optHead);
export const space = loadSpace("normal", { weights: ["500", "700"], subsets: ["latin"], ignoreTooManyRequestsWarning: true });

export const FONT_BODY = inter.fontFamily;
export const FONT_HEAD = jakarta.fontFamily;
export const FONT_DISPLAY = space.fontFamily; // tight techy grotesk for big kinetic headlines
