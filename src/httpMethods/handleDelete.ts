import type { Env, RequestBody_Base } from "../types/types";
import { type R2BucketSubdomain, getR2Information } from "../r2";
import { isFileCategory } from "../types/typeGuards/isFileCategory";
import { isFileName } from "../types/typeGuards/isFileName";
import { GAMEBANANA_MIRROR_DOMAIN } from "../consts/gamebananaMirrorDomain";
import { CLOUDFLARE_API_CACHE_PURGE_BASE_URL, CLOUDFLARE_API_CACHE_PURGE_ENDPOINT } from "../consts/cloudflareApiCachePurgeUrl";




const DELETE_BATCH_SIZE = 50;




type FileDeletionRequestBody = {
	fileNames: [string, ...string[]];	// non-empty string array
} & RequestBody_Base;

type FileDeletionRequestBodyParameter = keyof FileDeletionRequestBody;

const FILE_DELETION_REQUEST_BODY_REQUIRED_PARAMETERS = ["fileCategory", "fileNames"] as const;// satisfies FileDeletionRequestBodyParameter[];




export const isFileDeletionRequestBody = (value: unknown): value is FileDeletionRequestBody => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	for (const parameter of FILE_DELETION_REQUEST_BODY_REQUIRED_PARAMETERS) {
		if (!(parameter in value)) {
			return false;
		}
	}

	const obj = value as Record<FileDeletionRequestBodyParameter, unknown>;


	if ("fileCategory" in obj === false || !isFileCategory(obj.fileCategory)) {
		return false;
	}


	if (!Array.isArray(obj.fileNames) || obj.fileNames.length === 0 || obj.fileNames.length > DELETE_BATCH_SIZE) {
		return false;
	}

	for (const fileName of obj.fileNames) {
		if (!isFileName(fileName)) {
			return false;
		}
	}


	return true;
};




/** Handles DELETE requests.
 * These are for deleting content files from the R2 buckets.
 * Also purges the deleted files from the Cloudflare CDN cache.
 */
export const handleDelete = async (requestBodyString: string, env: Env,): Promise<Response> => {
	console.log("Entering handleDelete");

	const requestBody = JSON.parse(requestBodyString);

	if (!isFileDeletionRequestBody(requestBody)) {
		return new Response("Invalid request body", { status: 400 });
	}


	const { fileCategory, fileNames } = requestBody;


	const r2 = getR2Information(fileCategory, env);

	if (r2 instanceof Response) {
		return r2;
	}

	const { r2Bucket, subdomain } = r2;


	console.log(`Deleting ${fileNames.length} files from R2`);


	const fileNamesAndHashFileNames: string[] = [];

	fileNames.forEach(
		(fileName) => fileNamesAndHashFileNames.push(fileName),
	);


	await r2Bucket.delete(fileNamesAndHashFileNames);

	console.log(`Deleted from https://${subdomain}.${GAMEBANANA_MIRROR_DOMAIN} : ${fileNamesAndHashFileNames.join(", ")}`);


	// Purge deleted files from Cloudflare CDN cache
	console.log(`Purging ${fileNames.length} deleted files from Cloudflare CDN cache`);

	const cachePurgeStatusCode = await purgeDeletedFilesFromCloudflareCache(subdomain, fileNames, env);


	return new Response(`Deleted ${fileNames.length} files from https://${subdomain}.${GAMEBANANA_MIRROR_DOMAIN}\nPurge status code: ${cachePurgeStatusCode}`);
};


/** Returns HTTP status codes.
 * Handles purging the Cloudflare CDN cache for deleted files.
 * Not meant to be called directly; called within handleDelete.
 */
const purgeDeletedFilesFromCloudflareCache = async (
	r2BucketSubdomain: R2BucketSubdomain,
	fileNames: string[],
	env: Env,
): Promise<number> => {
	console.log("Entering purgeDeletedFilesFromCloudflareCache");

	const cloudflareZoneId = env["CLOUDFLARE_ZONE_ID"];

	if (cloudflareZoneId == undefined) {
		console.warn("CLOUDFLARE_ZONE_ID is undefined");
		return 400;
	}


	const cloudflareCachePurgeApiToken = env["CLOUDFLARE_CACHE_PURGE_API_TOKEN"];

	if (cloudflareCachePurgeApiToken == undefined) {
		console.warn("CLOUDFLARE_CACHE_PURGE_API_TOKEN is undefined");
		return 400;
	}


	const purgeUrls: string[] = fileNames.map(
		(fileName) => `https://${r2BucketSubdomain}.${GAMEBANANA_MIRROR_DOMAIN}/${fileName}`,
	);

	const requestBody = {
		files: purgeUrls,
	};

	const requestBodyString = JSON.stringify(requestBody);
	

	const cloudflareApiPurgeEndpointUrl = `${CLOUDFLARE_API_CACHE_PURGE_BASE_URL}/${r2BucketSubdomain}/${CLOUDFLARE_API_CACHE_PURGE_ENDPOINT}`;


	const response = await fetch(cloudflareApiPurgeEndpointUrl, {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${cloudflareCachePurgeApiToken}`,
			"Content-Type": "application/json",
		},
		body: requestBodyString,
	});


	return response.status;
};