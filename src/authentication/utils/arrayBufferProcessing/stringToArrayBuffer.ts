
export const stringToArrayBuffer = (string: string) => {
    const stringLength = string.length;


    const buffer = new ArrayBuffer(stringLength);

    const bufferView = new Uint8Array(buffer);


    for (let i = 0; i < stringLength; i++) {
        bufferView[i] = string.charCodeAt(i);
    }


    return buffer;
};