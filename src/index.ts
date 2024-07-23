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


export type Env = {
	ENVIRONMENT?: string;
} & AuthenticationBindings & R2Bindings;


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
	downloadUrl: string;
} & PutRequestBody_Base;

type FileDownloadRequestBodyParameter = keyof FileDownloadRequestBody;

const FILE_DOWNLOAD_REQUEST_BODY_REQUIRED_PARAMETERS = ["fileCategory", "fileName", "downloadUrl"] as const satisfies FileDownloadRequestBodyParameter[];


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
	fileName: string;
	r2: {
		r2Bucket: R2Bucket;
		subdomain: R2BucketSubdomain;
	};
};

type ParsedRequestBody_Download = {
	downloadUrl: string;
} & ParsedRequestBody_Base;

type ParsedRequestBody_Upload = {
	file: string;	// base64 encoded file
} & ParsedRequestBody_Base;




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




const getR2Information = (fileCategory: FileCategory, env: Env): ParsedRequestBody_Base["r2"] | Response => {
	const subdomain = R2_BUCKET_SUBDOMAINS[fileCategory];


	console.log(`getting R2 bucket for fileCategory: ${fileCategory}`);

	const r2BucketName = R2_BUCKET_NAMES[fileCategory];

	const r2Bucket = env[r2BucketName];

	if (r2Bucket == undefined) {
		return new Response("r2Bucket is undefined. This should not happen.", { status: 500 });
	}


	return { r2Bucket, subdomain };
};




/** Handles passing URLs to the Worker and having it download the file itself. */
const handleFileDownload = async (parsedRequestBody: ParsedRequestBody_Download): Promise<Response> => {
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
	const requestBodyString = await request.text();

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




/** Handles DELETE requests.
 * These are for deleting content files from the R2 buckets.
 */
const handleDelete = async (request: Request, env: Env): Promise<Response> => {
	const requestBodyString = await request.text();

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