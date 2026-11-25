import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SetEditor } from "../components/SetEditor";
import { Loading, Shell } from "../components/Shell";
import { repo } from "../lib/db";
import { messageOf } from "../lib/format";
import { createId } from "../lib/ids";
import type { DictationSet } from "../lib/types";

export function EditSetPage() {
  const { setId = "" } = useParams();
  const navigate = useNavigate();
  const [set, setSet] = useState<DictationSet | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    repo()
      .then((store) => store.loadSets())
      .then((sets) => {
        if (cancel) return;
        const found = sets.find((entry) => entry.id === setId) ?? null;
        if (!found) setMissing(true);
        else setSet(found);
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(messageOf(reason));
      });
    return () => {
      cancel = true;
    };
  }, [setId]);

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium tracking-tight">Edit set</h1>
        <Link to={`/sets/${setId}`} className="btn btn-ghost">
          Cancel
        </Link>
      </div>
      {error ? (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      ) : null}
      {missing ? <p>That set isn't here.</p> : null}
      {!set && !missing && !error ? <Loading label="Loading this set…" /> : null}
      {set ? (
        <SetEditor
          initialTitle={set.title}
          initialBody={set.items.map((item) => item.body).join("\n")}
          submitLabel="Save changes"
          onSubmit={async (title, lines) => {
            try {
              const store = await repo();
              await store.saveSet({
                ...set,
                title,
                updatedAt: new Date().toISOString(),
                items: lines.map((body) => ({ id: createId(), body })),
              });
              await navigate(`/sets/${set.id}`);
              return null;
            } catch (reason) {
              return messageOf(reason);
            }
          }}
        />
      ) : null}
    </Shell>
  );
}
