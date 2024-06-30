import type { Env } from ".";




export type AuthenticationBindings = {
    permittedIp: string;
    publicKeyString: string;
};




const validateIp = (request: Request, env: Env): boolean => {
    const permittedIp = env["permittedIp"];

    if (permittedIp === undefined) {
        return false;
    }


    const requestIp = request.headers.get("CF-Connecting-IP");

    if (requestIp === null) {
        return false;
    }


    return requestIp === permittedIp;
};




const stringToArrayBuffer = (string: string) => {
    const stringLength = string.length;


    const buffer = new ArrayBuffer(stringLength);

    const bufferView = new Uint8Array(buffer);


    for (let i = 0; i < stringLength; i++) {
        bufferView[i] = string.charCodeAt(i);
    }


    return buffer;
};


const base64StringToArrayBuffer = (base64String: string): ArrayBuffer => {
    // base64 decode the string to get the binary data
    const binaryDerString = atob(base64String);

    // convert from a binary string to an ArrayBuffer
    const binaryDer = stringToArrayBuffer(binaryDerString);

    return binaryDer;
};


const importRsaKey = (publicKeyString: string): Promise<CryptoKey> => {
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


    return publicKey;
};


/** This function returns HTTP status codes.
 * 200: The credentials are valid.
 * 401: The credentials were missing or otherwise unparsable.
 * 403: The credentials were invalid.
 * 500: Other error.
 */

// based on https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#subjectpublickeyinfo_import
const validateCredentials = async (request: Request, env: Env): Promise<number> => {
    const publicKeyString = env["publicKeyString"];

    if (publicKeyString === undefined) {
        return 500;
    }


    const requestBodyString = await request.text();

    const requestBodyArrayBuffer = stringToArrayBuffer(requestBodyString);


    const publicKey = await importRsaKey(publicKeyString);

    const signatureString = request.headers.get("Authorization");

    if (signatureString === null) {
        return 401;
    }


    const signature = base64StringToArrayBuffer(signatureString);

    const isVerified = await crypto.subtle.verify(
        {
            name: "RSA-PSS",
            saltLength: 32,
        },
        publicKey,
        signature,
        requestBodyArrayBuffer,
    );

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
export const authenticateRequest = async (request: Request, env: Env): Promise<number> => {
    const isIpValid = validateIp(request, env);

    if (!isIpValid) {
        return 403;
    }


    const validationStatusCode = await validateCredentials(request, env);


    return validationStatusCode;
};