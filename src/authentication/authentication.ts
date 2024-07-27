import type { Env } from "../types/types";
import { base64StringToArrayBuffer } from "./utils/arrayBufferProcessing/base64StringToArrayBuffer";
import { stringToArrayBuffer } from "./utils/arrayBufferProcessing/stringToArrayBuffer";
import { validateIp } from "./utils/validateIp";
import { importPublicKey } from "./utils/importPublicKey";
import { logGeneratedSignature } from "./logGeneratedSignature";




export const SALT_LENGTH = 32;




export type AuthenticationBindings = {
    PERMITTED_IPS: string;
    PUBLIC_KEY_STRING: string;
    PRIVATE_KEY_STRING?: string;
};







/** This function returns HTTP status codes.
 * 200: The credentials are valid.
 * 401: The credentials were missing or otherwise unparsable.
 * 403: The credentials were invalid.
 * 500: Other error.
 */

// based on https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#subjectpublickeyinfo_import
const validateCredentials = async (request: Request, env: Env, requestBodyString: string): Promise<number> => {
    const publicKeyString = env["PUBLIC_KEY_STRING"];

    if (publicKeyString === undefined) {
        console.error("Public key undefined");
        return 500;
    }


    const requestBodyArrayBuffer = stringToArrayBuffer(requestBodyString);


    let publicKey: CryptoKey;
    try {
        publicKey = await importPublicKey(publicKeyString);
    } catch (error) {
        console.error(error);
        return 500;
    }


    if (env.ENVIRONMENT === "dev") await logGeneratedSignature(env, requestBodyString);

    const signatureString = request.headers.get("Authorization");

    console.log(`requestBodyString: ${requestBodyString}`);

    if (signatureString === null) {
        return 401;
    }


    const signature = base64StringToArrayBuffer(signatureString);

    const isVerified = await crypto.subtle.verify(
        {
            name: "RSA-PSS",
            saltLength: SALT_LENGTH,
        },
        publicKey,
        signature,
        requestBodyArrayBuffer,
    );

    console.log(`isVerified: ${isVerified}`);

    if (!isVerified) {
        return 403;
    }


    return 200;
};




/** This function returns HTTP status codes.
 * 200: The request is authenticated.
 * 401 or 403: The request is not authenticated.
 * 500: Other error.
 */
export const authenticateRequest = async (request: Request, env: Env, requestBodyString: string): Promise<number> => {
    console.log("authenticating request");

    const isIpValid = validateIp(request, env);

    if (!isIpValid) {
        return 403;
    }


    const validationStatusCode = await validateCredentials(request, env, requestBodyString);


    return validationStatusCode;
};