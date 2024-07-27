import type { ParsedRequestBody_Base } from "../../types/types";
import type { PutRequestBody_Base } from "./handlePut";
import { isFileCategory } from "../../types/typeGuards/isFileCategory";
import { isFileName } from "../../types/typeGuards/isFileName";
import { GAMEBANANA_MIRROR_DOMAIN } from "../../consts/gamebananaMirrorDomain";




type FileDownloadRequestBody = {
	downloadUrl: string;
} & PutRequestBody_Base;

type FileDownloadRequestBodyParameter = keyof FileDownloadRequestBody;

const FILE_DOWNLOAD_REQUEST_BODY_REQUIRED_PARAMETERS = ["fileCategory", "fileName", "downloadUrl"] as const satisfies FileDownloadRequestBodyParameter[];




export type ParsedRequestBody_Download = {
	downloadUrl: string;
} & ParsedRequestBody_Base;




export const isFileDownloadRequestBody = (value: unknown): value is FileDownloadRequestBody => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	for (const parameter of FILE_DOWNLOAD_REQUEST_BODY_REQUIRED_PARAMETERS) {
		if (!(parameter in value)) {
			return false;
		}
	}

	const obj = value as Record<FileDownloadRequestBodyParameter, unknown>;


	if (!isFileCategory(obj.fileCategory)) {
		return false;
	}


	if (!isFileName(obj.fileName)) {
		return false;
	}


	if (typeof obj.downloadUrl !== "string") {
		return false;
	}

	// I tried to use URL.canParse or URL.parse in the above if statement, but Typescript doesn't seem to recognize them
	try {
		new URL(obj.downloadUrl);
	} catch {
		return false;
	}


	return true;
};




/** Handles passing URLs to the Worker and having it download the file itself. */
export const handleFileDownload = async (parsedRequestBody: ParsedRequestBody_Download): Promise<Response> => {
	console.log("Entering handleFileDownload");

	const { downloadUrl, fileName, r2 } = parsedRequestBody;

	const { r2Bucket, subdomain } = r2;


	console.log(`fetching ${downloadUrl}`);

	const fetchResponse = await fetch(downloadUrl, { method: "GET" });


	console.log(`storing ${fileName} in R2`);

	await r2Bucket.put(fileName, fetchResponse.body);


	const responseString = `Saved ${downloadUrl} to https://${subdomain}.${GAMEBANANA_MIRROR_DOMAIN}/${fileName.replace(/_/g, "/")}`;

	console.log(responseString);

	return new Response(responseString);
};