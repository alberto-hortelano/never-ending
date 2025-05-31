type _DeepReadonly<T> = Pick<T, never>;
export type DeepReadonly<T, Base = T> =
    T extends Array<infer U> ? _DeepReadonly<Base> & ReadonlyArray<DeepReadonly<U>> :
    T extends object ? _DeepReadonly<Base> & { readonly [K in keyof T]: DeepReadonly<T[K]> } :
    T;
