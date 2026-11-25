"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { FormState } from "@/lib/forms";

/**
 * Like useActionState, but submits through onSubmit so React does not auto-reset the form afterwards.
 * (React 19 clears uncontrolled fields after every form action, which would wipe an editor's work
 * whenever the server returns a validation error.) The clicked button's name/value is included.
 */
export function useFormAction(fn: (prev: FormState, fd: FormData) => Promise<FormState>, initial: FormState = null) {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(fn, initial);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(e.currentTarget, submitter ?? undefined);
    startTransition(() => dispatch(fd));
  };
  return [state, onSubmit, pending] as const;
}
