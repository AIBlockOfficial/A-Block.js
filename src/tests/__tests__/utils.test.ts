import { calculateNonceForId, getUniqueID } from '../../utils';
import { sha3_256 } from 'js-sha3';
test('create valid proof-of-work', () => {
    const difficulty = 2;
    const id = getUniqueID();
    const nonce = calculateNonceForId(difficulty, id);
    expect(
        Array.from(Buffer.from(sha3_256(`${nonce}-${id}`), 'hex'))
            .slice(0, difficulty)
            .every((e) => e === 0),
    ).toBe(true);
});
