# Infoplus Returns Label App (starter)

This tiny Node.js app lets you search Infoplus return orders by `originalOrderNo` and view the JSON,
as a first step before we render 4" x 6" labels (portrait/landscape).

## Run locally
1. `npm install`
2. Create `.env` from `.env.example` and set:
   - `BASE_URL` (e.g. `https://impressionsvanity.infopluswms.com/infoplus-wms/api/beta`)
   - `API_KEY` (your Infoplus API key)
3. `npm run dev` (or `npm start`)
4. Open http://localhost:3000

## Notes
- The browser calls our backend at `/api/returns?originalOrderNo=...`.
- The backend calls Infoplus `GET /beta/returnOrder/search?filter=originalOrderNo eq {value}` (URI-encoded)
  with header `API-Key: {your key}` and returns the JSON result.

## Next steps
- Add a printable 4x6 label (both orientations) populated from the fetched data.
- Optionally add field mapping and validation of the response.
