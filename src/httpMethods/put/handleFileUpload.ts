import type { ParsedRequestBody_Base } from "../../types/types";
import type { PutRequestBody_Base } from "./handlePut";
import { base64StringToArrayBuffer } from "../../authentication/utils/arrayBufferProcessing/base64StringToArrayBuffer";
import { isFileCategory } from "../../types/typeGuards/isFileCategory";
import { isFileName } from "../../types/typeGuards/isFileName";
import { GAMEBANANA_MIRROR_DOMAIN } from "../../consts/gamebananaMirrorDomain";




type FileUploadRequestBody = {
	file: string;	// base64 encoded file
} & PutRequestBody_Base;

type FileUploadRequestBodyParameter = keyof FileUploadRequestBody;

const FILE_UPLOAD_REQUEST_BODY_REQUIRED_PARAMETERS = ["fileCategory", "fileName", "file"] as const satisfies FileUploadRequestBodyParameter[];




export type ParsedRequestBody_Upload = {
	file: string;	// base64 encoded file
} & ParsedRequestBody_Base;




export const isFileUploadRequestBody = (value: unknown): value is FileUploadRequestBody => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	for (const parameter of FILE_UPLOAD_REQUEST_BODY_REQUIRED_PARAMETERS) {
		if (!(parameter in value)) {
			return false;
		}
	}

	const obj = value as Record<FileUploadRequestBodyParameter, unknown>;


	if (!isFileCategory(obj.fileCategory)) {
		return false;
	}


	if (!isFileName(obj.fileName)) {
		return false;
	}


	if (typeof obj.file !== "string" || obj.file.length === 0) {	// base64 encoded file
		return false;
	}


	return true;
};




/** Handles uploading files by passing them directly to the Worker.
 * The file must be sent as a base64 encoded string, and the Worker will decode it and store it in the R2 bucket.
 */
export const handleFileUpload = async (parsedRequestBody: ParsedRequestBody_Upload): Promise<Response> => {
	console.log("Entering handleFileUpload");

	const { fileName, file: encodedFile, r2 } = parsedRequestBody;

	const { r2Bucket, subdomain } = r2;


	console.log(`decoding ${fileName}`);

	const fileBuffer = base64StringToArrayBuffer(encodedFile);


	console.log(`storing ${fileName} in R2`);

	await r2Bucket.put(fileName, fileBuffer);


	const responseString = `Saved ${fileName} to https://${subdomain}.${GAMEBANANA_MIRROR_DOMAIN}/${fileName.replace(/_/g, "/")}`;

	console.log(responseString);

	return new Response(responseString);
};