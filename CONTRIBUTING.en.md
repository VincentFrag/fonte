# Contributing to Fonte

[Version française](CONTRIBUTING.md)

Thanks for wanting to improve Fonte! Every idea is welcome, even small ones, in English or French.

## Report a bug or suggest an idea

1. Open this repository's **Issues** tab, then **New issue**.
2. Describe what happens (or what you'd like), on which device and browser, and the version shown at the bottom of the app's **More** screen.
3. A screenshot helps a lot.

No coding needed for that.

## Suggest a code change

1. **Fork** this repository (button at the top right).
2. Make your changes in your copy. To test locally, run `python3 -m http.server 8000` in the folder and open `http://localhost:8000`.
3. If you change app files, bump the version number **in both places, with the same value**: `VERSION` at the top of `sw.js` and `APP_VERSION` at the top of `js/app.js`.
4. If you add or change interface text, wrap it in `t('…')` (the French text is the key) and add its translation to `js/i18n-en.js`.
5. If you add a column to the database, add it to `supabase/schema.sql`, to the `columns` list in `js/store.js`, and create a `supabase/migration-X.Y.sql` file for existing installs.
6. Open a **Pull request** to this repository explaining what you changed and why.

Every proposal is reviewed before being merged. It may be accepted, adjusted or declined depending on the project's direction.

## What you agree to by contributing

By submitting a contribution (code, text, image or anything else) to this repository:

- you confirm that you wrote it, or that you have the right to submit it;
- you agree that it is published under the project's license (see `LICENSE`);
- you allow VincentFrag to use, modify and distribute your contribution, including under other licenses, free or commercial.

This last point lets the project change its license later without having to track down every contributor. Your contribution stays credited in the repository's history.

If this English version and the French version ([CONTRIBUTING.md](CONTRIBUTING.md)) ever differ, both are meant to say the same thing; ask in an issue if anything is unclear.
