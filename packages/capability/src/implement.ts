import type { Effect } from "effect";
import type { AnyContract } from "./contract.js";

export type Capability<Contract extends AnyContract, Requirements = never> = Readonly<{
  _tag: "Capability";
  contract: Contract;
  handler: (
    input: Contract["input"]["Type"],
  ) => Effect.Effect<Contract["output"]["Type"], Contract["failure"]["Type"], Requirements>;
}>;

export const implement = <Contract extends AnyContract, Requirements = never>(
  contract: Contract,
  handler: Capability<Contract, Requirements>["handler"],
): Capability<Contract, Requirements> => ({ _tag: "Capability", contract, handler });
