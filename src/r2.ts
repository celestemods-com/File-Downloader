import type { FileCategory } from "./consts/fileCategories";
import type { Env, ParsedRequestBody_Base } from "./types/types";




const R2_BUCKET_SUBDOMAINS = {
	mods: "banana-mirror-mods",
	screenshots: "banana-mirror-images",
	richPresenceIcons: "banana-mirror-rich-presence-icons",
} as const satisfies Record<FileCategory, string>;

export type R2BucketSubdomain = typeof R2_BUCKET_SUBDOMAINS[FileCategory];




const R2_BUCKET_NAMES = {
	mods: "modsBucket",
	screenshots: "screenshotsBucket",
	richPresenceIcons: "richPresenceIconsBucket",
} as const satisfies Record<FileCategory, string>;

type R2BucketName = typeof R2_BUCKET_NAMES[FileCategory];

export type ParsedRequestBody_R2Object = {
	r2Bucket: R2Bucket;
	subdomain: R2BucketSubdomain;
};




export type R2Bindings = Record<R2BucketName, R2Bucket>;




export const getR2Information = (fileCategory: FileCategory, env: Env): ParsedRequestBody_Base["r2"] | Response => {
	const subdomain = R2_BUCKET_SUBDOMAINS[fileCategory];


	console.log(`getting R2 bucket for fileCategory: ${fileCategory}`);

	const r2BucketName = R2_BUCKET_NAMES[fileCategory];

	const r2Bucket = env[r2BucketName];

	if (r2Bucket == undefined) {
		return new Response("r2Bucket is undefined. This should not happen.", { status: 500 });
	}


	return { r2Bucket, subdomain };
};