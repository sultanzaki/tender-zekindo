import type { Tender } from "./types";

/** Never mutate the shared cached record: access is evaluated per request. */
export function redactTenderMoney(tender: Tender): Tender {
  return {
    ...tender,
    oe: null,
    nilaiPenawaran: null,
    idrPerL: null,
    oeCatatan: null,
  };
}
