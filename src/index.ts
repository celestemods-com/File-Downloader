// - Run `npm run dev` in your terminal to start a development server
// - Open a browser tab at http://localhost:8787/ to see your worker in action
// - Run `npm run deploy` to publish your worker


import type { Env } from "./types/types";
import { authenticateRequest } from "./authentication/authentication";
import { handleDelete } from "./httpMethods/handleDelete";
import { handlePut } from "./httpMethods/put/handlePut";




/**Define the event handler functions for the worker
 * https://developers.cloudflare.com/workers/runtime-apis/handlers/ 
*/
const workerHandlers = {
	// Handle HTTP requests from clients
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		console.log("Entering fetch handler");

		// The request body can only be read once, so we need to store it in a variable
		const requestBodyString = await request.text();


		// Authenticate the request
		const authenticationStatusCode = await authenticateRequest(request, env, requestBodyString);

		if (authenticationStatusCode !== 200) {
			return new Response(undefined, { status: authenticationStatusCode });
		}


		// HTTP method routing
		switch (request.method) {
			case "PUT": {
				return await handlePut(requestBodyString, env);
			}
			case "DELETE": {
				return await handleDelete(requestBodyString, env);
			}
			default: {
				return new Response("Method Not Allowed", { status: 405 });
			}
		}
	},
};

export default workerHandlers;	// The default export is required for both the Cloudflare Workers runtime and Wrangler dev runtime.