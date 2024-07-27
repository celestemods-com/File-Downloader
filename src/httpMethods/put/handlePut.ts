import type { Env, RequestBody_Base } from "../../types/types";
import { getR2Information } from "../../r2";
import { handleFileDownload, isFileDownloadRequestBody, type ParsedRequestBody_Download } from "./handleFileDownload";
import { handleFileUpload, isFileUploadRequestBody, type ParsedRequestBody_Upload } from "./handleFileUpload";




export type PutRequestBody_Base = {
	fileName: string;
} & RequestBody_Base;




/** Handles PUT requests.
 * These are for storing content files in the R2 buckets.
 */
export const handlePut = async (requestBodyString: string, env: Env): Promise<Response> => {
	console.log("Entering handlePut");

	const requestBody = JSON.parse(requestBodyString);

	const isFileDownloadRequest = isFileDownloadRequestBody(requestBody);
	const isFileUploadRequest = isFileUploadRequestBody(requestBody);

	if (Number(isFileDownloadRequest) + Number(isFileUploadRequest) !== 1) {
		return new Response("Invalid request body", { status: 400 });
	}


	const { fileCategory } = requestBody;

	const r2 = getR2Information(fileCategory, env);

	if (r2 instanceof Response) {
		return r2;
	}


	if (isFileDownloadRequest) {
		const { fileName, downloadUrl } = requestBody;

		const parsedRequestBody: ParsedRequestBody_Download = {
			fileName,
			downloadUrl,
			r2,
		};

		return await handleFileDownload(parsedRequestBody);
	} else if (isFileUploadRequest) {
		const { fileName, file } = requestBody;

		const parsedRequestBody: ParsedRequestBody_Upload = {
			fileName,
			file,
			r2,
		};

		return await handleFileUpload(parsedRequestBody);
	} else {
		return new Response("Unable to parse request body", { status: 500 });
	}
};