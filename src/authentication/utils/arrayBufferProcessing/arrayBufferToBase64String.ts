import { arrayBufferToString } from "./arrayBufferToString";




export const arrayBufferToBase64String = (arrayBuffer: ArrayBuffer): string => {
    // convert from an ArrayBuffer to a binary string
    const binaryString = arrayBufferToString(arrayBuffer);

    // base64 encode the binary string
    const base64String = btoa(binaryString);

    return base64String;
};