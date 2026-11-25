import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";

export function NotFoundPage() {
  return (
    <Shell>
      <div className="grid gap-3">
        <h1 className="font-display text-3xl font-medium tracking-tight">That page isn't here.</h1>
        <Link to="/" className="btn btn-secondary">
          Your sets
        </Link>
      </div>
    </Shell>
  );
}
