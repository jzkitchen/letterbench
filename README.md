# Letterbench

English dictation. Listen to a word or sentence, then tap the letters.

**Live site:** https://jzkitchen.github.io/letterbench/

The app is a static PWA. Sets, in-progress sessions, results, and voice settings stay on this device and sync automatically with the online store. A sample round is never saved.

## Import a backup

1. Open https://jzkitchen.github.io/letterbench/.
2. On **Your sets**, choose **Restore** and pick one JSON file.
3. Check the summary, then choose **Replace**.

Restore replaces the sets and sessions contained in the file. Voice settings are replaced only when the file includes them. A sample round is never written into the file.

**Backup** downloads `letterbench-backup-YYYY-MM-DD.json` for the data currently on this device.

## Backup file

```json
{
  "version": 1,
  "app": "letterbench",
  "exportedAt": "2026-11-25T09:29:00.000Z",
  "settings": { "gender": "female", "accent": "us", "rate": 0.85 },
  "sets": [
    {
      "id": "set-id",
      "title": "Week 1",
      "createdAt": "2026-11-25T09:00:00.000Z",
      "updatedAt": "2026-11-25T09:00:00.000Z",
      "items": [{ "id": "item-id", "body": "apple" }]
    }
  ],
  "sessions": [
    {
      "id": "session-id",
      "setId": "set-id",
      "title": "Week 1",
      "createdAt": "2026-11-25T09:01:00.000Z",
      "updatedAt": "2026-11-25T09:04:00.000Z",
      "finishedAt": "2026-11-25T09:04:00.000Z",
      "prefs": { "gender": "female", "accent": "us", "rate": 0.85 },
      "items": [{ "position": 0, "itemId": "item-id", "prompt": "apple" }],
      "attempts": [
        {
          "position": 0,
          "prompt": "apple",
          "answer": "apple",
          "letters": "apple",
          "correct": true,
          "durationMs": 4200,
          "submittedAt": "2026-11-25T09:04:00.000Z"
        }
      ]
    }
  ],
  "results": []
}
```

| Field | Meaning |
| --- | --- |
| `version` | `1` |
| `app` | `"letterbench"` |
| `exportedAt` | ISO-8601 time of the export |
| `settings` | Voice prefs. `gender` is `female` or `male`, `accent` is `us` or `uk`, `rate` is `0.6`–`1.3` in steps of `0.05`. Defaults are female, us, `0.85`. |
| `sets` | Dictation lists. One item per line in `items[].body`. |
| `sessions` | Every practice session. `finishedAt: null` means it is still in progress. |
| `results` | Finished sessions only, same object shape as `sessions`. Included so a file that stores results separately still imports. |

On import, a session listed in both `sessions` and `results` is kept from `sessions`. These aliases are also accepted: `collections` for sets, `name` for a set title, `lines` for items, `prefs` or `preferences` for settings, `collectionId` for `setId`, and `text` or `prompt` for an item body. Items may be plain strings.

## Storage on this device

- Voice settings: `localStorage` key `letterbench-prefs`, JSON `{ "gender", "accent", "rate" }`.
- Sets and sessions: IndexedDB database `letterbench`, object stores `sets` and `sessions`.
- If IndexedDB is blocked, the same snapshot is kept in `localStorage` key `letterbench-store`.

Deleting a set removes its unfinished session and leaves finished results in place.

The home set list is newest first: `updatedAt`, then `createdAt`.

## Online copy

Opening the site, or returning to it, refreshes from the online store. Local edits upload on their own. Reads and writes are public; there is no family password. Backup and Restore still use a JSON file on this device.

If two devices change different sets or sessions around the same time, each record is kept by its newer `updatedAt` (then `createdAt`). A delete stays deleted when the other copy has not edited that record. Voice settings follow the device that changed them.

The Worker URL defaults to `https://letterbench-api.eyeshadow-lee.workers.dev`. Set `VITE_LETTERBENCH_API` to point a build at a different Worker.

### Worker

`letterbench-api` is already deployed. Public reads and writes are at `https://letterbench-api.eyeshadow-lee.workers.dev`. The KV namespace `letterbench-store` already exists; `worker/wrangler.toml` binds it as `STORE` with id `1af14f4ad2ca4bb28bd5b84cd42cbb76`.

Never commit a token or the store contents. CORS allows `https://jzkitchen.github.io`. The updated Worker source in this repo still needs to be deployed before public writes are live.

## Develop

```bash
npm install
npm test
npm run dev
```

The dev server uses the `/letterbench/` base path. Production build:

```bash
npm run build
npm run check:dist
npm run preview
```

## Deploy

GitHub Actions (`.github/workflows/pages.yml`) tests, builds, and publishes the `dist` folder with GitHub Pages. The workflow runs on pushes to `main`.

Pages source is **GitHub Actions**. The published site is https://jzkitchen.github.io/letterbench/. Deep links are restored with `404.html` because Pages has no server-side router. After the first load, the service worker serves the app offline.
