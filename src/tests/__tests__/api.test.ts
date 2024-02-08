require('dotenv').config();
const axios = require('axios');
import { generateKeypair } from '../../mgmt/key.mgmt';
import { generateVerificationHeaders } from '../../utils/intercom.utils';



const TEST_KEYPAIR = {
    // Latest address version structure
    address: '18f70e4a53a7cfd7f82d0e1fc287a449872ec7489dba0dff86144df8609caeda',
    secretKey: Uint8Array.from([
        233, 235, 184, 105, 168, 34, 66, 245, 129, 89, 179, 190, 179, 228, 191, 30, 5, 237, 239,
        61, 108, 71, 165, 31, 199, 98, 115, 229, 108, 205, 221, 247, 35, 4, 102, 112, 71, 249,
        172, 7, 75, 43, 6, 43, 70, 85, 126, 50, 131, 161, 102, 29, 131, 72, 179, 214, 50, 52,
        144, 185, 200, 204, 249, 120,
    ]),
    publicKey: Uint8Array.from([
        35, 4, 102, 112, 71, 249, 172, 7, 75, 43, 6, 43, 70, 85, 126, 50, 131, 161, 102, 29,
        131, 72, 179, 214, 50, 52, 144, 185, 200, 204, 249, 120,
    ]),
    version: null,
};

const TEST_ADDRESS = '18f70e4a53a7cfd7f82d0e1fc287a449872ec7489dba0dff86144df8609caeda';
const TEST_CONTENT = {
    name: 'test'
}


/*===== Environmental variables provided through dotenv / .env file =====*/

const l2Url = process.env.L2_URL || 'http://localhost:3000';
// const mempoolUrl = process.env.MEMPOOL_URL || 'http://localhost:3003';
// const storageUrl = process.env.STORAGE_URL || 'http://localhost:3001';




describe("L2 API Tests", () => {

    it("should post to set_data successfully", async () => {
        console.log(`\n Using L2 URL: ${l2Url} \n`);

        const wrappedKp = generateKeypair();
        const keypair = wrappedKp.isOk() ? wrappedKp.value : TEST_KEYPAIR;
        const headers = generateVerificationHeaders(TEST_ADDRESS, keypair);

        const setBody = {
            address: TEST_ADDRESS,
            data: TEST_CONTENT
        };

        const setDataUrl = `${l2Url}/set_data`;
        const response = await axios.post(setDataUrl, setBody, { headers }).catch((err: any) => {
            console.log(err)
        });

        expect(response.status).toBe(200);
        expect(response.data).toStrictEqual({
            content: TEST_ADDRESS,
            status: 'Success',
            reason: 'Data set successfully',
            route: 'set_data',
        });
    });

    it("should get from get_data successfully", async () => {
        console.log(`\n Using L2 URL: ${l2Url} \n`);

        const wrappedKp = generateKeypair();
        const keypair = wrappedKp.isOk() ? wrappedKp.value : TEST_KEYPAIR;
        const headers = generateVerificationHeaders(TEST_ADDRESS, keypair);

        const getDataUrl = `${l2Url}/get_data`;
        const response = await axios.get(getDataUrl, {
            headers
        }).catch((err: any) => {
            console.log(err)
        });

        expect(response.status).toBe(200);
        expect(response.data).toStrictEqual({ 
            content: JSON.stringify(TEST_CONTENT),
            reason: "Data retrieved successfully",
            route: "get_data",
            status: "Success",

         });
    });


});

describe("Mempool API Tests", () => {

    it("should fetch balance successfully", async () => { });
});