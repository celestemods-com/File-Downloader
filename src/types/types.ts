import type { AuthenticationBindings } from "../authentication/authentication";
import type { FileCategory } from "../consts/fileCategories";
import type { ParsedRequestBody_R2Object, R2Bindings } from "../r2";




export type ParsedRequestBody_Base = {
	fileName: string;
	r2: ParsedRequestBody_R2Object;
};




export type Env = {
	ENVIRONMENT?: string;
	CLOUDFLARE_ZONE_ID?: string;
	CLOUDFLARE_CACHE_PURGE_API_TOKEN?: string;
} & AuthenticationBindings & R2Bindings;




export type RequestBody_Base = {
	fileCategory: FileCategory;
	timestamp: number;
};