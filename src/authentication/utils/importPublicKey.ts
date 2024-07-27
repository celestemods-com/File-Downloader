import { base64StringToArrayBuffer } from "./arrayBufferProcessing/base64StringToArrayBuffer";




/** Imports an RSA public key */
export const importPublicKey = (publicKeyString: string): Promise<CryptoKey> => {
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