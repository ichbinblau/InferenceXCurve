# Link Import

A link can carry benchmark files, so CI jobs and other tools can hand out a URL that
loads their results into InferenceX Curve. Nothing is uploaded or stored: the data
lives in the URL fragment (after `#`), which browsers never send to the server.

```text
https://<owner>.github.io/InferenceXCurve/#/inferencex?data=<payload>
```

Opening the link adds the lines to the current data directly (no review step),
switches the filters to show them, and saves them in the browser like any other
import. It then removes `?data=...` from the address bar, so reloading the page
does not import the data again. Opening the same link twice does not duplicate
points: lines keep the same `Line ID` and identical points are merged.

## Payload

`<payload>` is the UTF-8 JSON object below, compressed with raw DEFLATE (RFC 1951,
no zlib or gzip header) and encoded as base64url (RFC 4648 §5) without `=` padding.

```json
{
  "v": 1,
  "name": "InferenceMINI run 38678956785",
  "run": "38678956785",
  "source": "https://github.com/owner/repo/actions/runs/38678956785",
  "files": [{ "name": "agg_bmk.json", "text": "[{...benchmark records...}]" }]
}
```

- `v` (required): payload version, currently `1`.
- `files` (required): one or more `{ "name", "text" }` entries. Each file is parsed
  exactly like `Import File` would parse a file of that name, so the extension
  selects the format: `.json`, `.jsonl` / `.ndjson`, `.csv`, or `.tsv`. Raw
  InferenceX benchmark records (for example a `results_bmk` artifact's
  `agg_bmk.json`) and the editor CSV from [`import-csv.md`](import-csv.md) both work.
- `run` (optional): seeds the `Line ID` suffix (`ci-<run>`), the same suffix the
  GitHub Actions import uses for that run.
- `name` / `source` (optional): shown in the status message after the import.

Invalid payloads leave the current data unchanged and explain the problem in the
import status.

## Producing a link

Python:

```python
import base64, json, zlib

def curve_link(base_url: str, payload: dict) -> str:
    compressor = zlib.compressobj(9, zlib.DEFLATED, -15)  # wbits=-15: raw DEFLATE
    raw = compressor.compress(json.dumps(payload, separators=(",", ":")).encode()) + compressor.flush()
    data = base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
    return f"{base_url.rstrip('/')}/#/inferencex?data={data}"
```

TypeScript (in this repository): `encodeLinkImport(payload)` from
`src/linkImport.ts` returns the `data` value.

## Size

A raw benchmark record compresses to roughly 2 KB in the link. Chromium and
Firefox accept fragments of several megabytes, so even large sweeps fit, but keep
links under about 1 MB if they are shared through tools with tighter limits
(GitHub job summaries are capped at 1 MiB per step).
