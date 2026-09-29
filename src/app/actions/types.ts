import type { FieldErrors } from "@/lib/validation";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: FieldErrors };
