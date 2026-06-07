# SideRouter Extension

## Commands

- **Test**: `npm test`
- **Unit tests**: `npm run test:unit`
- **Integration tests**: `npm run test:integration`
- **E2E tests**: `npm run test:e2e`

## Structure

- `main.html` - Main UI panel
- `manifest.json` - Extension configuration (MV3)
- `src/script.js` - SideRouter frontend class
- `src/background.js` - Service worker
- `src/content.js` - Content script
- `src/styles.css` - All styling
- `media/` - Extension icons
- `tests/unit/` - Unit tests (Jest)
- `tests/integration/` - Integration tests (Jest)
- `tests/e2e/` - End-to-end tests (Jest)
- `tests/helpers/` - Shared mock helpers