# LI Language Flags

A Chrome extension that shows which languages a LinkedIn company page is **actually maintained in**. Next to the "Overview" heading it adds one flag per language, highlights the primary language, and lets you click a flag to read the page's name, tagline and description in that language.

Free download: [amann.one/downloads](https://amann.one/downloads)

## Why

LinkedIn company pages can store their name, tagline and description in several languages, but LinkedIn only ever shows you one of them, depending on your own language setting. There is no way to see which translations exist, whether they are filled in, or what they say. This extension makes that visible at a glance.

Typical uses:

- Check how well a company maintains its page for international audiences.
- Audit your own company page: are all languages you care about really filled in?
- Compare competitors or customers in multilingual markets.
- Read a page's text in another language without changing your LinkedIn language.

## Features

- **One flag per stored language.** The extension reads the languages stored on the page, not just the one you currently see.
- **Primary language highlighted.** The page's primary language comes first and carries a blue ring. Its tooltip and popover say "primary language".
- **Works for single-language pages too.** If only the primary language is stored, its flag is shown as well.
- **Click a flag for the texts.** A popover shows locale, name, tagline and description in that language. Close it with a click outside, `Esc` or by scrolling.
- **Placed next to "Overview".** The flags sit right-aligned on the same line as the "Overview" (German: "Übersicht") heading on the Home and About tabs.
- **Follows you around LinkedIn.** LinkedIn is a single-page app. The extension notices when you switch to another company, go back, or change tabs, and updates the flags.
- **Company and school pages.** Active on `linkedin.com/company/*` and `linkedin.com/school/*`.
- **Offline flags.** 47 flag SVGs are bundled with the extension. Nothing is loaded from third-party servers.

## Installation

The extension is not in the Chrome Web Store. Install it as an unpacked extension:

1. Download the ZIP from [amann.one/downloads](https://amann.one/downloads), or clone this repository.
2. Unzip it into a folder you want to keep. Chrome loads the extension from that folder, so do not delete it afterwards.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode** (top right).
5. Click **Load unpacked** and select the folder that contains `manifest.json`.
6. Open any LinkedIn company page, for example `https://www.linkedin.com/company/amann-one/about/`.

To update, replace the files in the folder and click the reload icon on the extension's card in `chrome://extensions`. Then reload the LinkedIn tab.

## Usage

1. Make sure you are **logged in to LinkedIn** in that Chrome profile.
2. Open a company page on the **Home** or **About** tab, where the "Overview" heading is visible.
3. The flags appear at the right edge of the "Overview" line.
4. Hover a flag to see the locale code (for example `de_DE`), or click it to read the texts stored for that language.

If the page has no "Overview" section, for example on the Posts, Jobs or People tab, no flags are shown.

## How it works

LinkedIn has no public API for this, so the extension asks the same internal endpoint the LinkedIn website itself uses:

1. The content script derives the company's identifier (the part after `/company/` or `/school/`) from the URL.
2. It requests `/voyager/api/organization/companies?q=universalName&universalName=<slug>` from `www.linkedin.com`, using your existing LinkedIn session (the `csrf-token` header comes from the `JSESSIONID` cookie, the same way the site does it).
3. The response contains the multi-language fields `multiLocaleNames`, `multiLocaleTaglines` and `multiLocaleDescriptions`. Each one has a `localized` map such as `{ "de_DE": "...", "en_US": "..." }`. Locales with an empty text are ignored.
4. The primary language comes from the response's `defaultLocale`.
5. Each locale (language + region, for example `fr_FR`) is mapped to a flag. If the region has no bundled flag, or the locale has no region, a language-to-country table is used as fallback (for example `en` shows the UK flag). Locales that still cannot be mapped are shown as a small text label instead of a flag.
6. The flags are inserted next to the "Overview" heading. A timer re-checks the page every 1.5 seconds to handle LinkedIn's single-page navigation.

A flag represents a language, not a country. `en_US` and `en_GB` are shown with their own flags, while a bare `en` falls back to the UK flag.

## Privacy

- The extension only runs on `https://www.linkedin.com/company/*` and `https://www.linkedin.com/school/*`.
- Its only network requests go to `www.linkedin.com`, using your own session, and only for the company page you are looking at.
- It does not collect, store or transmit any data. There are no analytics, no external servers and no account.
- Requested permissions: host access to `https://www.linkedin.com/*`. No other permissions are used.

## Limitations

- **Unofficial interface.** The extension relies on LinkedIn's internal, undocumented web API. LinkedIn can change it at any time, which may break the extension until it is updated.
- **Read-only.** The extension shows stored texts. It cannot switch the page language on LinkedIn (LinkedIn ignores URL parameters such as `?locale=`), and it cannot edit anything.
- **Needs a login.** Without a LinkedIn session (no `JSESSIONID` cookie) the extension logs a warning to the browser console and shows nothing.
- **Needs the "Overview" heading.** Pages or tabs without it show no flags. Recognized heading texts are "Overview" and "Übersicht".
- **A single flag** means that only the primary language is stored on the page.
- **Layout.** LinkedIn changes its page layout from time to time. If the flags are misplaced, please open an issue.

## Troubleshooting

- **No flags at all:** Check that you are logged in, that you are on the Home or About tab, and that the page has an "Overview" section. Reload the page after installing or updating the extension.
- **Flags missing after switching companies:** Open the browser console (`F12`, Console tab) and filter for `[LanguageFlags]`. The log shows which locales were found and whether the request failed. Please include it in an issue together with the company URL.
- **Warning `API response 403` or `404`:** The company identifier may not be valid for the internal API, or your session has expired. Reload LinkedIn and log in again.

## Project structure

| File | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 definition: permissions, content script, bundled resources |
| `content.js` | Fetches the languages, builds the flags and the popover, handles navigation |
| `flags/*.svg` | Bundled 4:3 flag images |
| `LICENSE` | License text |

The extension is plain JavaScript without a build step or dependencies.

## Development

1. Clone the repository.
2. Load the folder as an unpacked extension (see Installation).
3. Edit `content.js`, click reload on the extension card in `chrome://extensions`, then reload the LinkedIn tab.
4. Open DevTools on the LinkedIn tab and filter the console for `[LanguageFlags]` to follow what the extension does.

Adding a flag: put a 4:3 SVG named after the lowercase ISO 3166-1 country code into `flags/` and add the code to the `FLAGS` list in `content.js`. For a new language fallback, extend `LANG_TO_COUNTRY`.

## Credits

Flag images come from the [flag-icons](https://github.com/lipis/flag-icons) project.

Built by [Christoph Amann](https://amann.one), amann one, Ulm.

## License

See [LICENSE](LICENSE).

## Disclaimer

This is an independent project. It is not affiliated with, endorsed by or sponsored by LinkedIn Corporation. LinkedIn is a trademark of its owner.
