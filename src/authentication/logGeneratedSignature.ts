import type { Env } from "../types/types";
import { stringToArrayBuffer } from "./utils/arrayBufferProcessing/stringToArrayBuffer";
import { arrayBufferToBase64String } from "./utils/arrayBufferProcessing/arrayBufferToBase64String";
import { importPrivateKey } from "./utils/importPrivateKey";
import { SALT_LENGTH } from "./authentication";




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
};