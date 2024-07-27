import type { Env, RequestBody_Base } from "../types/types";
import { getR2Information } from "../r2";
import { isFileCategory } from "../types/typeGuards/isFileCategory";
import { isFileName } from "../types/typeGuards/isFileName";
import { GAMEBANANA_MIRROR_DOMAIN } from "../consts/gamebananaMirrorDomain";




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


	console.log(`deleting ${fileNames.length} files from R2`);


	const fileNamesAndHashFileNames: string[] = [];

	fileNames.forEach(
		(fileName) => fileNamesAndHashFileNames.push(fileName),
	);


	await r2Bucket.delete(fileNamesAndHashFileNames);


	console.log(`Deleted from https://${subdomain}.${GAMEBANANA_MIRROR_DOMAIN} : ${fileNamesAndHashFileNames.join(", ")}`);

	return new Response(`Deleted ${fileNames.length} files from https://${subdomain}.${GAMEBANANA_MIRROR_DOMAIN}`);
};