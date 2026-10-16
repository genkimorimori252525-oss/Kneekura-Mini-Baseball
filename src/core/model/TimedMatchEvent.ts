export type TimedMatchEvent<TKind extends string = string, TPayload = unknown> = Readonly<{
  tick: number;
  sequence: number;
  kind: TKind;
  payload: TPayload;
}>;
