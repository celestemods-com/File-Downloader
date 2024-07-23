import type { Env } from ".";
import { logGeneratedSignature } from "./devAuthentication";




export const SALT_LENGTH = 32;




export type AuthenticationBindings = {
    PERMITTED_IPS: string;
    PUBLIC_KEY_STRING: string;
    PRIVATE_KEY_STRING?: string;
};




const validateIp = (request: Request, env: Env): boolean => {
    if (env.ENVIRONMENT === "dev") return true;


    const permittedIpsString = env["PERMITTED_IPS"];

    if (permittedIpsString === undefined) {
        return false;
    }


    const permittedIpsArray = permittedIpsString.split(",");

    if (permittedIpsArray.length === 0) {
        console.warn("No permitted IPs");

        return false;
    }


    const requestIp = request.headers.get("CF-Connecting-IP");

    if (requestIp === null) {
        return false;
    }


    const isValidIp = permittedIpsArray.includes(requestIp);


    return isValidIp;
};




export const stringToArrayBuffer = (string: string) => {
    const stringLength = string.length;


    const buffer = new ArrayBuffer(stringLength);

    const bufferView = new Uint8Array(buffer);


    for (let i = 0; i < stringLength; i++) {
        bufferView[i] = string.charCodeAt(i);
    }


    return buffer;
};


export const base64StringToArrayBuffer = (base64String: string): ArrayBuffer => {
    // base64 decode the string to get the binary data
    const binaryDerString = atob(base64String);

    // convert from a binary string to an ArrayBuffer
    const binaryDer = stringToArrayBuffer(binaryDerString);

    return binaryDer;
};


/** Imports an RSA public key */
const importPublicKey = (publicKeyString: string): Promise<CryptoKey> => {
    const binaryDer = base64StringToArrayBuffer(publicKeyString);

    // parse the DER-encoded binary data
    const publicKey = crypto.subtle.importKey(
        "spki",
        binaryDer,
        {
            name: "RSA-PSS",
            hash: "SHA-256",
        },
        false,
        ["verify"],
    );

    console.log("successfully imported public key");


    return publicKey;
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