# Noto Sans JP

Sadoku bundles Noto Sans JP through the pinned
[`@fontsource-variable/noto-sans-jp` 5.3.1](https://www.npmjs.com/package/@fontsource-variable/noto-sans-jp/v/5.3.1)
dependency. Its CSS includes variable weights 100–900 and Unicode ranges so the
browser loads only the WOFF2 subsets needed for the displayed text. Vite emits
these files locally; no external font service is used.

The font is licensed under SIL Open Font License 1.1:

- `OFL.txt` preserves the Adobe copyright notice present in the font files and
  the upstream license, from
  [Google Fonts commit 295d98a7](https://github.com/google/fonts/blob/295d98a7a0c17c68f1341eaeea354e7960ea70d3/ofl/notosansjp/OFL.txt).
- `FONTSOURCE-LICENSE.txt` preserves the license supplied by the Fontsource
  package. Its license is also included by `deno task notices` in release
  notices.

OFL 1.1 permits embedding and redistributing these fonts with software when each
copy includes the copyright notice and license. The fonts remain under OFL 1.1,
cannot be sold by themselves, and modified fonts must respect reserved names.

Vite copies this directory into the client distribution embedded in the compiled
Sadoku binary. While Sadoku is running, the licenses can be read at
`/assets/fonts/noto-sans-jp/OFL.txt` and
`/assets/fonts/noto-sans-jp/FONTSOURCE-LICENSE.txt`, with any deployment prefix
prepended.
