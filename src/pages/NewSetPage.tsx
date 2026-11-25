import { Link, useNavigate } from "react-router-dom";
import { SetEditor } from "../components/SetEditor";
import { Shell } from "../components/Shell";
import { repo } from "../lib/db";
import { messageOf } from "../lib/format";
import { createId } from "../lib/ids";
import { pushLocalIfPossible } from "../lib/sync-client";

export function NewSetPage() {
  const navigate = useNavigate();
  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium tracking-tight">New set</h1>
        <Link to="/" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
      <SetEditor
        initialTitle=""
        initialBody=""
        submitLabel="Save set"
        onSubmit={async (title, lines) => {
          try {
            const now = new Date().toISOString();
            const set = {
              id: createId(),
              title,
              createdAt: now,
              updatedAt: now,
              items: lines.map((body) => ({ id: createId(), body })),
            };
            const store = await repo();
            await store.saveSet(set);
            await pushLocalIfPossible();
            await navigate(`/sets/${set.id}`);
            return null;
          } catch (error) {
            return messageOf(error);
          }
        }}
      />
    </Shell>
  );
}
