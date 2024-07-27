import type { Env } from "../../types/types";




export const validateIp = (request: Request, env: Env): boolean => {
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


    console.log(`requestIp: ${requestIp}`);
    console.log(`permittedIpsArray: ${permittedIpsArray}`);


    const isValidIp = permittedIpsArray.includes(requestIp);


    return isValidIp;
};