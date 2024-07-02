// - Run `npm run dev` in your terminal to start a development server
// - Open a browser tab at http://localhost:8787/ to see your worker in action
// - Run `npm run deploy` to publish your worker


import { type AuthenticationBindings, authenticateRequest, base64StringToArrayBuffer } from "./authentication";


const GAMEBANANA_MIRROR_DOMAIN = "celestemodupdater.celestemods.com";


const DELETE_BATCH_SIZE = 50;




const FILE_CATEGORIES = ["mods", "screenshots", "richPresenceIcons"] as const satisfies string[];

type FileCategory = typeof FILE_CATEGORIES[number];


const R2_BUCKET_NAMES = {
	mods: "modsBucket",
	screenshots: "screenshotsBucket",
	richPresenceIcons: "richPresenceIconsBucket",
} as const satisfies Record<FileCategory, string>;

type R2BucketName = typeof R2_BUCKET_NAMES[FileCategory];


type R2Bindings = Record<R2BucketName, R2Bucket>;

export type Env = AuthenticationBindings & R2Bindings;


const R2_BUCKET_SUBDOMAINS = {
	mods: "mods",
	screenshots: "screenshots",
	richPresenceIcons: "rich-presence-icons",
} as const satisfies Record<FileCategory, string>;

type R2BucketSubdomain = typeof R2_BUCKET_SUBDOMAINS[FileCategory];




type RequestBody_Base = {
	fileCategory: FileCategory;
};


type PutRequestBody_Base = {
	fileName: string;
} & RequestBody_Base;

type FileDownloadRequestBody = {
	downloadURL: string;
} & PutRequestBody_Base;

type FileDownloadRequestBodyParameter = keyof FileDownloadRequestBody;

const FILE_DOWNLOAD_REQUEST_BODY_REQUIRED_PARAMETERS = ["fileCategory", "fileName", "downloadURL"] as const satisfies FileDownloadRequestBodyParameter[];


type FileUploadRequestBody = {
	file: string;	// base64 encoded file
} & PutRequestBody_Base;

type FileUploadRequestBodyParameter = keyof FileUploadRequestBody;

const FILE_UPLOAD_REQUEST_BODY_REQUIRED_PARAMETERS = ["fileCategory", "fileName", "file"] as const satisfies FileUploadRequestBodyParameter[];


type FileDeletionRequestBody = {
	fileNames: [string, ...string[]];	// non-empty string array
} & RequestBody_Base;

type FileDeletionRequestBodyParameter = keyof FileDeletionRequestBody;

const FILE_DELETION_REQUEST_BODY_REQUIRED_PARAMETERS = ["fileCategory", "fileNames"] as const satisfies FileDeletionRequestBodyParameter[];




type ParsedRequestBody_Base = {
	r2: {
		r2Bucket: R2Bucket;
		subdomain: R2BucketSubdomain;
	};
};

type ParsedRequestBody_Put_Base = {
	fileName: string;
} & ParsedRequestBody_Base;

type ParsedRequestBody_Download = {
	downloadURL: string;
} & ParsedRequestBody_Put_Base;

type ParsedRequestBody_Upload = {
	file: string;	// base64 encoded file
} & ParsedRequestBody_Put_Base;

type ParsedRequestBody_Delete = {
	fileNames: [string, ...string[]];	// non-empty string array
} & ParsedRequestBody_Base;


const VALID_REQUEST_TYPES = ["download", "upload", "delete"] as const satisfies string[];

type ValidRequestType = typeof VALID_REQUEST_TYPES[number];

type ParsedRequestBody = {
	type: ValidRequestType;
} & (ParsedRequestBody_Download | ParsedRequestBody_Upload | ParsedRequestBody_Delete);




const isFileCategory = (value: unknown): value is FileCategory => FILE_CATEGORIES.includes(value as FileCategory);

const isFileName = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 255;




const isFileDownloadRequestBody = (value: unknown): value is FileDownloadRequestBody => {
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


	if (typeof obj.downloadURL !== "string") {
		return false;
	}

	// I tried to use URL.canParse or URL.parse in the above if statement, but Typescript doesn't seem to recognize them
	try {
		new URL(obj.downloadURL);
	} catch {
		return false;
	}


	return true;
};




const isFileUploadRequestBody = (value: unknown): value is FileUploadRequestBody => {
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




const isFileDeletionRequestBody = (value: unknown): value is FileDeletionRequestBody => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	for (const parameter of FILE_DELETION_REQUEST_BODY_REQUIRED_PARAMETERS) {
		if (!(parameter in value)) {
			return false;
		}
	}

	const obj = value as Record<FileDeletionRequestBodyParameter, unknown>;


	if (!isFileCategory(obj.fileCategory)) {
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




const parseRequestBody = async (request: Request, env: Env): Promise<ParsedRequestBody | Response> => {
	const requestBodyString = await request.text();

	const requestBody = JSON.parse(requestBodyString);

	const isFileDownloadRequest = isFileDownloadRequestBody(requestBody);
	const isFileUploadRequest = isFileUploadRequestBody(requestBody);
	const isFileDeletionRequest = isFileDeletionRequestBody(requestBody);

	if (!isFileDownloadRequest && !isFileUploadRequest && !isFileDeletionRequest) {
		return new Response("Invalid request body", { status: 400 });
	}

	if (Number(isFileDownloadRequest) + Number(isFileUploadRequest) + Number(isFileDeletionRequest) !== 1) {
		return new Response("Unable to determine request type", { status: 500 });
	}


	const { fileCategory } = requestBody;

	const subdomain = R2_BUCKET_SUBDOMAINS[fileCategory];


	console.log(`getting R2 bucket for fileCategory: ${fileCategory}`);

	const r2BucketName = R2_BUCKET_NAMES[fileCategory];

	const r2Bucket = env[r2BucketName];

	if (r2Bucket == undefined) {
		return new Response("r2Bucket is undefined. This should not happen.", { status: 500 });
	}


	const r2: ParsedRequestBody_Base["r2"] = {
		r2Bucket,
		subdomain,
	};


	if (isFileDownloadRequest) {
		const { fileName, downloadURL } = requestBody;

		return {
			type: "download",
			fileName,
			downloadURL,
			r2,
		};
	} else if (isFileUploadRequest) {
		const { fileName, file } = requestBody;

		return {
			type: "upload",
			fileName,
			file,
			r2,
		};
	} else if (isFileDeletionRequest) {
		const { fileNames } = requestBody;

		return {
			type: "delete",
			fileNames,
			r2,
		};
	} else {
		return new Response("Unable to parse request body", { status: 500 });
	}
};




/** Handles passing URLs to the Worker and having it download the file itself. */
const handleFileDownload = async (parsedRequestBody: ParsedRequestBody_Download): Promise<Response> => {
	const { downloadURL, fileName, r2 } = parsedRequestBody;

	const { r2Bucket, subdomain } = r2;


	console.log(`fetching ${downloadURL}`);

	const fetchResponse = await fetch(downloadURL, { method: "GET" });


	console.log(`storing ${fileName} in R2`);

	await r2Bucket.put(fileName, fetchResponse.body);


	const responseString = `Saved ${downloadURL} to https://${subdomain}.${GAMEBANANA_MIRROR_DOMAIN}/${fileName.replace(/_/g, "/")}`;

	console.log(responseString);

	return new Response(responseString);
};




/** Handles uploading files by passing them directly to the Worker.
 * The file must be sent as a base64 encoded string, and the Worker will decode it and store it in the R2 bucket.
 */
const handleFileUpload = async (parsedRequestBody: ParsedRequestBody_Upload): Promise<Response> => {
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




/** Handles PUT requests.
 * These are for storing content files in the R2 buckets.
 */
const handlePut = async (request: Request, env: Env): Promise<Response> => {
	const parsedRequestBodyOrResponse = await parseRequestBody(request, env);

	if (parsedRequestBodyOrResponse instanceof Response) {
		return parsedRequestBodyOrResponse;
	}


	if (parsedRequestBodyOrResponse.type === "download") {
		return handleFileDownload(parsedRequestBodyOrResponse as ParsedRequestBody_Download);
	}
	else if (parsedRequestBodyOrResponse.type === "upload") {
		return handleFileUpload(parsedRequestBodyOrResponse as ParsedRequestBody_Upload);
	}
	else {
		return new Response("Invalid request type", { status: 400 });
	}
};




/** Handles DELETE requests.
 * These are for deleting content files from the R2 buckets.
 */
const handleDelete = async (request: Request, env: Env): Promise<Response> => {
	const parsedRequestBodyOrResponse = await parseRequestBody(request, env);

	if (parsedRequestBodyOrResponse instanceof Response) {
		return parsedRequestBodyOrResponse;
	}

	if (parsedRequestBodyOrResponse.type !== "delete") {
		return new Response("Invalid request type", { status: 400 });
	}

	const parsedRequestBody = parsedRequestBodyOrResponse as ParsedRequestBody_Delete;


	const { fileNames, r2 } = parsedRequestBody;

	const { r2Bucket, subdomain } = r2;


	console.log(`deleting ${fileNames.length} files from R2`);


	const fileNamesAndHashFileNames: string[] = [];

	fileNames.forEach(
		(fileName) => fileNamesAndHashFileNames.push(fileName),
	);


	await r2Bucket.delete(fileNamesAndHashFileNames);


	console.log(`Deleted from https://${subdomain}.${GAMEBANANA_MIRROR_DOMAIN} : ${fileNamesAndHashFileNames.join(", ")}`);

	return new Response(`Deleted ${fileNames.length} files and their hash files from https://${subdomain}.${GAMEBANANA_MIRROR_DOMAIN}`);
};




// Define the event handler functions for the worker
// https://developers.cloudflare.com/workers/runtime-apis/handlers/
const workerHandlers = {
	// Handle HTTP requests from clients
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		const authenticationStatusCode = await authenticateRequest(request, env);

		if (authenticationStatusCode !== 200) {
			return new Response(undefined, { status: authenticationStatusCode });
		}


		switch (request.method) {
			case "PUT": {
				return await handlePut(request, env);
			}
			case "DELETE": {
				return await handleDelete(request, env);
			}
			default: {
				return new Response("Method Not Allowed", { status: 405 });
			}
		}
	},
};

export default workerHandlers;