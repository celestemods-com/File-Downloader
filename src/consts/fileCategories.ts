
export const FILE_CATEGORIES = ["mods", "screenshots", "richPresenceIcons"] as const satisfies string[];

export type FileCategory = typeof FILE_CATEGORIES[number];