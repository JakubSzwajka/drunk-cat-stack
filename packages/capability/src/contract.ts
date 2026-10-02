import type { Schema } from "effect";

export type PlainSchema = Schema.Top & {
  readonly DecodingServices: never;
  readonly EncodingServices: never;
};

export type InputSchema = Schema.Struct<Record<string, PlainSchema>>;

export type Annotations = Readonly<{
  readOnly: boolean;
  destructive: boolean;
}>;

export type Contract<
  Name extends string,
  Input extends InputSchema,
  Output extends PlainSchema,
  Failure extends PlainSchema,
> = Readonly<{
  _tag: "Contract";
  name: Name;
  description: string;
  input: Input;
  output: Output;
  failure: Failure;
  annotations: Annotations;
}>;

export type AnyContract = Contract<string, InputSchema, PlainSchema, PlainSchema>;

export type DefineContractOptions<
  Input extends InputSchema,
  Output extends PlainSchema,
  Failure extends PlainSchema,
> = Readonly<{
  description: string;
  input: Input;
  output: Output;
  failure: Failure;
  annotations?: Partial<Annotations>;
}>;

const defaultAnnotations: Annotations = { readOnly: false, destructive: false };

export const defineContract = <
  const Name extends string,
  Input extends InputSchema,
  Output extends PlainSchema,
  Failure extends PlainSchema,
>(
  name: Name,
  options: DefineContractOptions<Input, Output, Failure>,
): Contract<Name, Input, Output, Failure> => ({
  _tag: "Contract",
  name,
  description: options.description,
  input: options.input,
  output: options.output,
  failure: options.failure,
  annotations: { ...defaultAnnotations, ...options.annotations },
});
