import type { Env } from ".";
import { base64StringToArrayBuffer, SALT_LENGTH, stringToArrayBuffer } from "./authentication";




const arrayBufferToString = (arrayBuffer: ArrayBuffer): string => {
    const bufferView = new Uint8Array(arrayBuffer);


    const stringArray: string[] = [];

    for (let characterIndex = 0; characterIndex < bufferView.length; characterIndex++) {
        const characterCode = bufferView[characterIndex];

        if (characterCode === undefined) {
            throw "Character code is undefined";
        }

        stringArray.push(String.fromCharCode(characterCode));
    }


    return stringArray.join("");
};


const arrayBufferToBase64String = (arrayBuffer: ArrayBuffer): string => {
    // convert from an ArrayBuffer to a binary string
    const binaryString = arrayBufferToString(arrayBuffer);

    // base64 encode the binary string
    const base64String = btoa(binaryString);

    return base64String;
};




/** Imports an RSA public key.
 * Assumes base64 encoding, spki format, and RSA-PSS algorithm with SHA-256 hash.
 * Non-extractable, only for verifying signatures.
*/
const importPrivateKey = (privateKeyString: string): Promise<CryptoKey> => {
    const binaryDer = base64StringToArrayBuffer(privateKeyString);

    
    // parse the DER-encoded binary data
    const privateKey = crypto.subtle.importKey(
        "pkcs8",
        binaryDer,
        {
            name: "RSA-PSS",
            hash: "SHA-256",
        },
        false,
        ["sign"],
    );


    return privateKey;
};




export const logGeneratedSignature = async (env: Env, requestBodyString: string) => {
    const privateKeyString = env["PRIVATE_KEY_STRING"];

    if (privateKeyString === undefined) {
        console.error("Private key not found in environment");
        return;
    }


    const privateKey = await importPrivateKey(privateKeyString);


    const requestBodyArrayBuffer = stringToArrayBuffer(requestBodyString);


    const signature = await crypto.subtle.sign(
        {
            name: "RSA-PSS",
            saltLength: SALT_LENGTH,
        },
        privateKey,
        requestBodyArrayBuffer,
    );

    
    const signatureString = arrayBufferToBase64String(signature);

    console.log(signatureString);
}