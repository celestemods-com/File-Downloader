// - Run `npm run dev` in your terminal to start a development server
// - Open a browser tab at http://localhost:8787/ to see your worker in action
// - Run `npm run deploy` to publish your worker


const HASH_OBJECT_PREFIX = "hashes_";
const HASH_FILE_EXTENSION = ".hash";
const HASH_STRING_LENGTH = 16;


const FILE_CATEGORIES = ["mods", "screenshots", "richPresenceIcons"] as const satisfies string[];

type FileCategory = typeof FILE_CATEGORIES[number];


const R2_BUCKET_NAMES = {
	mods: "modsBucket",
	screenshots: "screenshotsBucket",
	richPresenceIcons: "richPresenceIconsBucket",
} as const satisfies Record<FileCategory, string>;

type R2BucketName = typeof R2_BUCKET_NAMES[FileCategory];


type Env = {
	r2Buckets: Record<R2BucketName, R2Bucket>;
};


const R2_BUCKET_SUBDOMAINS = {
	mods: "mods",
	screenshots: "screenshots",
	richPresenceIcons: "rich-presence-icons",
} as const satisfies Record<FileCategory, string>;

type R2BucketSubdomain = typeof R2_BUCKET_SUBDOMAINS[FileCategory];


type FileDownloadRequestBody = {
	fileCategory: FileCategory;
	fileName: string;
	downloadURL: string;
	hash?: string;
};

type FileDownloadRequestBodyParameter = keyof FileDownloadRequestBody;

const FILE_DOWNLOAD_REQUEST_BODY_REQUIRED_PARAMETERS = ["downloadURL", "fileCategory", "fileName"] as const satisfies FileDownloadRequestBodyParameter[];


type ParsedRequestBody = {
	downloadURL: string;
	hash?: string;
	fileName: string;
	r2: {
		r2Bucket: R2Bucket;
		subdomain: R2BucketSubdomain;
	};
};




/** This function returns HTTP status codes.
 * 200: The request is authenticated.
 * 401 or 403: The request is not authenticated.
 */
const authenticateRequest = (request: Request, env: Env): number => {
	return 200;	// TODO!!!: implement this
};




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


	if (typeof obj.downloadURL !== "string") {
		return false;
	}

	// I tried to use URL.canParse or URL.parse in the above if statement, but Typescript doesn't seem to recognize them
	try {
		new URL(obj.downloadURL);
	} catch {
		return false;
	}


	if (!FILE_CATEGORIES.includes(obj.fileCategory as FileCategory)) {
		return false;
	}


	if (typeof obj.fileName !== "string" || obj.fileName.length === 0 || obj.fileName.length > 255) {
		return false;
	}

	if (
		"hash" in obj &&
		typeof obj.hash !== undefined &&
		(
			typeof obj.hash !== "string" ||
			obj.hash.length !== HASH_STRING_LENGTH
		)
	) {
		return false;
	}


	return true;
};




const parseRequestBody = async (request: Request, env: Env): Promise<ParsedRequestBody | Response> => {
	const requestBodyString = await request.text();

	const requestBody = JSON.parse(requestBodyString);

	if (!isFileDownloadRequestBody(requestBody)) {
		return new Response("Invalid request body", { status: 400 });
	}


	const { downloadURL, hash, fileCategory, fileName } = requestBody;

	const subdomain = R2_BUCKET_SUBDOMAINS[fileCategory];


	console.log(`getting R2 bucket for fileCategory: ${fileCategory}`);

	const r2BucketName = R2_BUCKET_NAMES[fileCategory];

	const r2Bucket = env.r2Buckets[r2BucketName];

	if (r2Bucket == undefined) {
		return new Response("r2Bucket is undefined. This should not happen.", { status: 500 });
	}


	const parsedRequestBody: ParsedRequestBody = {
		downloadURL,
		fileName,
		r2: {
			r2Bucket,
			subdomain,
		},
	};


	return parsedRequestBody;
};




/** Handles POST requests.
 * These are for storing content files in the R2 buckets.
 * Hashes are stored with PUT requests.
 */
const handlePut = async (request: Request, env: Env) => {
	const parsedRequestBodyOrResponse = await parseRequestBody(request, env);

	if (parsedRequestBodyOrResponse instanceof Response) {
		return parsedRequestBodyOrResponse;
	}

	const { downloadURL, hash, fileName, r2 } = parsedRequestBodyOrResponse;

	const { r2Bucket, subdomain } = r2;


	console.log(`fetching ${downloadURL}`);

	const fetchResponse = await fetch(downloadURL, { method: "GET" });


	console.log(`storing ${fileName} in R2`);

	await r2Bucket.put(fileName, fetchResponse.body);

	let responseString = `Saved ${downloadURL} to https://${subdomain}.celestemodupdater.celestemods.com/${fileName.replace(/_/g, "/")}`;


	if (hash !== undefined) {
		const hashFileName = HASH_OBJECT_PREFIX + fileName + HASH_FILE_EXTENSION;

		console.log(`storing hash for ${fileName} in R2`);

		await r2Bucket.put(hashFileName, hash);

		responseString += ` and stored its hash in https://${subdomain}.celestemodupdater.celestemods.com/${hashFileName.replace(/_/g, "/")}`;
	}


	console.log(responseString);

	return new Response(responseString);
};




/** Handles DELETE requests.
 * These are for deleting content files and hashes from the R2 buckets.
 */
const handleDelete = async (request: Request, env: Env) => {
	// TODO!!!: implement this
	// continue here
};




// Define the event handler functions for the worker
// https://developers.cloudflare.com/workers/runtime-apis/handlers/
const workerHandlers = {
	// Handle HTTP requests from clients
	async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
		const authenticationStatusCode = authenticateRequest(request, env);

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