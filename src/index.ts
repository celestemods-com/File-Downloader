/**
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 */

export interface Env {

}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return new Response('Hello World!');
	},
};