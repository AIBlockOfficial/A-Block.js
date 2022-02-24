import { err, ok } from 'neverthrow';
import {
    IErrorInternal,
    IFetchPendingRbResponse,
    IPendingRbTxData,
    IPendingRbTxDetails,
    SyncResult,
} from '../interfaces/index';

export function getRbDataForDruid(
    druid: string,
    rbData: IFetchPendingRbResponse,
): SyncResult<{
    key: string;
    data: IPendingRbTxDetails;
}> {
    try {
        const response = Object.entries(rbData)
            .filter(([, value]) => Object.keys(value.value).includes(druid))
            .filter(([, value]) =>
                Object.values(value.value).every((entry) => entry.status === 'pending'),
            )
            .map(([key, value]) => ({
                key: key,
                data: value.value,
            }))
            .reduce(
                (
                    accumulator: {
                        key: string;
                        data: IPendingRbTxData;
                    }[],
                    val,
                ) => accumulator.concat(val),
                [],
            ); /* Flatten array */
        // TODO: This will cause an error if you make receipt-based payments to yourself!
        if (response.length !== 1) throw new Error(IErrorInternal.InvalidDRUIDProvided);
        return ok({
            key: response[0].key,
            data: response[0].data[druid],
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        return err(error.message);
    }
}
