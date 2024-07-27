import { FILE_CATEGORIES, type FileCategory } from "../../consts/fileCategories";




export const isFileCategory = (value: unknown): value is FileCategory => FILE_CATEGORIES.includes(value as FileCategory);