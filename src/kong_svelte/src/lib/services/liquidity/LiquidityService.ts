import { auth } from "$lib/services/auth";
import { IcrcService } from "../icrc/IcrcService";
import { canisterId as kongBackendCanisterId } from "../../../../../declarations/kong_backend";
import { canisterIDLs } from "../pnp/PnpInitializer";
import { parseTokenAmount } from "$lib/utils/numberFormatUtils";

export class LiquidityService {
    static async addLiquidityAmounts(
        token0: string,
        amount0: bigint,
        token1: string
    ): Promise<Result<{ amount_0: bigint; amount_1: bigint }, string>> {
        try {
            const actor = await auth.getActor(kongBackendCanisterId, canisterIDLs.kong_backend, { anon: true });
            const result = await actor.add_liquidity_amounts(token0, amount0, token1);
            return result;
        } catch (error) {
            console.error("Error calculating liquidity amounts:", error);
            throw error;
        }
    }

    static async addLiquidity(params: {
        token_0: FE.Token;
        amount_0: bigint;
        token_1: FE.Token;
        amount_1: bigint;
    }): Promise<Result<bigint, string>> {
        try {
            // Request ICRC2 approvals for both tokens
            await Promise.all([
                IcrcService.checkAndRequestIcrc2Allowances(
                    params.token_0,
                    params.amount_0
                ),
                IcrcService.checkAndRequestIcrc2Allowances(
                    params.token_1,
                    params.amount_1
                )
            ]);

            const actor = await auth.getActor(kongBackendCanisterId, canisterIDLs.kong_backend, { anon: false, requiresSigning: false });
            const result = await actor.add_liquidity_async({
                token_0: params.token_0.token,
                amount_0: params.amount_0,
                token_1: params.token_1.token,
                amount_1: params.amount_1,
                tx_id_0: [],
                tx_id_1: []
            });

            return result;
        } catch (error) {
            console.error("Error adding liquidity:", error);
            throw error;
        }
    }
} 
