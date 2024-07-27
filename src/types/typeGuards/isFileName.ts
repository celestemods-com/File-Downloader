export const isFileName = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 255;