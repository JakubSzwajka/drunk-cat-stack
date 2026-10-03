import { Context, type Schema } from "effect";
import { Tool } from "effect/unstable/ai";
import type { Contract, InputSchema, PlainSchema } from "./contract.ts";

export type ToToolOptions<Success extends Schema.Top, Failure extends Schema.Top> = Readonly<{
  title: string;
  idempotent: boolean;
  openWorld: boolean;
  success?: Success;
  failure?: Failure;
}>;

export type ContractTool<
  Name extends string,
  Input extends InputSchema,
  Success extends Schema.Top,
  Failure extends Schema.Top,
> = Tool.Tool<
  Name,
  {
    readonly parameters: Input;
    readonly success: Success;
    readonly failure: Failure;
    readonly failureMode: "error";
  }
>;

export const toTool = <
  const Name extends string,
  Input extends InputSchema,
  Output extends PlainSchema,
  ContractFailure extends PlainSchema,
  Success extends Schema.Top = Output,
  Failure extends Schema.Top = ContractFailure,
>(
  contract: Contract<Name, Input, Output, ContractFailure>,
  options: ToToolOptions<Success, Failure>,
): ContractTool<Name, Input, Success, Failure> => {
  // Without an override, Success and Failure fall back to their defaults, the contract schemas.
  const success = (options.success ?? contract.output) as Success;
  const failure = (options.failure ?? contract.failure) as Failure;
  return Tool.make(contract.name, {
    description: contract.description,
    parameters: contract.input,
    success,
    failure,
  })
    .annotate(Tool.Title, options.title)
    .annotateMerge(
      Context.make(Tool.Readonly, contract.annotations.readOnly).pipe(
        Context.add(Tool.Destructive, contract.annotations.destructive),
        Context.add(Tool.Idempotent, options.idempotent),
        Context.add(Tool.OpenWorld, options.openWorld),
      ),
    );
};
