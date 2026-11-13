"use client";

import { useActionState } from "react";
import { submitPostAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import styles from "./wall.module.css";

export function SubmitForm() {
  const [state, action, pending] = useActionState(submitPostAction, { status: "idle" });
  const failed = state.status === "error";

  return (
    <form action={action} className={styles.submitForm}>
      <label htmlFor="post-url" className={styles.submitLabel}>Link to the post on X</label>
      <div className={styles.submitFields}>
        <input
          id="post-url"
          type="url"
          name="url"
          required
          maxLength={500}
          placeholder="https://x.com/someone/status/…"
          // React resets the form after every action; this puts the link back after an error.
          defaultValue={failed ? state.url : ""}
          aria-invalid={failed || undefined}
          aria-describedby="post-url-status"
          className={styles.submitInput}
        />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className={styles.submitTrap} />
        {/* Not disabled while pending: disabling the focused button drops focus to the page. */}
        <Button
          type="submit"
          aria-disabled={pending}
          onClick={(event) => {
            if (pending) event.preventDefault();
          }}
          className={styles.submitButton}
        >
          {pending ? "Checking…" : "Submit"}
        </Button>
      </div>
      <p id="post-url-status" role="status" className={styles.submitStatus}>
        {state.status === "ok" ? "Thanks. It is waiting for review." : failed ? state.message : null}
      </p>
    </form>
  );
}
